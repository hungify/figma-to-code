#!/usr/bin/env tsx
import * as fs from "node:fs";
import * as path from "node:path";

import ts from "typescript";
import { z } from "zod";

interface Args {
  artifact?: string;
}

const PROP_MAP_DIR = ".figma/prop-map";
const FIGMA_NODE_ID = /^\d+:\d+$/;
const REPO_RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+/;
const FORBIDDEN_PAGE_ESCAPE = /alpha|shadow|too hard|reference only|skip|dodge/i;
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
    intent: z.string().min(1),
    nodeId: z.string().regex(FIGMA_NODE_ID, "expected Figma node id like 1:2"),
  })
  .strict();

const designSystemResolutionSchema = z
  .object({
    kind: z.literal("design-system"),
    figmaNodes: z.array(z.string().min(1)).min(1),
    codeComponent: z.string().min(1),
    importPath: z.string().min(1),
    decision: z.enum(["reuse", "create"]),
  })
  .strict();

const layoutResolutionSchema = z
  .object({
    kind: z.literal("layout"),
    figmaNodes: z.array(z.string().min(1)).min(1),
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
  intent: z.string().min(1),
  sourceIntent: z.string().min(1),
  sourceNodeId: z.string().regex(FIGMA_NODE_ID, "expected Figma node id like 1:2"),
  nodeId: z.string().regex(FIGMA_NODE_ID, "expected Figma node id like 1:2"),
  purpose: z.enum(["gate", "supplemental"]),
  viewport: viewportSchema,
  outDir: z
    .string()
    .regex(REPO_RELATIVE_PATH, "expected repo-relative path")
    .startsWith(".figma/artifacts/"),
};

const componentVisualContractSchema = z
  .object({
    ...visualContractBase,
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
    profile: z.literal("page"),
    pageReason: z.string().min(1),
  })
  .strict();

const componentResolutionArtifactSchema = z
  .object({
    schemaVersion: z.literal(2),
    name: z.string().min(1),
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("screen"), route: z.string().startsWith("/") }).strict(),
      z.object({ kind: z.literal("design-system") }).strict(),
    ]),
    source: z
      .object({
        fileKey: z.string().min(1),
        nodes: z.array(requestedNodeSchema).min(1),
      })
      .strict(),
    implementationFiles: z
      .array(z.string().regex(REPO_RELATIVE_PATH, "expected repo-relative path"))
      .min(1),
    resolved: z
      .array(z.discriminatedUnion("kind", [designSystemResolutionSchema, layoutResolutionSchema]))
      .min(1),
    unresolved: z.array(
      z
        .object({
          figmaNode: z.string().min(1),
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
      z.discriminatedUnion("profile", [componentVisualContractSchema, pageVisualContractSchema]),
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
}

interface FileAnalysis {
  imports: Map<string, ImportBinding>;
  jsxComponents: Set<string>;
  jsxUsages: JsxComponentUsage[];
  rawUsages: RawUsage[];
  exportedComponents: string[];
}

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

function addExportedComponents(sourceFile: ts.SourceFile, exportedComponents: Set<string>) {
  for (const statement of sourceFile.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const isExported = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) continue;

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      exportedComponents.add(statement.name.text);
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && /^[A-Z]/.test(declaration.name.text)) {
          exportedComponents.add(declaration.name.text);
        }
      }
    }
  }
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
  const exportedComponents = new Set<string>();

  addImportBindings(sourceFile, imports);
  addExportedComponents(sourceFile, exportedComponents);

  function visit(node: ts.Node) {
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
    exportedComponents: Array.from(exportedComponents),
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

function validateArtifactContract(artifact: ComponentResolutionArtifact, reasons: string[]): void {
  const requestedIntents = new Map<string, string>();
  const requestedNodeIds = new Set<string>();
  for (const node of artifact.source.nodes) {
    if (requestedIntents.has(node.intent)) {
      reasons.push(`duplicate source intent: ${node.intent}`);
    }
    if (requestedNodeIds.has(node.nodeId)) {
      reasons.push(`duplicate source nodeId: ${node.nodeId}`);
    }
    requestedIntents.set(node.intent, node.nodeId);
    requestedNodeIds.add(node.nodeId);
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
    for (const figmaNode of resolution.figmaNodes) {
      if (resolvedFigmaNodes.has(figmaNode)) {
        reasons.push(`Figma node resolved more than once: ${figmaNode}`);
      }
      resolvedFigmaNodes.add(figmaNode);
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

  for (const asset of artifact.assets) {
    if (!fs.existsSync(asset.filePath)) reasons.push(`asset file missing: ${asset.filePath}`);
  }

  if (artifact.target.kind === "design-system") {
    if (artifact.visualContracts.length > 0) {
      reasons.push("design-system target must not declare screen fidelity visualContracts");
    }
    if (artifact.screenCompositions.length > 0) {
      reasons.push("design-system target must not declare screenCompositions");
    }
    return;
  }

  if (artifact.visualContracts.length === 0) {
    reasons.push("screen target requires at least one visualContract");
    return;
  }

  const visualIntents = new Set<string>();
  const outDirs = new Set<string>();
  const gateCountBySourceIntent = new Map<string, number>();

  for (const contract of artifact.visualContracts) {
    if (visualIntents.has(contract.intent)) {
      reasons.push(`duplicate visual contract intent: ${contract.intent}`);
    }
    visualIntents.add(contract.intent);

    if (outDirs.has(contract.outDir)) {
      reasons.push(`duplicate visual contract outDir: ${contract.outDir}`);
    }
    outDirs.add(contract.outDir);
    if (path.posix.basename(contract.outDir) !== contract.intent) {
      reasons.push(
        `visual contract outDir must end with its intent "${contract.intent}": ${contract.outDir}`,
      );
    }

    const requestedNodeId = requestedIntents.get(contract.sourceIntent);
    if (!requestedNodeId) {
      reasons.push(
        `visual contract ${contract.intent} references unknown sourceIntent: ${contract.sourceIntent}`,
      );
    } else if (requestedNodeId !== contract.sourceNodeId) {
      reasons.push(
        `visual contract ${contract.intent} sourceNodeId ${contract.sourceNodeId} does not match requested ${contract.sourceIntent} node ${requestedNodeId}`,
      );
    }

    if (contract.purpose === "gate") {
      gateCountBySourceIntent.set(
        contract.sourceIntent,
        (gateCountBySourceIntent.get(contract.sourceIntent) ?? 0) + 1,
      );
    }
    if (contract.purpose === "supplemental" && contract.profile !== "page") {
      reasons.push(`supplemental visual contract must use profile=page: ${contract.intent}`);
    }
    if (contract.profile === "page" && FORBIDDEN_PAGE_ESCAPE.test(contract.pageReason)) {
      reasons.push(
        `forbidden pageReason escape in visual contract ${contract.intent}: ${contract.pageReason}`,
      );
    }
  }

  for (const intent of requestedIntents.keys()) {
    const count = gateCountBySourceIntent.get(intent) ?? 0;
    if (count !== 1) {
      reasons.push(
        `source intent ${intent} requires exactly one gate visualContract; found ${count}`,
      );
    }
  }
}

function main() {
  const args = parseArgs();
  if (!args.artifact) {
    fail(["usage: figma-gate-components.ts --artifact <component-resolution.json>"]);
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
  const approvedCustom = new Set(artifact.screenCompositions.map((entry) => entry.componentName));
  const resolvedComponents = new Set(artifact.resolved.map((entry) => entry.codeComponent));
  const seenResolvedUsage = new Set<string>();

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const analysis = analyzeFile(file);
    const normalizedFile = file.replace(/\\/g, "/");

    if (normalizedFile.includes("src/features/") && normalizedFile.includes("/components/")) {
      for (const componentName of analysis.exportedComponents) {
        if (!approvedCustom.has(componentName) && !resolvedComponents.has(componentName)) {
          reasons.push(`custom component not approved: ${componentName} in ${file}`);
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

main();
