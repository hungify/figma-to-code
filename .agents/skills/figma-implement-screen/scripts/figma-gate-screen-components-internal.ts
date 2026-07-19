#!/usr/bin/env tsx
/** Internal screen subgate. Public callers must use `pnpm figma-gate:screen`. */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";
import { z } from "zod";

interface Args {
  artifact?: string;
}

const PROP_MAP_DIR = ".figma/prop-map";
const LAYOUT_MAP_FILE = ".figma/layout-map.json";
const SOURCE_NODE_ID = /^\d+:\d+$/;
const FIGMA_NODE_ID = /^(?:I\d+:\d+(?:;\d+:\d+)+|\d+:\d+)$/;
const REPO_RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+/;
const OUTPUT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTRACT_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const ALWAYS_ALLOWED_ATTRS = new Set([
  "className",
  "children",
  "key",
  "ref",
  "id",
  "style",
  "slot",
  "asChild",
  "render",
  "nativeButton",
]);

const requestedNodeSchema = z
  .object({
    id: z.string().regex(OUTPUT_ID, "expected lowercase kebab-case source id"),
    nodeId: z.string().regex(SOURCE_NODE_ID, "expected Figma source node id like 1:2"),
  })
  .strict();

const detectedComponentSchema = z
  .object({
    sourceId: z.string().regex(OUTPUT_ID, "expected lowercase kebab-case source id"),
    nodeId: z.string().regex(FIGMA_NODE_ID, "expected Figma node id like 1:2"),
    name: z.string().min(1),
    kind: z.enum(["design-system", "layout"]),
  })
  .strict();

const evidenceSchema = z
  .object({
    filePath: z
      .string()
      .regex(REPO_RELATIVE_PATH, "expected repo-relative path")
      .startsWith(".figma/artifacts/"),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();

const ignoredInventoryIdentity = {
  sourceId: z.string().regex(OUTPUT_ID, "expected lowercase kebab-case source id"),
  nodeId: z.string().regex(FIGMA_NODE_ID, "expected Figma node id like 1:2"),
  name: z.string().min(1),
  nodeType: z.enum(["INSTANCE", "COMPONENT", "COMPONENT_SET"]),
  componentId: z.string().nullable(),
  componentName: z.string().nullable(),
  reason: z.string().min(1),
};

const lucideReplacementSchema = z
  .object({
    kind: z.literal("lucide"),
    importName: z.string().regex(/^[A-Z][A-Za-z0-9]*Icon$/),
  })
  .strict();

const simpleIconReplacementSchema = z
  .object({
    kind: z.literal("simple-icon"),
    importName: z.string().regex(/^Si[A-Z][A-Za-z0-9]*$/),
  })
  .strict();

const assetReplacementSchema = z
  .object({
    kind: z.literal("asset"),
    filePath: z.string().regex(REPO_RELATIVE_PATH),
  })
  .strict();

const ignoredInventoryNodeSchema = z.discriminatedUnion("classification", [
  z
    .object({
      ...ignoredInventoryIdentity,
      classification: z.literal("ui-icon"),
      replacement: lucideReplacementSchema,
    })
    .strict(),
  z
    .object({
      ...ignoredInventoryIdentity,
      classification: z.literal("brand-icon"),
      replacement: simpleIconReplacementSchema,
    })
    .strict(),
  z
    .object({
      ...ignoredInventoryIdentity,
      classification: z.literal("decorative"),
      replacement: assetReplacementSchema,
    })
    .strict(),
  z
    .object({
      ...ignoredInventoryIdentity,
      classification: z.literal("not-reusable"),
    })
    .strict(),
]);

const ownedComponentSchema = z
  .object({
    componentName: z.string().min(1),
    filePath: z.string().regex(REPO_RELATIVE_PATH, "expected repo-relative path"),
    role: z.enum(["screen", "route", "layout", "showcase"]),
  })
  .strict();

const designSystemResolutionSchema = z
  .object({
    kind: z.literal("design-system"),
    figmaNodes: z.array(z.string().regex(FIGMA_NODE_ID)).min(1),
    codeComponent: z.string().min(1),
    importPath: z.string().min(1),
    decision: z.literal("reuse"),
  })
  .strict();

const layoutResolutionSchema = z
  .object({
    kind: z.literal("layout"),
    figmaNodes: z.array(z.string().regex(FIGMA_NODE_ID)).min(1),
    codeComponent: z.string().min(1),
    importPath: z.string().min(1),
    decision: z.literal("reuse"),
  })
  .strict();

const viewportSchema = z
  .object({
    name: z.enum(["mobile", "desktop"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

const visualContractBase = {
  id: z.string().regex(CONTRACT_ID, "expected lowercase dot-separated contract id"),
  sourceId: z.string().regex(OUTPUT_ID, "expected lowercase kebab-case source id"),
  sourceNodeId: z.string().regex(FIGMA_NODE_ID, "expected Figma node id like 1:2"),
  goldNodeId: z.string().regex(FIGMA_NODE_ID, "expected Figma node id like 1:2"),
  role: z.enum(["primary", "supplemental"]),
  viewport: viewportSchema,
  outDir: z
    .string()
    .regex(REPO_RELATIVE_PATH, "expected repo-relative path")
    .startsWith(".figma/artifacts/"),
};

const regionVisualContractSchema = z
  .object({
    ...visualContractBase,
    scope: z.literal("region"),
    region: z.string().regex(OUTPUT_ID, "expected lowercase kebab-case region id"),
    profile: z.literal("component/strict"),
    selector: z.string().min(1),
    expectSize: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

const pageVisualContractSchema = z
  .object({
    ...visualContractBase,
    scope: z.literal("page"),
    profile: z.literal("page"),
    pageReason: z.string().min(1),
  })
  .strict();

const componentResolutionArtifactSchema = z
  .object({
    schemaVersion: z.literal(5),
    name: z.string().min(1),
    target: z.object({ kind: z.literal("screen"), route: z.string().startsWith("/") }).strict(),
    source: z
      .object({
        fileKey: z.string().min(1),
        nodes: z.array(requestedNodeSchema).min(1),
      })
      .strict(),
    classificationEvidence: evidenceSchema.optional(),
    inventoryEvidence: evidenceSchema.optional(),
    detectedComponents: z.array(detectedComponentSchema),
    ignoredInventoryNodes: z.array(ignoredInventoryNodeSchema).optional(),
    implementationFiles: z
      .array(z.string().regex(REPO_RELATIVE_PATH, "expected repo-relative path"))
      .min(1),
    resolved: z.array(
      z.discriminatedUnion("kind", [designSystemResolutionSchema, layoutResolutionSchema]),
    ),
    unresolved: z.array(
      z
        .object({
          figmaNode: z.string().regex(FIGMA_NODE_ID, "expected detected Figma node id"),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    screenCompositions: z.array(
      z
        .object({
          componentName: z.string().min(1),
          filePath: z.string().regex(REPO_RELATIVE_PATH, "expected repo-relative path"),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    entryComponents: z.array(ownedComponentSchema).optional(),
    assets: z.array(
      z
        .object({
          figmaNode: z.string().min(1),
          kind: z.enum(["photo", "illustration", "logo", "decorative"]),
          filePath: z.string().regex(REPO_RELATIVE_PATH, "expected repo-relative path"),
          source: z.literal("figma-mcp"),
        })
        .strict(),
    ),
    visualContracts: z.array(
      z.discriminatedUnion("scope", [regionVisualContractSchema, pageVisualContractSchema]),
    ),
  })
  .strict();

type ComponentResolutionArtifact = z.infer<typeof componentResolutionArtifactSchema>;
type ResolutionEntry = ComponentResolutionArtifact["resolved"][number];

interface ImportBinding {
  imported: string;
  source: string;
}

interface RawUsage {
  tag: string;
  kind: "jsx" | "createElement" | "role";
  line: number;
}

interface JsxAttr {
  name: string;
  value: string | undefined;
  line: number;
}

interface JsxComponentUsage {
  tag: string;
  line: number;
  attrs: JsxAttr[];
  spreadLines: number[];
}

interface FileAnalysis {
  imports: Map<string, ImportBinding>;
  jsxComponents: Set<string>;
  jsxUsages: JsxComponentUsage[];
  rawUsages: RawUsage[];
  declaredComponents: string[];
}

const inventoryFileSchema = z
  .object({
    schemaVersion: z.literal(2),
    generator: z.literal("figma-inventory-fetch@2"),
    fileKey: z.string().min(1),
    sourceNodes: z.array(requestedNodeSchema).min(1),
    version: z.string().nullable(),
    lastModified: z.string().nullable(),
    visibleOnly: z.literal(true),
    nodeTree: z.array(
      z
        .object({
          sourceId: z.string().regex(OUTPUT_ID),
          nodeId: z.string().regex(FIGMA_NODE_ID),
          parentNodeId: z.string().regex(FIGMA_NODE_ID).nullable(),
          name: z.string().min(1),
          nodeType: z.string().min(1),
          bounds: z
            .object({
              x: z.number(),
              y: z.number(),
              width: z.number().positive(),
              height: z.number().positive(),
            })
            .strict()
            .nullable(),
        })
        .strict(),
    ),
    items: z.array(
      z
        .object({
          sourceId: z.string().regex(OUTPUT_ID),
          nodeId: z.string().regex(FIGMA_NODE_ID),
          name: z.string().min(1),
          nodeType: z.enum(["INSTANCE", "COMPONENT", "COMPONENT_SET"]),
          componentId: z.string().nullable(),
          componentName: z.string().nullable(),
        })
        .strict(),
    ),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();

type InventoryFile = z.infer<typeof inventoryFileSchema>;

const layoutMapSchema = z
  .object({
    schemaVersion: z.literal(1),
    mappings: z.array(
      z
        .object({
          fileKey: z.string().min(1),
          componentId: z.string().min(1),
          componentName: z.string().min(1),
          codeComponent: z.string().min(1),
          importPath: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

type LayoutMap = z.infer<typeof layoutMapSchema>;

const classificationFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    generator: z.literal("figma-classify-target@1"),
    fileKey: z.string().min(1),
    sourceNodes: z.array(requestedNodeSchema).min(1),
    version: z.string().nullable(),
    lastModified: z.string().nullable(),
    targetKind: z.enum(["screen", "design-system-component", "ambiguous"]),
    routeSkill: z.enum(["figma-implement-screen", "figma-implement-component"]).nullable(),
    results: z.array(
      z
        .object({
          sourceId: z.string().regex(OUTPUT_ID),
          nodeId: z.string().regex(SOURCE_NODE_ID),
          nodeType: z.string().min(1),
          nodeName: z.string().min(1),
          targetKind: z.enum(["screen", "design-system-component", "ambiguous"]),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();

interface PropMapMapping {
  figmaProp: string;
  figmaType: string;
  mappingKind: "direct" | "override" | "composition" | "unmapped";
  reactProp?: string;
  valueMap?: Record<string, unknown>;
  valueOverrides?: Record<string, Record<string, unknown>>;
  note?: string;
}

interface PropMapFile {
  schemaVersion: 2;
  target: { component: string; file: string; apiHash: string };
  groups: Array<{
    figmaNodeId: string;
    name: string;
    mappings: PropMapMapping[];
  }>;
}

interface PropMapIndex {
  figmaNames: Map<string, { reactProp: string | null; codeValues: Set<string> }>;
  mappedReactProps: Set<string>;
}

function mappingSignature(mapping: PropMapMapping): string {
  return canonicalize({
    figmaType: mapping.figmaType,
    mappingKind: mapping.mappingKind,
    reactProp: mapping.reactProp ?? null,
    valueMap: mapping.valueMap ?? null,
    valueOverrides: mapping.valueOverrides ?? null,
  });
}

export function propMapGroupConflicts(mapFile: PropMapFile): string[] {
  const byName = new Map<string, { groupNodeId: string; signature: string }>();
  const conflicts: string[] = [];
  for (const group of mapFile.groups) {
    for (const mapping of group.mappings) {
      const name = stripFigmaPropId(mapping.figmaProp);
      const signature = mappingSignature(mapping);
      const previous = byName.get(name);
      if (previous && previous.signature !== signature) {
        conflicts.push(`${name} (${previous.groupNodeId}, ${group.figmaNodeId})`);
      } else if (!previous) {
        byName.set(name, { groupNodeId: group.figmaNodeId, signature });
      }
    }
  }
  return [...new Set(conflicts)].sort();
}

export function layoutMapDuplicateIdentities(layoutMap: LayoutMap): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const mapping of layoutMap.mappings) {
    const identity = `${mapping.fileKey}::${mapping.componentId}`;
    if (seen.has(identity)) duplicates.add(identity);
    seen.add(identity);
  }
  return [...duplicates].sort();
}

const primitiveRawTags: Record<string, string[]> = {
  Button: ["button"],
  Input: ["input"],
  TextField: ["input"],
  Textarea: ["textarea"],
  TextareaField: ["textarea"],
  Select: ["select"],
  SelectField: ["select"],
  Checkbox: ["input"],
  RadioGroup: ["input"],
  RadioGroupItem: ["input"],
  Switch: ["button"],
};

const semanticRoleComponents: Record<string, string[]> = {
  Button: ["button"],
  Switch: ["switch"],
  Checkbox: ["checkbox"],
  RadioGroupItem: ["radio"],
};

function parseArgs(): Args {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const parsed: Args = {};
  const unknown: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--artifact") {
      parsed.artifact = args[i + 1];
      i += 1;
      continue;
    }
    unknown.push(arg);
  }

  if (unknown.length > 0) {
    fail([
      `unknown argument(s): ${unknown.join(", ")}; contract owns files and all required checks`,
    ]);
  }

  return parsed;
}

function fail(reasons: string[]): never {
  console.error("FAIL");
  for (const reason of reasons) {
    console.error(`- ${reason}`);
  }
  process.exit(1);
}

function readArtifact(artifactPath: string): ComponentResolutionArtifact {
  if (!fs.existsSync(artifactPath)) {
    fail([`component resolution artifact missing: ${artifactPath}`]);
  }

  let rawArtifact: unknown;
  try {
    rawArtifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  } catch {
    fail([`component resolution artifact is not valid JSON: ${artifactPath}`]);
  }

  const parsed = componentResolutionArtifactSchema.safeParse(rawArtifact);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const location = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `component-resolution ${location}: ${issue.message}`;
    });
    fail(issues);
  }

  return parsed.data;
}

function normalizeImportPath(importPath: string): string {
  return importPath.replace(/^\.\/src\//, "#/").replace(/^src\//, "#/");
}

function allowedSources(resolution: ResolutionEntry): Set<string> {
  const direct = normalizeImportPath(resolution.importPath);
  const sources = new Set([direct]);

  if (direct.startsWith("#/components/ui/")) {
    sources.add("#/components/ui");
  }
  if (direct.startsWith("#/components/") && !direct.startsWith("#/components/ui/")) {
    sources.add("#/components");
  }

  return sources;
}

function getLine(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function jsxTagNameText(name: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isPropertyAccessExpression(name)) return name.getText();
  return name.getText();
}

function literalAttrValue(attr: ts.JsxAttribute): string | undefined {
  if (!attr.initializer) return undefined;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    const expression = attr.initializer.expression;
    if (ts.isStringLiteral(expression)) return expression.text;
    if (expression.kind === ts.SyntaxKind.TrueKeyword) return "true";
    if (expression.kind === ts.SyntaxKind.FalseKeyword) return "false";
  }
  return undefined;
}

function collectJsxAttrs(attributes: ts.JsxAttributes, sourceFile: ts.SourceFile): JsxAttr[] {
  const attrs: JsxAttr[] = [];
  for (const prop of attributes.properties) {
    if (!ts.isJsxAttribute(prop)) continue;
    if (!ts.isIdentifier(prop.name)) continue;
    attrs.push({
      name: prop.name.text,
      value: literalAttrValue(prop),
      line: getLine(sourceFile, prop),
    });
  }
  return attrs;
}

function jsxRoleValue(attributes: ts.JsxAttributes): string | undefined {
  for (const prop of attributes.properties) {
    if (!ts.isJsxAttribute(prop)) continue;
    if (!ts.isIdentifier(prop.name)) continue;
    if (prop.name.text !== "role") continue;
    return literalAttrValue(prop);
  }
  return undefined;
}

function isReactCreateElement(
  node: ts.CallExpression,
  imports: Map<string, ImportBinding>,
): boolean {
  const expression = node.expression;
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text === "createElement" && expression.expression.getText() === "React";
  }
  if (ts.isIdentifier(expression)) {
    const binding = imports.get(expression.text);
    return binding?.source === "react" && binding.imported === "createElement";
  }
  return false;
}

function addImportBindings(sourceFile: ts.SourceFile, imports: Map<string, ImportBinding>) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const moduleSpecifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) continue;
    const source = moduleSpecifier.text;
    const clause = statement.importClause;
    if (!clause) continue;

    if (clause.name) {
      imports.set(clause.name.text, { imported: "default", source });
    }

    const namedBindings = clause.namedBindings;
    if (!namedBindings) continue;

    if (ts.isNamespaceImport(namedBindings)) {
      imports.set(namedBindings.name.text, { imported: "*", source });
      continue;
    }

    for (const element of namedBindings.elements) {
      imports.set(element.name.text, {
        imported: element.propertyName?.text ?? element.name.text,
        source,
      });
    }
  }
}

function containsJsx(node: ts.Node): boolean {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
    return true;
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && containsJsx(child)) found = true;
  });
  return found;
}

function analyzeFile(file: string): FileAnalysis {
  const source = fs.readFileSync(file, "utf-8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const imports = new Map<string, ImportBinding>();
  const jsxComponents = new Set<string>();
  const jsxUsages: JsxComponentUsage[] = [];
  const rawUsages: RawUsage[] = [];
  const declaredComponents = new Set<string>();

  addImportBindings(sourceFile, imports);

  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      /^[A-Z]/.test(node.name.text) &&
      node.body &&
      containsJsx(node.body)
    ) {
      declaredComponents.add(node.name.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const initializer = node.initializer;
      if (/^[A-Z]/.test(node.name.text) && initializer && containsJsx(initializer)) {
        declaredComponents.add(node.name.text);
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = jsxTagNameText(node.tagName);
      const line = getLine(sourceFile, node);
      if (/^[a-z]/.test(tag)) {
        rawUsages.push({ tag, kind: "jsx", line });
        const role = jsxRoleValue(node.attributes);
        if (role) rawUsages.push({ tag: role, kind: "role", line });
      } else {
        jsxComponents.add(tag);
        jsxUsages.push({
          tag,
          line,
          attrs: collectJsxAttrs(node.attributes, sourceFile),
          spreadLines: node.attributes.properties
            .filter(ts.isJsxSpreadAttribute)
            .map((spread) => getLine(sourceFile, spread)),
        });
      }
    }

    if (ts.isCallExpression(node) && isReactCreateElement(node, imports)) {
      const [firstArg] = node.arguments;
      if (firstArg && ts.isStringLiteral(firstArg)) {
        rawUsages.push({
          tag: firstArg.text,
          kind: "createElement",
          line: getLine(sourceFile, node),
        });
      }
      if (firstArg && ts.isIdentifier(firstArg)) {
        jsxComponents.add(firstArg.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    imports,
    jsxComponents,
    jsxUsages,
    rawUsages,
    declaredComponents: Array.from(declaredComponents),
  };
}

function importedLocalNames(analysis: FileAnalysis, resolution: ResolutionEntry): Set<string> {
  const allowed = allowedSources(resolution);
  const locals = new Set<string>();

  for (const [localName, binding] of analysis.imports) {
    if (!allowed.has(binding.source)) continue;
    if (binding.imported === resolution.codeComponent || binding.imported === "default") {
      locals.add(localName);
    }
    if (binding.imported === "*") {
      locals.add(`${localName}.${resolution.codeComponent}`);
    }
  }

  return locals;
}

function usesResolution(analysis: FileAnalysis, resolution: ResolutionEntry): boolean {
  for (const localName of importedLocalNames(analysis, resolution)) {
    if (analysis.jsxComponents.has(localName)) return true;
  }
  return false;
}

function formatRawUsage(usage: RawUsage): string {
  if (usage.kind === "role") return `role="${usage.tag}" at line ${usage.line}`;
  if (usage.kind === "createElement")
    return `React.createElement("${usage.tag}") at line ${usage.line}`;
  return `<${usage.tag}> at line ${usage.line}`;
}

function propMapPath(repoComponent: string): string {
  return path.join(PROP_MAP_DIR, `${repoComponent}.json`);
}

function stripFigmaPropId(name: string): string {
  return name.replace(/#\d+:\d+$/, "").trim();
}

function codeValuesFromEntry(entry: PropMapMapping): Set<string> {
  const values = new Set<string>();
  if (entry.valueMap) {
    for (const mapped of Object.values(entry.valueMap)) {
      if (mapped === null || mapped === undefined) continue;
      values.add(String(mapped));
    }
  }
  if (entry.valueOverrides) {
    for (const override of Object.values(entry.valueOverrides)) {
      for (const mapped of Object.values(override)) {
        if (mapped === null || mapped === undefined) continue;
        values.add(String(mapped));
      }
    }
  }
  return values;
}

function figmaKeysFromEntry(entry: PropMapMapping): Set<string> {
  const keys = new Set<string>();
  if (entry.mappingKind === "direct" && entry.figmaType === "BOOLEAN" && !entry.valueMap) {
    keys.add("False");
    keys.add("True");
  }
  if (entry.valueMap) {
    for (const key of Object.keys(entry.valueMap)) keys.add(key);
  }
  if (entry.valueOverrides) {
    for (const key of Object.keys(entry.valueOverrides)) keys.add(key);
  }
  return keys;
}

function indexPropMap(mapFile: PropMapFile): PropMapIndex {
  const figmaNames = new Map<string, { reactProp: string | null; codeValues: Set<string> }>();
  const mappedReactProps = new Set<string>();

  for (const entry of mapFile.groups.flatMap((group) => group.mappings)) {
    const rawName = entry.figmaProp;
    const figmaName = stripFigmaPropId(rawName);
    const kind = entry.mappingKind;
    let reactProp: string | null = null;

    if (kind === "direct") {
      reactProp = entry.reactProp ?? null;
    } else if (kind === "override" && entry.valueOverrides) {
      for (const override of Object.values(entry.valueOverrides)) {
        for (const propName of Object.keys(override)) mappedReactProps.add(propName);
      }
    }

    if (reactProp) mappedReactProps.add(reactProp);

    const indexed = { reactProp, codeValues: codeValuesFromEntry(entry) };
    figmaNames.set(figmaName, indexed);
    figmaNames.set(rawName, indexed);
  }

  return { figmaNames, mappedReactProps };
}

function figmaValueKeysForReactProp(mapFile: PropMapFile, reactProp: string): Set<string> {
  const keys = new Set<string>();
  for (const entry of mapFile.groups.flatMap((group) => group.mappings)) {
    const kind = entry.mappingKind;
    if (kind === "direct" && entry.reactProp === reactProp) {
      for (const key of figmaKeysFromEntry(entry)) keys.add(key);
    }
    if (kind === "override" && entry.valueOverrides) {
      for (const [figmaValue, override] of Object.entries(entry.valueOverrides)) {
        if (reactProp in override) keys.add(figmaValue);
      }
    }
  }
  return keys;
}

function readPropMapV2(mapPath: string, repoComponent: string, reasons: string[]) {
  let mapFile: PropMapFile;
  try {
    mapFile = JSON.parse(fs.readFileSync(mapPath, "utf-8")) as PropMapFile;
  } catch {
    reasons.push(`prop-map unreadable JSON for ${repoComponent} (${mapPath})`);
    return null;
  }
  if (mapFile.schemaVersion !== 2) {
    reasons.push(`unsupported prop-map schemaVersion for ${repoComponent} (${mapPath})`);
    return null;
  }
  if (mapFile.target?.component !== repoComponent || !Array.isArray(mapFile.groups)) {
    reasons.push(`prop-map target/groups invalid for ${repoComponent} (${mapPath})`);
    return null;
  }
  const validKinds = new Set(["direct", "override", "composition", "unmapped"]);
  const validGroups =
    mapFile.groups.length > 0 &&
    mapFile.groups.every(
      (group) =>
        Boolean(group.figmaNodeId && group.name) &&
        Array.isArray(group.mappings) &&
        group.mappings.length > 0 &&
        group.mappings.every(
          (mapping) =>
            Boolean(mapping.figmaProp && mapping.figmaType) && validKinds.has(mapping.mappingKind),
        ),
    );
  if (!validGroups) {
    reasons.push(`prop-map groups/mappings invalid for ${repoComponent} (${mapPath})`);
    return null;
  }
  const conflicts = propMapGroupConflicts(mapFile);
  if (conflicts.length > 0) {
    reasons.push(
      `prop-map group mappings conflict after name normalization for ${repoComponent} (${mapPath}): ${conflicts.join(", ")}`,
    );
    return null;
  }
  return mapFile;
}

function checkPropMapUsage(
  file: string,
  analysis: FileAnalysis,
  resolution: ResolutionEntry,
  reasons: string[],
) {
  if (resolution.kind !== "design-system") return;
  const mapPath = propMapPath(resolution.codeComponent);
  if (!fs.existsSync(mapPath)) return;

  const mapFile = readPropMapV2(mapPath, resolution.codeComponent, reasons);
  if (!mapFile) return;
  const index = indexPropMap(mapFile);
  const locals = importedLocalNames(analysis, resolution);

  for (const usage of analysis.jsxUsages) {
    if (!locals.has(usage.tag)) continue;

    if (usage.spreadLines.length > 0) {
      reasons.push(
        `unresolved JSX spread props on mapped component in ${file}:${usage.spreadLines.join(",")}; pass explicit validated props to <${usage.tag}>`,
      );
    }

    for (const attr of usage.attrs) {
      if (ALWAYS_ALLOWED_ATTRS.has(attr.name)) continue;
      if (attr.name.startsWith("data-") || attr.name.startsWith("aria-")) continue;
      if (attr.name.startsWith("on") && attr.name.length > 2) continue;

      const figmaHit = index.figmaNames.get(attr.name);
      if (figmaHit && figmaHit.reactProp && figmaHit.reactProp !== attr.name) {
        reasons.push(
          `figma prop name used as JSX attr in ${file}:${attr.line}; <${usage.tag} ${attr.name}=...> should use mapped reactProp "${figmaHit.reactProp}" from ${mapPath}`,
        );
        continue;
      }

      if (attr.value !== undefined && index.mappedReactProps.has(attr.name)) {
        const figmaValues = figmaValueKeysForReactProp(mapFile, attr.name);
        if (figmaValues.has(attr.value)) {
          const codeValues = [...index.figmaNames.values()]
            .filter((entry) => entry.reactProp === attr.name)
            .flatMap((entry) => [...entry.codeValues]);
          const hint =
            codeValues.length > 0
              ? ` (expected code value like ${codeValues.slice(0, 3).join("/")})`
              : "";
          reasons.push(
            `figma variant value used on mapped prop in ${file}:${attr.line}; <${usage.tag} ${attr.name}="${attr.value}"> looks like Figma value, not code value${hint}`,
          );
        }
      }
    }
  }
}

function isDesignSystemResolution(resolution: ResolutionEntry) {
  return resolution.kind === "design-system";
}

function expectedImportPath(targetFile: string): string {
  return normalizeImportPath(targetFile.replace(/\.[cm]?[jt]sx?$/, ""));
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentHash(value: unknown): string {
  return `sha256:${crypto.createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}

function validateInventoryEvidence(
  artifact: ComponentResolutionArtifact,
  reasons: string[],
): InventoryFile | null {
  const evidence = artifact.inventoryEvidence;
  if (!evidence) return null;
  if (!fs.existsSync(evidence.filePath)) {
    reasons.push(`inventory evidence missing: ${evidence.filePath}`);
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(evidence.filePath, "utf-8"));
  } catch {
    reasons.push(`inventory evidence unreadable JSON: ${evidence.filePath}`);
    return null;
  }
  const parsed = inventoryFileSchema.safeParse(raw);
  if (!parsed.success) {
    reasons.push(`inventory evidence invalid: ${evidence.filePath}`);
    return null;
  }
  const inventory: InventoryFile = parsed.data;
  const { contentHash: declaredHash, ...payload } = inventory;
  const actualHash = contentHash(payload);
  if (declaredHash !== actualHash || evidence.contentHash !== actualHash) {
    reasons.push(
      `inventory contentHash mismatch: artifact=${evidence.contentHash} file=${declaredHash} actual=${actualHash}`,
    );
  }
  if (inventory.fileKey !== artifact.source.fileKey) {
    reasons.push(
      `inventory fileKey mismatch: inventory=${inventory.fileKey} artifact=${artifact.source.fileKey}`,
    );
  }
  const expectedSources = artifact.source.nodes.map((node) => `${node.id}:${node.nodeId}`).sort();
  const inventorySources = inventory.sourceNodes.map((node) => `${node.id}:${node.nodeId}`).sort();
  if (JSON.stringify(expectedSources) !== JSON.stringify(inventorySources)) {
    reasons.push("inventory sourceNodes do not match component-resolution source.nodes");
  }

  const inventoryItems = new Map(inventory.items.map((item) => [item.nodeId, item]));
  const classified = new Set<string>();
  for (const detected of artifact.detectedComponents) {
    const item = inventoryItems.get(detected.nodeId);
    if (!item) {
      reasons.push(`detected component absent from inventory evidence: ${detected.nodeId}`);
      continue;
    }
    if (item.sourceId !== detected.sourceId || item.name !== detected.name) {
      reasons.push(
        `detected component identity mismatch for ${detected.nodeId}: inventory=${item.sourceId}/${item.name} artifact=${detected.sourceId}/${detected.name}`,
      );
    }
    classified.add(detected.nodeId);
  }
  for (const ignored of artifact.ignoredInventoryNodes ?? []) {
    const item = inventoryItems.get(ignored.nodeId);
    if (!item) {
      reasons.push(`ignored component absent from inventory evidence: ${ignored.nodeId}`);
      continue;
    }
    if (item.sourceId !== ignored.sourceId || item.name !== ignored.name) {
      reasons.push(
        `ignored component identity mismatch for ${ignored.nodeId}: inventory=${item.sourceId}/${item.name} artifact=${ignored.sourceId}/${ignored.name}`,
      );
    }
    if (
      item.nodeType !== ignored.nodeType ||
      item.componentId !== ignored.componentId ||
      item.componentName !== ignored.componentName
    ) {
      reasons.push(
        `ignored component raw identity mismatch for ${ignored.nodeId}: inventory=${item.nodeType}/${item.componentId}/${item.componentName} artifact=${ignored.nodeType}/${ignored.componentId}/${ignored.componentName}`,
      );
    }
    const canonicalName = item.componentName ?? item.name;
    if (primitiveRawTags[canonicalName] || semanticRoleComponents[canonicalName]) {
      reasons.push(
        `known design-system component cannot be ignored: ${ignored.nodeId} (${canonicalName})`,
      );
    }
    if (ignored.classification === "decorative") {
      const asset = artifact.assets.find(
        (entry) =>
          entry.figmaNode === ignored.nodeId && entry.filePath === ignored.replacement.filePath,
      );
      if (!asset) {
        reasons.push(
          `decorative ignored node requires matching asset evidence: ${ignored.nodeId}/${ignored.replacement.filePath}`,
        );
      }
    }
    if (classified.has(ignored.nodeId)) {
      reasons.push(`inventory node classified more than once: ${ignored.nodeId}`);
    }
    classified.add(ignored.nodeId);
  }
  for (const item of inventory.items) {
    if (!classified.has(item.nodeId)) {
      reasons.push(
        `inventory node lacks detected/ignored classification: ${item.nodeId} (${item.name})`,
      );
    }
  }
  const treeKeys = new Set<string>();
  for (const node of inventory.nodeTree) {
    const key = `${node.sourceId}:${node.nodeId}`;
    if (treeKeys.has(key)) reasons.push(`inventory nodeTree duplicates node: ${key}`);
    treeKeys.add(key);
  }
  for (const node of inventory.nodeTree) {
    if (node.parentNodeId && !treeKeys.has(`${node.sourceId}:${node.parentNodeId}`)) {
      reasons.push(
        `inventory nodeTree parent missing: ${node.sourceId}:${node.nodeId} -> ${node.parentNodeId}`,
      );
    }
  }
  return inventory;
}

function isInventoryDescendant(
  inventory: InventoryFile,
  sourceId: string,
  nodeId: string,
  ancestorNodeId: string,
): boolean {
  const parents = new Map(
    inventory.nodeTree
      .filter((node) => node.sourceId === sourceId)
      .map((node) => [node.nodeId, node.parentNodeId]),
  );
  const visited = new Set<string>();
  let current = parents.get(nodeId);
  while (current && !visited.has(current)) {
    if (current === ancestorNodeId) return true;
    visited.add(current);
    current = parents.get(current);
  }
  return false;
}

function validateClassificationEvidence(
  artifact: ComponentResolutionArtifact,
  reasons: string[],
): z.infer<typeof classificationFileSchema> | null {
  const evidence = artifact.classificationEvidence;
  if (!evidence) return null;
  if (!fs.existsSync(evidence.filePath)) {
    reasons.push(`classification evidence missing: ${evidence.filePath}`);
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(evidence.filePath, "utf-8"));
  } catch {
    reasons.push(`classification evidence unreadable JSON: ${evidence.filePath}`);
    return null;
  }
  const parsed = classificationFileSchema.safeParse(raw);
  if (!parsed.success) {
    reasons.push(`classification evidence invalid: ${evidence.filePath}`);
    return null;
  }
  const classification = parsed.data;
  const { contentHash: declaredHash, ...payload } = classification;
  const actualHash = contentHash(payload);
  if (declaredHash !== actualHash || evidence.contentHash !== actualHash) {
    reasons.push(
      `classification contentHash mismatch: artifact=${evidence.contentHash} file=${declaredHash} actual=${actualHash}`,
    );
  }
  if (classification.fileKey !== artifact.source.fileKey) {
    reasons.push("classification fileKey does not match implementation source");
  }
  const expectedSources = artifact.source.nodes.map((node) => `${node.id}:${node.nodeId}`).sort();
  const actualSources = classification.sourceNodes
    .map((node) => `${node.id}:${node.nodeId}`)
    .sort();
  if (JSON.stringify(expectedSources) !== JSON.stringify(actualSources)) {
    reasons.push("classification sourceNodes do not match implementation source.nodes");
  }
  if (
    classification.targetKind !== "screen" ||
    classification.routeSkill !== "figma-implement-screen"
  ) {
    reasons.push(
      `classification routes to ${classification.routeSkill ?? classification.targetKind}; artifact target is ${artifact.target.kind}`,
    );
  }
  return classification;
}

function validateArtifactContract(artifact: ComponentResolutionArtifact, reasons: string[]): void {
  const classification = validateClassificationEvidence(artifact, reasons);
  const inventory = validateInventoryEvidence(artifact, reasons);
  let layoutMap: LayoutMap | null = null;
  try {
    layoutMap = layoutMapSchema.parse(JSON.parse(fs.readFileSync(LAYOUT_MAP_FILE, "utf-8")));
    const duplicates = layoutMapDuplicateIdentities(layoutMap);
    if (duplicates.length > 0) {
      reasons.push(`layout registry has duplicate Figma identities: ${duplicates.join(", ")}`);
      layoutMap = null;
    }
  } catch {
    reasons.push(`layout registry missing or invalid: ${LAYOUT_MAP_FILE}`);
  }
  if (classification && inventory) {
    if (classification.version !== inventory.version) {
      reasons.push("inventory version does not match classification");
    }
    if (classification.lastModified !== inventory.lastModified) {
      reasons.push("inventory lastModified does not match classification");
    }
  }
  const requestedSources = new Map<string, string>();
  const requestedNodeIds = new Set<string>();
  for (const node of artifact.source.nodes) {
    if (requestedSources.has(node.id)) {
      reasons.push(`duplicate source id: ${node.id}`);
    }
    if (requestedNodeIds.has(node.nodeId)) {
      reasons.push(`duplicate source nodeId: ${node.nodeId}`);
    }
    requestedSources.set(node.id, node.nodeId);
    requestedNodeIds.add(node.nodeId);
  }

  const detectedComponents = new Map<
    string,
    ComponentResolutionArtifact["detectedComponents"][number]
  >();
  for (const detected of artifact.detectedComponents) {
    if (!requestedSources.has(detected.sourceId)) {
      reasons.push(
        `detected component ${detected.nodeId} references unknown sourceId: ${detected.sourceId}`,
      );
    }
    if (detectedComponents.has(detected.nodeId)) {
      reasons.push(`duplicate detected component nodeId: ${detected.nodeId}`);
    }
    detectedComponents.set(detected.nodeId, detected);
    const item = inventory?.items.find((candidate) => candidate.nodeId === detected.nodeId);
    if (item && layoutMap) {
      const registered = layoutMap.mappings.some(
        (mapping) =>
          mapping.fileKey === artifact.source.fileKey &&
          mapping.componentId === item.componentId &&
          mapping.componentName === item.componentName,
      );
      const expectedKind = registered ? "layout" : "design-system";
      if (detected.kind !== expectedKind) {
        reasons.push(
          `detected component kind must come from ${LAYOUT_MAP_FILE}: ${detected.nodeId} expected=${expectedKind} actual=${detected.kind}`,
        );
      }
    }
  }

  const ignoredInventoryNodes = new Set<string>();
  for (const ignored of artifact.ignoredInventoryNodes ?? []) {
    if (!requestedSources.has(ignored.sourceId)) {
      reasons.push(
        `ignored inventory node ${ignored.nodeId} references unknown sourceId: ${ignored.sourceId}`,
      );
    }
    if (detectedComponents.has(ignored.nodeId)) {
      reasons.push(`inventory node appears in both detected and ignored: ${ignored.nodeId}`);
    }
    if (ignoredInventoryNodes.has(ignored.nodeId)) {
      reasons.push(`duplicate ignored inventory node: ${ignored.nodeId}`);
    }
    ignoredInventoryNodes.add(ignored.nodeId);
  }

  const implementationFiles = new Set<string>();
  for (const file of artifact.implementationFiles) {
    if (implementationFiles.has(file)) reasons.push(`duplicate implementation file: ${file}`);
    implementationFiles.add(file);
    if (!fs.existsSync(file)) reasons.push(`implementation file missing: ${file}`);
  }

  const resolvedComponents = new Set<string>();
  const resolvedFigmaNodes = new Set<string>();
  for (const resolution of artifact.resolved) {
    if (resolvedComponents.has(resolution.codeComponent)) {
      reasons.push(`duplicate resolved code component: ${resolution.codeComponent}`);
    }
    resolvedComponents.add(resolution.codeComponent);
    if (resolution.kind === "layout" && inventory && layoutMap) {
      for (const figmaNode of resolution.figmaNodes) {
        const item = inventory.items.find((candidate) => candidate.nodeId === figmaNode);
        const registered = layoutMap.mappings.some(
          (mapping) =>
            mapping.fileKey === artifact.source.fileKey &&
            mapping.componentId === item?.componentId &&
            mapping.componentName === item?.componentName &&
            mapping.codeComponent === resolution.codeComponent &&
            mapping.importPath === resolution.importPath,
        );
        if (!registered) {
          reasons.push(
            `layout resolution lacks exact ${LAYOUT_MAP_FILE} mapping: ${figmaNode} -> ${resolution.codeComponent}`,
          );
        }
      }
    }
    for (const figmaNode of resolution.figmaNodes) {
      const detected = detectedComponents.get(figmaNode);
      if (!detected) {
        reasons.push(
          `resolved Figma node missing from detectedComponents: ${figmaNode} (${resolution.codeComponent})`,
        );
      } else if (detected.kind !== resolution.kind) {
        reasons.push(
          `resolved Figma node kind mismatch: ${figmaNode} inventory=${detected.kind} resolution=${resolution.kind}`,
        );
      }
      if (resolvedFigmaNodes.has(figmaNode)) {
        reasons.push(`Figma node resolved more than once: ${figmaNode}`);
      }
      resolvedFigmaNodes.add(figmaNode);
    }
  }

  const unresolvedFigmaNodes = new Set<string>();
  for (const unresolved of artifact.unresolved) {
    if (!detectedComponents.has(unresolved.figmaNode)) {
      reasons.push(
        `unresolved Figma node missing from detectedComponents: ${unresolved.figmaNode}`,
      );
    }
    if (resolvedFigmaNodes.has(unresolved.figmaNode)) {
      reasons.push(`Figma node appears in both resolved and unresolved: ${unresolved.figmaNode}`);
    }
    if (unresolvedFigmaNodes.has(unresolved.figmaNode)) {
      reasons.push(`duplicate unresolved Figma node: ${unresolved.figmaNode}`);
    }
    unresolvedFigmaNodes.add(unresolved.figmaNode);
  }

  for (const detected of detectedComponents.values()) {
    if (!resolvedFigmaNodes.has(detected.nodeId) && !unresolvedFigmaNodes.has(detected.nodeId)) {
      reasons.push(
        `detected component lacks resolved/unresolved coverage: ${detected.nodeId} (${detected.name})`,
      );
    }
  }

  for (const composition of artifact.screenCompositions) {
    if (!implementationFiles.has(composition.filePath)) {
      reasons.push(
        `screen composition file must be listed in implementationFiles: ${composition.filePath}`,
      );
    }
    if (!fs.existsSync(composition.filePath)) {
      reasons.push(`screen composition file missing: ${composition.filePath}`);
    }
  }

  for (const entry of artifact.entryComponents ?? []) {
    if (!implementationFiles.has(entry.filePath)) {
      reasons.push(`entry component file must be listed in implementationFiles: ${entry.filePath}`);
    }
    if (!fs.existsSync(entry.filePath)) {
      reasons.push(`entry component file missing: ${entry.filePath}`);
    }
  }

  for (const asset of artifact.assets) {
    if (!fs.existsSync(asset.filePath)) reasons.push(`asset file missing: ${asset.filePath}`);
  }

  if (artifact.visualContracts.length === 0) {
    reasons.push("screen target requires at least one visualContract");
    return;
  }

  const contractIds = new Set<string>();
  const outDirs = new Set<string>();
  const primaryCountBySourceId = new Map<string, number>();

  for (const contract of artifact.visualContracts) {
    if (contractIds.has(contract.id)) {
      reasons.push(`duplicate visual contract id: ${contract.id}`);
    }
    contractIds.add(contract.id);

    if (outDirs.has(contract.outDir)) {
      reasons.push(`duplicate visual contract outDir: ${contract.outDir}`);
    }
    outDirs.add(contract.outDir);

    const expectedContractId =
      contract.scope === "page"
        ? `${contract.sourceId}.page`
        : `${contract.sourceId}.region.${contract.region}`;
    if (contract.id !== expectedContractId) {
      reasons.push(
        `visual contract id must be "${expectedContractId}" for its source/scope: ${contract.id}`,
      );
    }

    const expectedOutDirSuffix =
      contract.scope === "page"
        ? `${contract.sourceId}/page`
        : `${contract.sourceId}/regions/${contract.region}`;
    if (!path.posix.normalize(contract.outDir).endsWith(`/${expectedOutDirSuffix}`)) {
      reasons.push(
        `visual contract outDir must end with "${expectedOutDirSuffix}": ${contract.outDir}`,
      );
    }

    const requestedNodeId = requestedSources.get(contract.sourceId);
    if (!requestedNodeId) {
      reasons.push(
        `visual contract ${contract.id} references unknown sourceId: ${contract.sourceId}`,
      );
    } else if (requestedNodeId !== contract.sourceNodeId) {
      reasons.push(
        `visual contract ${contract.id} sourceNodeId ${contract.sourceNodeId} does not match source ${contract.sourceId} node ${requestedNodeId}`,
      );
    }

    if (contract.role === "primary") {
      primaryCountBySourceId.set(
        contract.sourceId,
        (primaryCountBySourceId.get(contract.sourceId) ?? 0) + 1,
      );
    }
    if (contract.role === "supplemental" && contract.scope !== "page") {
      reasons.push(`supplemental visual contract must use scope=page: ${contract.id}`);
    }
    if (contract.scope === "page" && contract.goldNodeId !== contract.sourceNodeId) {
      reasons.push(`page visual contract goldNodeId must equal sourceNodeId: ${contract.id}`);
    }
    if (
      contract.scope === "region" &&
      inventory &&
      !isInventoryDescendant(
        inventory,
        contract.sourceId,
        contract.goldNodeId,
        contract.sourceNodeId,
      )
    ) {
      reasons.push(
        `region visual contract goldNodeId must be a visible descendant of sourceNodeId: ${contract.id}`,
      );
    }
  }

  for (const sourceId of requestedSources.keys()) {
    const count = primaryCountBySourceId.get(sourceId) ?? 0;
    if (count !== 1) {
      reasons.push(
        `source ${sourceId} requires exactly one primary visualContract; found ${count}`,
      );
    }
  }
}

function main() {
  const args = parseArgs();
  if (!args.artifact) {
    fail([
      "internal usage: figma-gate-screen-components-internal.ts --artifact <screen-implementation.json>",
    ]);
  }

  const artifactPath = path.resolve(args.artifact);
  const artifact = readArtifact(artifactPath);
  const reasons: string[] = [];
  validateArtifactContract(artifact, reasons);

  if (artifact.unresolved.length > 0) {
    reasons.push(
      `unresolved node(s): ${artifact.unresolved
        .map((entry) => `${entry.figmaNode} (${entry.reason})`)
        .join(", ")}`,
    );
  }

  for (const resolution of artifact.resolved) {
    if (!isDesignSystemResolution(resolution)) continue;
    const mapFilePath = propMapPath(resolution.codeComponent);
    if (!fs.existsSync(mapFilePath)) {
      reasons.push(
        `prop-map missing for ${resolution.codeComponent} (${mapFilePath}); run figma-props-sync`,
      );
      continue;
    }
    const mapFile = readPropMapV2(mapFilePath, resolution.codeComponent, reasons);
    if (!mapFile) continue;
    const expected = expectedImportPath(mapFile.target.file);
    if (normalizeImportPath(resolution.importPath) !== expected) {
      reasons.push(
        `importPath mismatch for ${resolution.codeComponent}; artifact=${resolution.importPath}, prop-map target=${expected}`,
      );
    }
  }

  const files = artifact.implementationFiles.filter((file) => file.endsWith(".tsx"));
  const ownershipKey = (filePath: string, componentName: string) =>
    `${filePath.replace(/\\/g, "/")}#${componentName}`;
  const approvedCustom = new Set(
    artifact.screenCompositions.map((entry) => ownershipKey(entry.filePath, entry.componentName)),
  );
  const approvedEntries = new Set(
    (artifact.entryComponents ?? []).map((entry) =>
      ownershipKey(entry.filePath, entry.componentName),
    ),
  );
  const seenOwnedComponents = new Set<string>();
  const resolvedComponents = new Set(artifact.resolved.map((entry) => entry.codeComponent));
  const seenResolvedUsage = new Set<string>();
  const seenIgnoredReplacement = new Set<string>();

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const analysis = analyzeFile(file);
    const normalizedFile = file.replace(/\\/g, "/");
    for (const ignored of artifact.ignoredInventoryNodes ?? []) {
      if (ignored.classification !== "ui-icon" && ignored.classification !== "brand-icon") continue;
      const expectedSource =
        ignored.classification === "ui-icon" ? "lucide-react" : "@icons-pack/react-simple-icons";
      for (const [localName, binding] of analysis.imports) {
        if (
          binding.source === expectedSource &&
          binding.imported === ignored.replacement.importName &&
          analysis.jsxComponents.has(localName)
        ) {
          seenIgnoredReplacement.add(ignored.nodeId);
        }
      }
    }

    for (const componentName of analysis.declaredComponents) {
      const key = ownershipKey(normalizedFile, componentName);
      if (approvedCustom.has(key) || approvedEntries.has(key)) {
        seenOwnedComponents.add(key);
        continue;
      }
      if (artifact.entryComponents) {
        reasons.push(
          `local React component lacks entryComponents/screenCompositions ownership: ${componentName} in ${file}`,
        );
      } else if (
        normalizedFile.includes("src/features/") &&
        normalizedFile.includes("/components/") &&
        !resolvedComponents.has(componentName)
      ) {
        reasons.push(`custom component not approved: ${componentName} in ${file}`);
      }
    }

    if (artifact.entryComponents) {
      for (const approved of [...approvedCustom, ...approvedEntries]) {
        if (approved.startsWith(`${normalizedFile}#`) && !seenOwnedComponents.has(approved)) {
          const componentName = approved.slice(approved.lastIndexOf("#") + 1);
          reasons.push(
            `declared ownership component not found as local React component: ${componentName} in ${file}`,
          );
        }
      }
    }

    for (const resolution of artifact.resolved) {
      if (usesResolution(analysis, resolution)) {
        seenResolvedUsage.add(resolution.codeComponent);
        if (isDesignSystemResolution(resolution)) {
          checkPropMapUsage(file, analysis, resolution, reasons);
        }
      }

      if (!isDesignSystemResolution(resolution)) continue;
      const rawTags = new Set([
        ...(primitiveRawTags[resolution.codeComponent] ?? []),
        ...(semanticRoleComponents[resolution.codeComponent] ?? []),
      ]);
      if (rawTags.size === 0) continue;

      const matchingRaw = analysis.rawUsages.filter((usage) => rawTags.has(usage.tag));
      if (matchingRaw.length > 0) {
        reasons.push(
          `raw primitive markup in ${file}; ${matchingRaw.map(formatRawUsage).join(", ")}; resolved ${resolution.figmaNodes.join("/")} must use ${resolution.codeComponent} from ${resolution.importPath} (decision=${resolution.decision})`,
        );
      }
    }
  }

  for (const resolution of artifact.resolved) {
    if (!seenResolvedUsage.has(resolution.codeComponent)) {
      reasons.push(
        `resolved component not used in implementationFiles: ${resolution.codeComponent}`,
      );
    }
  }
  for (const ignored of artifact.ignoredInventoryNodes ?? []) {
    if (
      (ignored.classification === "ui-icon" || ignored.classification === "brand-icon") &&
      !seenIgnoredReplacement.has(ignored.nodeId)
    ) {
      reasons.push(
        `ignored ${ignored.classification} replacement not used in implementationFiles: ${ignored.nodeId}/${ignored.replacement.importName}`,
      );
    }
  }

  if (reasons.length > 0) {
    fail(reasons);
  }

  console.log("PASS");
  console.log(`artifact: ${path.relative(process.cwd(), artifactPath)}`);
  console.log(`name: ${artifact.name}`);
  console.log(`resolved: ${artifact.resolved.length}`);
  console.log(`implementation-files: ${artifact.implementationFiles.length}`);
  console.log(`tsx-files-scanned: ${files.length}`);
  console.log(`visual-contracts: ${artifact.visualContracts.length}`);
  console.log("parser: typescript-ast");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
