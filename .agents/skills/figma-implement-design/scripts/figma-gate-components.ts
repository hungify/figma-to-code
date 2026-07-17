#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import ts from "typescript";

type Decision = "reuse" | "create" | "custom";
type MappingSource = "explicit" | "inferred";

interface ResolutionEntry {
  figmaNode: string;
  repoComponent: string;
  importPath: string;
  decision: Decision;
  source: string;
  mappingSource?: MappingSource;
}

interface CustomGeneratedEntry {
  componentName: string;
  filePath: string;
  customGeneratedReason: string;
}

interface ComponentResolutionArtifact {
  screen: string;
  source: {
    fileKey: string;
    nodeId: string;
  };
  resolved: ResolutionEntry[];
  unresolved: string[];
  customGenerated: CustomGeneratedEntry[];
}

interface Args {
  artifact?: string;
  files?: string[];
  requireUsage: boolean;
  requirePropMap: boolean;
  checkPropMapUsage: boolean;
}

const VALID_DECISIONS = new Set<Decision>(["reuse", "create", "custom"]);
const PROP_MAP_DIR = ".figma/prop-map";
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

interface PropMapEntry {
  mappingKind?: string;
  reactProp?: string | null;
  alternateReactProp?: string;
  valueMap?: Record<string, unknown>;
  valueOverrides?: Record<string, Record<string, unknown>>;
  note?: string;
}

interface PropMapFile {
  props: Record<string, PropMapEntry>;
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
  const parsed: Args = {
    requireUsage: false,
    requirePropMap: false,
    checkPropMapUsage: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--artifact") {
      parsed.artifact = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--files") {
      parsed.files = args[i + 1]
        ?.split(",")
        .map((file) => file.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === "--require-usage") {
      parsed.requireUsage = true;
      continue;
    }
    if (arg === "--require-prop-map") {
      parsed.requirePropMap = true;
      continue;
    }
    if (arg === "--check-prop-map-usage") {
      parsed.checkPropMapUsage = true;
    }
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

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const requiredKeys = ["screen", "source", "resolved", "unresolved", "customGenerated"];
  const missingKeys = requiredKeys.filter((key) => !(key in artifact));
  if (missingKeys.length > 0) {
    fail([`component resolution artifact missing key(s): ${missingKeys.join(", ")}`]);
  }

  return artifact;
}

function getChangedTsxFiles(): string[] {
  const names = new Set<string>();
  for (const command of ["git diff --name-only", "git diff --cached --name-only"]) {
    try {
      const output = execSync(command, { encoding: "utf-8" });
      for (const line of output.split("\n")) {
        const file = line.trim();
        if (file.endsWith(".tsx")) names.add(file);
      }
    } catch {
      // no git — use --files
    }
  }
  return Array.from(names);
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
    if (binding.imported === resolution.repoComponent || binding.imported === "default") {
      locals.add(localName);
    }
    if (binding.imported === "*") {
      locals.add(`${localName}.${resolution.repoComponent}`);
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

function codeValuesFromEntry(entry: PropMapEntry): Set<string> {
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

function figmaKeysFromEntry(entry: PropMapEntry): Set<string> {
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

  for (const [rawName, entry] of Object.entries(mapFile.props ?? {})) {
    const figmaName = stripFigmaPropId(rawName);
    const kind = entry.mappingKind;
    let reactProp: string | null = null;

    if (kind === "direct" || (!kind && typeof entry.reactProp === "string")) {
      reactProp = entry.reactProp ?? null;
    } else if (kind === "override" && entry.valueOverrides) {
      for (const override of Object.values(entry.valueOverrides)) {
        for (const propName of Object.keys(override)) mappedReactProps.add(propName);
      }
    }

    if (reactProp) mappedReactProps.add(reactProp);
    if (!kind && entry.alternateReactProp) mappedReactProps.add(entry.alternateReactProp);

    const indexed = { reactProp, codeValues: codeValuesFromEntry(entry) };
    figmaNames.set(figmaName, indexed);
    figmaNames.set(rawName, indexed);
  }

  return { figmaNames, mappedReactProps };
}

function figmaValueKeysForReactProp(mapFile: PropMapFile, reactProp: string): Set<string> {
  const keys = new Set<string>();
  for (const entry of Object.values(mapFile.props ?? {})) {
    const kind = entry.mappingKind;
    if (kind === "direct" || (!kind && entry.reactProp === reactProp)) {
      for (const key of figmaKeysFromEntry(entry)) keys.add(key);
    }
    if (kind === "override" && entry.valueOverrides) {
      for (const [figmaValue, override] of Object.entries(entry.valueOverrides)) {
        if (reactProp in override) keys.add(figmaValue);
      }
    }
    if (!kind && entry.alternateReactProp === reactProp) {
      for (const key of figmaKeysFromEntry(entry)) keys.add(key);
    }
  }
  return keys;
}

function checkPropMapUsage(
  file: string,
  analysis: FileAnalysis,
  resolution: ResolutionEntry,
  reasons: string[],
) {
  const mapPath = propMapPath(resolution.repoComponent);
  if (!fs.existsSync(mapPath)) return;

  const mapFile = JSON.parse(fs.readFileSync(mapPath, "utf-8")) as PropMapFile;
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

function isPrimitiveDecision(decision: Decision): boolean {
  return decision === "reuse" || decision === "create";
}

function main() {
  const args = parseArgs();
  if (!args.artifact) {
    fail([
      "usage: figma-gate-components.ts --artifact <component-resolution.json> [--files a.tsx,b.tsx] [--require-usage] [--require-prop-map] [--check-prop-map-usage]",
    ]);
  }

  const artifactPath = path.resolve(args.artifact);
  const artifact = readArtifact(artifactPath);
  const reasons: string[] = [];

  if (artifact.unresolved.length > 0) {
    reasons.push(`unresolved node(s): ${artifact.unresolved.join(", ")}`);
  }

  for (const resolution of artifact.resolved) {
    if (!VALID_DECISIONS.has(resolution.decision)) {
      reasons.push(
        `invalid decision "${resolution.decision}" for ${resolution.repoComponent}; expected reuse|create|custom`,
      );
    }
    if (resolution.decision === "custom") {
      const listed = artifact.customGenerated.some(
        (entry) => entry.componentName === resolution.repoComponent,
      );
      if (!listed) {
        reasons.push(
          `decision "custom" for ${resolution.repoComponent} missing from customGenerated[]`,
        );
      }
    }
  }

  if (args.requirePropMap) {
    for (const resolution of artifact.resolved) {
      if (!isPrimitiveDecision(resolution.decision)) continue;
      const mapFile = propMapPath(resolution.repoComponent);
      if (!fs.existsSync(mapFile)) {
        reasons.push(
          `prop-map missing for ${resolution.repoComponent} (${mapFile}); run figma-props-sync or omit --require-prop-map after explicit user force`,
        );
      }
    }
  }

  for (const custom of artifact.customGenerated) {
    if (!custom.componentName || !custom.filePath || !custom.customGeneratedReason) {
      reasons.push(
        "customGenerated entry must include componentName, filePath, customGeneratedReason",
      );
    }
  }

  const files = (args.files?.length ? args.files : getChangedTsxFiles()).filter((file) =>
    file.endsWith(".tsx"),
  );
  const approvedCustom = new Set(artifact.customGenerated.map((entry) => entry.componentName));
  const resolvedComponents = new Set(artifact.resolved.map((entry) => entry.repoComponent));
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
      if (!isPrimitiveDecision(resolution.decision)) continue;

      if (usesResolution(analysis, resolution)) {
        seenResolvedUsage.add(resolution.repoComponent);
        if (args.checkPropMapUsage || args.requirePropMap) {
          checkPropMapUsage(file, analysis, resolution, reasons);
        }
      }

      const rawTags = new Set([
        ...(primitiveRawTags[resolution.repoComponent] ?? []),
        ...(semanticRoleComponents[resolution.repoComponent] ?? []),
      ]);
      if (rawTags.size === 0) continue;

      const matchingRaw = analysis.rawUsages.filter((usage) => rawTags.has(usage.tag));
      if (matchingRaw.length > 0) {
        reasons.push(
          `raw primitive markup in ${file}; ${matchingRaw.map(formatRawUsage).join(", ")}; resolved ${resolution.figmaNode} must use ${resolution.repoComponent} from ${resolution.importPath} (decision=${resolution.decision})`,
        );
      }
    }
  }

  if (args.requireUsage) {
    for (const resolution of artifact.resolved) {
      if (
        isPrimitiveDecision(resolution.decision) &&
        !seenResolvedUsage.has(resolution.repoComponent)
      ) {
        reasons.push(`resolved component not used in scanned files: ${resolution.repoComponent}`);
      }
    }
  }

  if (reasons.length > 0) {
    fail(reasons);
  }

  console.log("PASS");
  console.log(`artifact: ${path.relative(process.cwd(), artifactPath)}`);
  console.log(`screen: ${artifact.screen}`);
  console.log(`resolved: ${artifact.resolved.length}`);
  console.log(`files: ${files.length}`);
  console.log("parser: typescript-ast");
}

main();
