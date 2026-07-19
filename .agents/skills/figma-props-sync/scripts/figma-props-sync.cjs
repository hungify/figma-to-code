#!/usr/bin/env node
/**
 * fetch | extract-code | finalize — match is agent-written `_figma-props-matched.json`.
 * Prefer: pnpm figma-props:fetch|extract|finalize|test
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const reactDocgen = require("react-docgen-typescript");
const ts = require("typescript");

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const SHARED_CACHE_DIR = ".figma/cache";
const DEFAULT_UI_DIR = "src/components";
const CODE_CACHE_NAME = "code-props-cache.json";
const PROP_MAP_DIR = ".figma/prop-map";
const SKIP_DIR_NAMES = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo"]);

function cachePaths(cacheDir) {
  return {
    cacheDir,
    raw: path.join(cacheDir, "_figma-props-raw.json"),
    codeRaw: path.join(cacheDir, "_code-props-raw.json"),
    matched: path.join(cacheDir, "_figma-props-matched.json"),
    codeCache: path.join(cacheDir, CODE_CACHE_NAME),
  };
}

function isolatedCacheDir(args, command) {
  const cacheDir = args["cache-dir"];
  if (typeof cacheDir !== "string" || cacheDir.trim().length === 0) {
    console.error(
      `❌ ${command} requires isolated --cache-dir <path>; reuse the same path for one fetch/extract/finalize cycle`,
    );
    process.exit(1);
  }
  if (path.resolve(cacheDir) === path.resolve(SHARED_CACHE_DIR)) {
    console.error(
      `❌ Shared cache ${SHARED_CACHE_DIR} is forbidden; use ${SHARED_CACHE_DIR}/<task-id>`,
    );
    process.exit(1);
  }
  return cacheDir;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[key] = val;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function hashContent(source) {
  return "sha256:" + crypto.createHash("sha256").update(source).digest("hex");
}

function hashJson(value) {
  return hashContent(JSON.stringify(value));
}

function loadCodePropsCache(codeCachePath) {
  if (!fs.existsSync(codeCachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(codeCachePath, "utf-8"));
  } catch {
    return {};
  }
}

function walkTsxFiles(dir) {
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      results = results.concat(walkTsxFiles(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

function collectComponents(node, acc) {
  if (!node) return;
  const nodeType = node.type;
  if (nodeType === "COMPONENT" || nodeType === "COMPONENT_SET") {
    const propDefs = node.componentPropertyDefinitions;
    if (propDefs && Object.keys(propDefs).length > 0) {
      acc.push({
        name: node.name,
        figmaNodeId: node.id,
        type: nodeType,
        propertyDefinitions: propDefs,
      });
    }
  }
  for (const child of node.children || []) {
    collectComponents(child, acc);
  }
}

async function cmdFetch(args) {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    console.error("❌ Missing FIGMA_ACCESS_TOKEN in .env");
    process.exit(1);
  }
  if (!args["file-key"] || !args["node-ids"]) {
    console.error("❌ Need --file-key and --node-ids");
    process.exit(1);
  }
  const paths = cachePaths(isolatedCacheDir(args, "fetch"));

  const nodeIds = args["node-ids"]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const url = `https://api.figma.com/v1/files/${args["file-key"]}/nodes?ids=${nodeIds.join(",")}`;

  const res = await fetch(url, { headers: { "X-Figma-Token": token } });
  if (!res.ok) {
    console.error(`❌ Figma REST ${res.status}: ${res.statusText}`);
    process.exit(1);
  }
  const data = await res.json();

  const components = [];
  for (const entry of Object.values(data.nodes || {})) {
    if (entry && entry.document) {
      collectComponents(entry.document, components);
    }
  }

  if (components.length === 0) {
    console.warn("⚠️  No COMPONENT/COMPONENT_SET with propertyDefinitions in given node(s)");
  }

  ensureDir(paths.cacheDir);
  fs.writeFileSync(
    paths.raw,
    JSON.stringify({ fileKey: args["file-key"], fetchedAt: nowIso(), components }, null, 2),
  );

  console.log(`✅ Fetch ${components.length} → ${paths.raw}`);
  for (const c of components) {
    console.log(
      `   - ${c.name} (${c.figmaNodeId}) ${Object.keys(c.propertyDefinitions).length} props`,
    );
  }
}

async function fetchDefinitionGroups(fileKey, nodeIds) {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) throw new Error("Missing FIGMA_ACCESS_TOKEN in .env");
  const url = `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/nodes?ids=${nodeIds.join(",")}`;
  const res = await fetch(url, { headers: { "X-Figma-Token": token } });
  if (!res.ok) throw new Error(`Figma REST ${res.status}: ${res.statusText}`);
  const data = await res.json();
  const components = [];
  for (const entry of Object.values(data.nodes || {})) {
    if (entry?.document) collectComponents(entry.document, components);
  }
  return components;
}

async function cmdVerifySource(args) {
  const propMapDir = args["prop-map-dir"] || PROP_MAP_DIR;
  const requested = String(args.components || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (requested.length === 0) {
    console.error("❌ Need --components Button,Input");
    process.exit(1);
  }
  const maps = requested.map((component) => {
    const filePath = path.join(propMapDir, `${component}.json`);
    if (!fs.existsSync(filePath)) throw new Error(`prop map missing: ${filePath}`);
    const propMap = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const problems = validateCommittedStructure(propMap);
    if (propMap.schemaVersion !== 2 || problems.length > 0) {
      throw new Error(
        `${component}.json invalid: ${problems.join("; ") || "schemaVersion 2 required"}`,
      );
    }
    return { component, propMap };
  });

  const groupsByFile = new Map();
  for (const { propMap } of maps) {
    const fileKey = propMap.source.fileKey;
    const nodeIds = propMap.groups.map((group) => group.figmaNodeId);
    const current = groupsByFile.get(fileKey) || new Set();
    nodeIds.forEach((nodeId) => current.add(nodeId));
    groupsByFile.set(fileKey, current);
  }
  const fetchedByFile = new Map();
  for (const [fileKey, nodeIds] of groupsByFile) {
    const groups = await fetchDefinitionGroups(fileKey, [...nodeIds]);
    fetchedByFile.set(fileKey, new Map(groups.map((group) => [group.figmaNodeId, group])));
  }

  const stale = [];
  for (const { component, propMap } of maps) {
    const fetched = fetchedByFile.get(propMap.source.fileKey);
    const definitions = propMap.groups.map((group) => {
      const current = fetched?.get(group.figmaNodeId);
      if (!current) {
        stale.push(`${component}: Figma group missing ${group.figmaNodeId} (${group.name})`);
      } else if (current.name !== group.name) {
        stale.push(
          `${component}: Figma group renamed ${group.figmaNodeId}: ${group.name} -> ${current.name}`,
        );
      }
      return {
        name: group.name,
        figmaNodeId: group.figmaNodeId,
        propertyDefinitions: current?.propertyDefinitions ?? {},
      };
    });
    const currentHash = hashJson(definitions);
    if (currentHash !== propMap.source.definitionHash) {
      stale.push(`${component}: Figma definition hash changed`);
    }
  }
  if (stale.length > 0) {
    console.error("❌ Stale Figma prop sources:");
    stale.forEach((problem) => console.error(`   - ${problem}`));
    process.exit(1);
  }
  console.log(`✅ Current Figma definitions match ${maps.length} prop map(s)`);
}

function nodeName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return node.getText().replace(/^['"]|['"]$/g, "");
}

function hasExportModifier(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function literalValues(typeNode) {
  if (!typeNode) return [];
  const nodes = ts.isUnionTypeNode(typeNode) ? typeNode.types : [typeNode];
  return nodes.flatMap((node) => {
    if (ts.isLiteralTypeNode(node)) {
      if (ts.isStringLiteral(node.literal) || ts.isNumericLiteral(node.literal)) {
        return [node.literal.text];
      }
      if (node.literal.kind === ts.SyntaxKind.TrueKeyword) return [true];
      if (node.literal.kind === ts.SyntaxKind.FalseKeyword) return [false];
    }
    return [];
  });
}

function typeKeyValues(typeNode) {
  return literalValues(typeNode).map(String);
}

function collectPropsFromTypeNode(
  typeNode,
  sourceFile,
  props,
  typeDeclarations,
  visited = new Set(),
) {
  if (!typeNode) return;
  if (ts.isTypeLiteralNode(typeNode)) {
    for (const member of typeNode.members) {
      if (!ts.isPropertySignature(member)) continue;
      const name = nodeName(member.name);
      if (!name) continue;
      const values = literalValues(member.type);
      props[name] = {
        source: "local-type",
        type: member.type?.getText(sourceFile) ?? "unknown",
        required: !member.questionToken,
        ...(values.length > 0 ? { values } : {}),
      };
    }
    return;
  }
  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    for (const child of typeNode.types) {
      collectPropsFromTypeNode(child, sourceFile, props, typeDeclarations, visited);
    }
    return;
  }
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName.getText(sourceFile);
    if ((typeName === "Pick" || typeName === "Omit") && typeNode.typeArguments?.length === 2) {
      const inherited = {};
      collectPropsFromTypeNode(
        typeNode.typeArguments[0],
        sourceFile,
        inherited,
        typeDeclarations,
        visited,
      );
      const keys = new Set(typeKeyValues(typeNode.typeArguments[1]));
      if (typeName === "Pick") {
        for (const key of keys) {
          props[key] = inherited[key] ?? {
            source: "external-type-ref",
            type: "unknown",
            required: false,
          };
        }
      } else {
        for (const [key, value] of Object.entries(inherited)) {
          if (!keys.has(key)) props[key] = value;
        }
      }
      return;
    }
    if (!ts.isIdentifier(typeNode.typeName) || visited.has(typeName)) return;
    const declaration = typeDeclarations.get(typeName);
    if (!declaration) return;
    visited.add(typeName);
    if (ts.isTypeAliasDeclaration(declaration)) {
      collectPropsFromTypeNode(declaration.type, sourceFile, props, typeDeclarations, visited);
    } else if (ts.isInterfaceDeclaration(declaration)) {
      for (const heritage of declaration.heritageClauses ?? []) {
        for (const inheritedType of heritage.types) {
          collectPropsFromTypeNode(inheritedType, sourceFile, props, typeDeclarations, visited);
        }
      }
      collectPropsFromTypeNode(
        ts.factory.createTypeLiteralNode(declaration.members),
        sourceFile,
        props,
        typeDeclarations,
        visited,
      );
    }
  }
}

function objectProperty(objectNode, name) {
  if (!objectNode || !ts.isObjectLiteralExpression(objectNode)) return null;
  return (
    objectNode.properties.find(
      (property) => ts.isPropertyAssignment(property) && nodeName(property.name) === name,
    ) ?? null
  );
}

function extractCvaVariants(sourceFile) {
  const variantsByName = new Map();
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const initializer = declaration.initializer;
      if (
        !ts.isCallExpression(initializer) ||
        initializer.expression.getText(sourceFile) !== "cva"
      ) {
        continue;
      }
      const config = initializer.arguments[1];
      const variantsProperty = objectProperty(config, "variants");
      if (!variantsProperty || !ts.isObjectLiteralExpression(variantsProperty.initializer))
        continue;
      const props = {};
      for (const variant of variantsProperty.initializer.properties) {
        if (!ts.isPropertyAssignment(variant)) continue;
        const name = nodeName(variant.name);
        if (!name || !ts.isObjectLiteralExpression(variant.initializer)) continue;
        const values = variant.initializer.properties
          .map((property) => nodeName(property.name))
          .filter(Boolean);
        props[name] = { source: "cva", type: "variant", values };
      }
      variantsByName.set(declaration.name.text, props);
    }
  });
  return variantsByName;
}

const docgenParser = reactDocgen.withDefaultConfig({
  savePropValueAsString: true,
  shouldExtractLiteralValuesFromEnum: true,
  shouldRemoveUndefinedFromOptional: true,
});

function normalizeDeclarationPath(fileName) {
  if (!fileName) return null;
  const normalized = fileName.replace(/\\/g, "/");
  if (path.isAbsolute(normalized))
    return path.relative(process.cwd(), normalized).replace(/\\/g, "/");
  const cwdName = path.basename(process.cwd());
  return normalized.startsWith(`${cwdName}/`) ? normalized.slice(cwdName.length + 1) : normalized;
}

function docgenValues(type) {
  if (!Array.isArray(type?.value)) return [];
  return type.value
    .map((entry) => entry?.value)
    .filter((value) => typeof value === "string")
    .map((value) => value.replace(/^['"]|['"]$/g, ""));
}

function mergeResolvedProps(components, filePath) {
  let docs = [];
  try {
    docs = docgenParser.parse(filePath);
  } catch (error) {
    console.warn(
      `⚠️  docgen skipped ${filePath}: ${error instanceof Error ? error.message : error}`,
    );
    return;
  }
  for (const doc of docs) {
    const component = components[doc.displayName];
    if (!component) continue;
    for (const [propName, prop] of Object.entries(doc.props ?? {})) {
      if (component.props[propName]?.source !== "external-type-ref") continue;
      const declarationPath = normalizeDeclarationPath(
        prop.declarations?.[0]?.fileName ?? prop.parent?.fileName,
      );
      const values = docgenValues(prop.type);
      component.props[propName] = {
        source: declarationPath?.includes("node_modules/") ? "external-type" : "resolved-type",
        type: prop.type?.raw ?? prop.type?.name ?? "unknown",
        required: prop.required,
        ...(values.length > 0 ? { values } : {}),
        ...(declarationPath ? { declarationPath } : {}),
      };
    }
    for (const [propName, prop] of Object.entries(doc.props ?? {})) {
      if (component.props[propName]) continue;
      const declarationPath = normalizeDeclarationPath(
        prop.declarations?.[0]?.fileName ?? prop.parent?.fileName,
      );
      const values = docgenValues(prop.type);
      component.props[propName] = {
        source: declarationPath?.includes("node_modules/") ? "external-type" : "resolved-type",
        type: prop.type?.raw ?? prop.type?.name ?? "unknown",
        required: prop.required,
        ...(values.length > 0 ? { values } : {}),
        ...(declarationPath ? { declarationPath } : {}),
      };
    }
  }
}

function collectDestructuredProps(parameter, props) {
  if (!parameter || !ts.isObjectBindingPattern(parameter.name)) return;
  for (const element of parameter.name.elements) {
    if (element.dotDotDotToken) continue;
    const name = nodeName(element.propertyName ?? element.name);
    if (!name || props[name]) continue;
    props[name] = { source: "source-read", type: "unknown", required: false };
  }
}

function extractComponentsFromSource(source, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const exportedNames = new Set();
  const typeDeclarations = new Map();
  const valueDeclarations = new Map();

  sourceFile.forEachChild((node) => {
    if ((ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name) {
      typeDeclarations.set(node.name.text, node);
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      valueDeclarations.set(node.name.text, node);
      if (hasExportModifier(node)) exportedNames.add(node.name.text);
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        valueDeclarations.set(declaration.name.text, declaration);
        if (hasExportModifier(node)) exportedNames.add(declaration.name.text);
      }
    }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) exportedNames.add(element.name.text);
    }
  });

  const cvaVariants = extractCvaVariants(sourceFile);
  const components = {};
  for (const componentName of exportedNames) {
    if (!/^[A-Z]/.test(componentName)) continue;
    const props = {};
    const propsDeclaration = typeDeclarations.get(`${componentName}Props`);
    let typeNode = null;
    if (propsDeclaration && ts.isTypeAliasDeclaration(propsDeclaration)) {
      typeNode = propsDeclaration.type;
      collectPropsFromTypeNode(typeNode, sourceFile, props, typeDeclarations);
    } else if (propsDeclaration && ts.isInterfaceDeclaration(propsDeclaration)) {
      for (const heritage of propsDeclaration.heritageClauses ?? []) {
        for (const inheritedType of heritage.types) {
          collectPropsFromTypeNode(inheritedType, sourceFile, props, typeDeclarations);
        }
      }
      collectPropsFromTypeNode(
        ts.factory.createTypeLiteralNode(propsDeclaration.members),
        sourceFile,
        props,
        typeDeclarations,
      );
    } else {
      const declaration = valueDeclarations.get(componentName);
      if (declaration && ts.isFunctionDeclaration(declaration)) {
        typeNode = declaration.parameters[0]?.type ?? null;
        collectDestructuredProps(declaration.parameters[0], props);
      } else if (declaration && ts.isVariableDeclaration(declaration)) {
        const initializer = declaration.initializer;
        if (
          initializer &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        ) {
          typeNode = initializer.parameters[0]?.type ?? null;
          collectDestructuredProps(initializer.parameters[0], props);
        }
      }
      collectPropsFromTypeNode(typeNode, sourceFile, props, typeDeclarations);
    }

    const valueDeclaration = valueDeclarations.get(componentName);
    if (valueDeclaration && ts.isFunctionDeclaration(valueDeclaration)) {
      collectDestructuredProps(valueDeclaration.parameters[0], props);
    } else if (valueDeclaration && ts.isVariableDeclaration(valueDeclaration)) {
      const initializer = valueDeclaration.initializer;
      if (
        initializer &&
        (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
      ) {
        collectDestructuredProps(initializer.parameters[0], props);
      }
    }

    const typeText = typeNode?.getText(sourceFile) ?? "";
    for (const [variantName, variantProps] of cvaVariants) {
      if (!typeText.includes(`typeof ${variantName}`)) continue;
      for (const [propName, prop] of Object.entries(variantProps)) {
        props[propName] = { ...(props[propName] ?? {}), ...prop };
      }
    }

    components[componentName] = {
      file: filePath,
      props,
    };
  }
  mergeResolvedProps(components, filePath);
  for (const component of Object.values(components)) {
    component.codeApiHash = hashJson(component.props);
  }
  return components;
}

function cmdExtractCode(args) {
  const paths = cachePaths(isolatedCacheDir(args, "extract-code"));
  const uiDir = args["ui-dir"] || DEFAULT_UI_DIR;
  if (!fs.existsSync(uiDir)) {
    console.error(`❌ Missing dir ${uiDir}`);
    process.exit(1);
  }

  const tsxFiles = walkTsxFiles(uiDir);
  const cache = loadCodePropsCache(paths.codeCache);
  const seenFiles = new Set();
  let reused = 0;
  let reparsed = 0;

  for (const filePath of tsxFiles) {
    seenFiles.add(filePath);

    const source = fs.readFileSync(filePath, "utf-8");
    const hash = hashContent(source);
    const cached = cache[filePath];

    if (cached && cached.hash === hash && cached.components && cached.extractorVersion === 4) {
      reused++;
      continue;
    }

    reparsed++;
    cache[filePath] = {
      hash,
      extractorVersion: 4,
      extractedAt: nowIso(),
      components: extractComponentsFromSource(source, filePath),
    };
  }

  for (const knownPath of Object.keys(cache)) {
    if (!seenFiles.has(knownPath)) delete cache[knownPath];
  }

  ensureDir(paths.cacheDir);
  fs.writeFileSync(paths.codeCache, JSON.stringify(cache, null, 2));

  const extractedComponents = [];
  for (const [filePath, entry] of Object.entries(cache)) {
    for (const [componentName, component] of Object.entries(entry.components ?? {})) {
      extractedComponents.push({ componentName, ...component, file: filePath });
    }
  }
  const nameCounts = extractedComponents.reduce((counts, component) => {
    counts[component.componentName] = (counts[component.componentName] ?? 0) + 1;
    return counts;
  }, {});
  const codeComponents = {};
  const componentIndex = {};
  for (const component of extractedComponents) {
    const key =
      nameCounts[component.componentName] === 1
        ? component.componentName
        : `${component.file}#${component.componentName}`;
    codeComponents[key] = component;
    componentIndex[component.componentName] ??= [];
    componentIndex[component.componentName].push(key);
  }
  fs.writeFileSync(
    paths.codeRaw,
    JSON.stringify(
      {
        schemaVersion: 2,
        extractor: "typescript-ast+react-docgen-typescript",
        uiDir,
        scannedAt: nowIso(),
        components: codeComponents,
        componentIndex,
      },
      null,
      2,
    ),
  );

  console.log(
    `✅ Extract ${Object.keys(codeComponents).length} comps / ${tsxFiles.length} tsx (cache ${reused}, parse ${reparsed}) → ${paths.codeRaw}`,
  );
  const staleMaps = checkCommittedCodeDrift(
    { components: codeComponents, componentIndex },
    args["prop-map-dir"] || PROP_MAP_DIR,
    String(args.components || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (staleMaps.length > 0) {
    console.log(`⚠️  ${staleMaps.length} invalid/stale prop-map(s):`);
    staleMaps.forEach((message) => console.log(`   - ${message}`));
    if (args["fail-on-stale"] || args["require-hashes"]) {
      process.exit(1);
    }
  }
  console.log(`   Next: write ${paths.matched} (Phase 2.5), then finalize`);
}

const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);
const VALID_MAPPING_KIND = new Set(["direct", "override", "composition", "unmapped"]);
const VALID_EVIDENCE_KIND = new Set(["code-api", "external-type", "source-read"]);
const ALLOWED_MATCHED_FIELDS = new Set(["schemaVersion", "fileKey", "components"]);
const ALLOWED_COMPONENT_FIELDS = new Set(["codeComponent", "codeFile", "groups"]);
const ALLOWED_GROUP_FIELDS = new Set(["figmaNodeId", "name", "mappings"]);
const ALLOWED_EVIDENCE_FIELDS = new Set(["kind", "reactProp", "path", "hash"]);
const ALLOWED_MAPPING_FIELDS = new Set([
  "figmaProp",
  "figmaType",
  "mappingKind",
  "reactProp",
  "valueMap",
  "valueOverrides",
  "confidence",
  "evidence",
  "note",
]);

function findRawComponent(raw, figmaNodeId, figmaName) {
  if (figmaNodeId) {
    return raw.components?.find((candidate) => candidate.figmaNodeId === figmaNodeId);
  }
  return raw.components?.find((candidate) => candidate.name === figmaName);
}

function findCodeComponent(codeRaw, componentName, codeFile) {
  const direct = codeRaw.components?.[componentName];
  if (direct && (!codeFile || direct.file === codeFile)) return direct;
  const keys = codeRaw.componentIndex?.[componentName] ?? [];
  return keys
    .map((key) => codeRaw.components?.[key])
    .find((candidate) => candidate && (!codeFile || candidate.file === codeFile));
}

function checkCommittedCodeDrift(codeRaw, propMapDir, requestedComponents = []) {
  if (!fs.existsSync(propMapDir)) return [];
  const stale = [];
  const fileNames =
    requestedComponents.length > 0
      ? [...new Set(requestedComponents)].map((component) => `${component}.json`)
      : fs.readdirSync(propMapDir).filter((name) => name.endsWith(".json"));
  for (const fileName of fileNames) {
    const filePath = path.join(propMapDir, fileName);
    if (!fs.existsSync(filePath)) {
      stale.push(`${fileName}: prop map missing`);
      continue;
    }
    let propMap;
    try {
      propMap = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      stale.push(`${fileName}: unreadable JSON`);
      continue;
    }
    if (propMap.schemaVersion !== 2) {
      stale.push(`${fileName}: schemaVersion 2 required`);
      continue;
    }
    const shapeProblems = validateCommittedStructure(propMap);
    if (shapeProblems.length > 0) {
      stale.push(`${fileName}: invalid v2 shape (${shapeProblems.join("; ")})`);
      continue;
    }
    const current = findCodeComponent(codeRaw, propMap.target?.component, propMap.target?.file);
    if (!current) {
      stale.push(`${fileName}: code component/file missing from current extraction`);
      continue;
    }
    if (propMap.target?.apiHash !== current.codeApiHash) {
      stale.push(`${fileName}: code API hash changed`);
    }
    for (const group of propMap.groups) {
      for (const mapping of group.mappings) {
        if (mapping.mappingKind !== "composition" && mapping.mappingKind !== "unmapped") continue;
        const candidates = exactCodePropCandidates(mapping.figmaProp, current);
        if (candidates.length > 0) {
          stale.push(
            `${fileName}: ${group.name}.${mapping.figmaProp} hides exact code prop candidate [${candidates.join(", ")}]`,
          );
        }
      }
    }
  }
  return stale;
}

function exactKeys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).every((key) => allowed.has(key));
}

function validateCommittedStructure(propMap) {
  const problems = [];
  const allowedRoot = new Set(["schemaVersion", "syncedAt", "source", "target", "groups"]);
  if (!exactKeys(propMap, allowedRoot)) problems.push("unknown root field");
  if (!propMap.syncedAt) problems.push("syncedAt required");
  if (
    !exactKeys(propMap.source, new Set(["fileKey", "definitionHash"])) ||
    !propMap.source?.fileKey ||
    !propMap.source?.definitionHash
  ) {
    problems.push("invalid source");
  }
  if (
    !exactKeys(propMap.target, new Set(["component", "file", "apiHash"])) ||
    !propMap.target?.component ||
    !propMap.target?.file ||
    !propMap.target?.apiHash
  ) {
    problems.push("invalid target");
  }
  if (!Array.isArray(propMap.groups) || propMap.groups.length === 0) {
    problems.push("non-empty groups required");
    return problems;
  }
  for (const group of propMap.groups) {
    if (!exactKeys(group, ALLOWED_GROUP_FIELDS) || !group.figmaNodeId || !group.name) {
      problems.push("invalid group");
      continue;
    }
    if (!Array.isArray(group.mappings) || group.mappings.length === 0) {
      problems.push("non-empty mappings required");
      continue;
    }
    for (const mapping of group.mappings) {
      if (!exactKeys(mapping, ALLOWED_MAPPING_FIELDS)) problems.push("unknown mapping field");
      if (
        !mapping.figmaProp ||
        !mapping.figmaType ||
        !VALID_MAPPING_KIND.has(mapping.mappingKind) ||
        !VALID_CONFIDENCE.has(mapping.confidence)
      ) {
        problems.push("invalid mapping fields");
      }
    }
  }
  return [...new Set(problems)];
}

function fileHash(filePath) {
  return fs.existsSync(filePath) ? hashContent(fs.readFileSync(filePath)) : null;
}

function figmaValuesForRawProp(rawProp) {
  if (rawProp?.type === "BOOLEAN") return ["False", "True"];
  return rawProp?.variantOptions ?? rawProp?.preferredValues?.map((value) => value.key) ?? [];
}

function sameValue(left, right) {
  return String(left).toLowerCase() === String(right).toLowerCase();
}

function normalizedPropName(value) {
  return String(value ?? "")
    .replace(/#\d+:\d+$/, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function exactCodePropCandidates(figmaProp, codeComponent) {
  const normalized = normalizedPropName(figmaProp);
  if (!normalized) return [];
  return Object.entries(codeComponent?.props ?? {})
    .filter(
      ([reactProp, codeProp]) =>
        normalizedPropName(reactProp) === normalized &&
        codeProp?.source !== "external-type" &&
        codeProp?.type !== "unknown",
    )
    .map(([reactProp]) => reactProp);
}

function validateValueCoverage(problems, context, mapping, rawProp) {
  const figmaValues = figmaValuesForRawProp(rawProp);
  if (figmaValues.length === 0) return;
  const map = mapping.mappingKind === "override" ? mapping.valueOverrides : mapping.valueMap;
  if (!map) return;
  const keys = Object.keys(map);
  const missing = figmaValues.filter((value) => !keys.some((key) => sameValue(key, value)));
  const extra = keys.filter((key) => !figmaValues.some((value) => sameValue(key, value)));
  if (missing.length > 0) problems.push(`${context}: missing Figma values [${missing.join(", ")}]`);
  if (extra.length > 0) problems.push(`${context}: unknown Figma values [${extra.join(", ")}]`);
}

function mappingReactProps(mapping) {
  if (mapping.mappingKind === "direct") return mapping.reactProp ? [mapping.reactProp] : [];
  if (mapping.mappingKind !== "override") return [];
  return [
    ...new Set(
      Object.values(mapping.valueOverrides ?? {}).flatMap((override) =>
        Object.keys(override ?? {}),
      ),
    ),
  ];
}

function evidenceForReactProp(mapping, reactProp) {
  return (mapping.evidence ?? []).find(
    (evidence) => !evidence.reactProp || evidence.reactProp === reactProp,
  );
}

function validateEvidence(problems, context, evidence, codeProp, codeFile) {
  if (!evidence || !VALID_EVIDENCE_KIND.has(evidence.kind)) {
    problems.push(`${context}: missing/invalid evidence`);
    return;
  }
  for (const key of Object.keys(evidence)) {
    if (!ALLOWED_EVIDENCE_FIELDS.has(key))
      problems.push(`${context}: unknown evidence field "${key}"`);
  }
  if (evidence.reactProp && !context.endsWith(`.${evidence.reactProp}`)) {
    problems.push(`${context}: evidence reactProp "${evidence.reactProp}" does not match`);
  }
  if (evidence.kind === "code-api") {
    if (!codeProp || codeProp.source === "external-type") {
      problems.push(`${context}: code-api evidence requires local/resolved extracted prop`);
    }
    return;
  }
  const evidencePath = evidence.path;
  if (!evidencePath || !fs.existsSync(evidencePath)) {
    problems.push(`${context}: evidence path missing: ${evidencePath ?? "none"}`);
    return;
  }
  const actualHash = fileHash(evidencePath);
  if (!evidence.hash || evidence.hash !== actualHash) {
    problems.push(`${context}: evidence hash stale for ${evidencePath}`);
  }
  if (evidence.kind === "external-type") {
    if (!/\.d\.(?:ts|mts|cts)$/.test(evidencePath)) {
      problems.push(`${context}: external-type evidence must point to declaration file`);
    }
    if (codeProp?.declarationPath && codeProp.declarationPath !== evidencePath) {
      problems.push(
        `${context}: evidence path ${evidencePath} does not match extracted ${codeProp.declarationPath}`,
      );
    }
  }
  if (evidence.kind === "source-read" && evidencePath !== codeFile) {
    problems.push(`${context}: source-read evidence must point to codeFile ${codeFile}`);
  }
}

function validateAssignedValue(problems, context, codeProp, value) {
  if (value === null || value === undefined || !codeProp) return;
  const codeValues = codeProp.values?.map(String) ?? [];
  if (codeValues.length > 0 && !codeValues.some((candidate) => sameValue(candidate, value))) {
    problems.push(`${context}: value "${value}" not in code values [${codeValues.join(", ")}]`);
  }
  if (codeProp.type === "boolean" && typeof value !== "boolean") {
    problems.push(`${context}: value "${value}" must be boolean`);
  }
}

function validateMapping(problems, context, mapping, rawProp, codeComponent, codeFile) {
  for (const key of Object.keys(mapping)) {
    if (!ALLOWED_MAPPING_FIELDS.has(key)) problems.push(`${context}: unknown field "${key}"`);
  }
  for (const field of ["figmaProp", "figmaType", "mappingKind", "confidence"]) {
    if (!(field in mapping)) problems.push(`${context}: missing "${field}"`);
  }
  if (!VALID_MAPPING_KIND.has(mapping.mappingKind)) {
    problems.push(`${context}: bad mappingKind "${mapping.mappingKind}"`);
    return;
  }
  if (!VALID_CONFIDENCE.has(mapping.confidence)) {
    problems.push(`${context}: bad confidence "${mapping.confidence}"`);
  }
  if (!rawProp) {
    problems.push(`${context}: missing Figma property in fetched raw data`);
  } else if (mapping.figmaType !== rawProp.type) {
    problems.push(
      `${context}: figmaType "${mapping.figmaType}" does not match Figma "${rawProp.type}"`,
    );
  }
  if (mapping.mappingKind === "direct" && !mapping.reactProp) {
    problems.push(`${context}: direct needs reactProp`);
  }
  if (mapping.mappingKind === "direct" && mapping.valueOverrides) {
    problems.push(`${context}: direct must not set valueOverrides`);
  }
  if (mapping.mappingKind === "override" && !mapping.valueOverrides) {
    problems.push(`${context}: override needs valueOverrides`);
  }
  if (mapping.mappingKind === "override" && (mapping.reactProp || mapping.valueMap)) {
    problems.push(`${context}: override must not set reactProp/valueMap`);
  }
  if (
    (mapping.mappingKind === "composition" || mapping.mappingKind === "unmapped") &&
    !mapping.note
  ) {
    problems.push(`${context}: ${mapping.mappingKind} needs note`);
  }
  if (
    (mapping.mappingKind === "composition" || mapping.mappingKind === "unmapped") &&
    mapping.reactProp
  ) {
    problems.push(`${context}: ${mapping.mappingKind} must not set reactProp`);
  }
  if (
    (mapping.mappingKind === "composition" || mapping.mappingKind === "unmapped") &&
    (mapping.valueMap || mapping.valueOverrides || mapping.evidence)
  ) {
    problems.push(`${context}: ${mapping.mappingKind} must not set values/evidence`);
  }
  if (mapping.mappingKind === "composition" || mapping.mappingKind === "unmapped") {
    const exactCandidates = exactCodePropCandidates(mapping.figmaProp, codeComponent);
    if (exactCandidates.length > 0) {
      problems.push(
        `${context}: ${mapping.mappingKind} rejected because exact code prop candidate exists [${exactCandidates.join(", ")}]; use direct/override or rename the Figma property`,
      );
    }
  }
  validateValueCoverage(problems, context, mapping, rawProp);

  if (mapping.mappingKind === "direct" && !mapping.valueMap && rawProp) {
    const figmaValues = figmaValuesForRawProp(rawProp);
    const codeProp = codeComponent?.props?.[mapping.reactProp];
    const codeValues = codeProp?.values?.map(String) ?? [];
    if (figmaValues.length > 0) {
      const implicitBooleanMapping = rawProp.type === "BOOLEAN" && codeProp?.type === "boolean";
      if (!implicitBooleanMapping && codeValues.length === 0) {
        problems.push(
          `${context}: direct enumerable mapping cannot prove code values; full valueMap required (Figma [${figmaValues.join(", ")}])`,
        );
      } else if (
        !implicitBooleanMapping &&
        (figmaValues.length !== codeValues.length ||
          figmaValues.some((value) => !codeValues.some((candidate) => sameValue(candidate, value))))
      ) {
        problems.push(
          `${context}: direct Figma/code values differ; full valueMap required (Figma [${figmaValues.join(", ")}], code [${codeValues.join(", ")}])`,
        );
      }
    }
  }

  for (const reactProp of mappingReactProps(mapping)) {
    const codeProp = codeComponent?.props?.[reactProp];
    if (!codeProp) problems.push(`${context}: reactProp "${reactProp}" missing from code API`);
    validateEvidence(
      problems,
      `${context}.${reactProp}`,
      evidenceForReactProp(mapping, reactProp),
      codeProp,
      codeFile,
    );
  }
  if (mapping.mappingKind === "direct" && mapping.valueMap) {
    const codeProp = codeComponent?.props?.[mapping.reactProp];
    for (const [figmaValue, value] of Object.entries(mapping.valueMap)) {
      validateAssignedValue(problems, `${context}.${figmaValue}`, codeProp, value);
    }
  }
  if (mapping.mappingKind === "override") {
    for (const [figmaValue, overrides] of Object.entries(mapping.valueOverrides ?? {})) {
      for (const [reactProp, value] of Object.entries(overrides ?? {})) {
        validateAssignedValue(
          problems,
          `${context}.${figmaValue}.${reactProp}`,
          codeComponent?.props?.[reactProp],
          value,
        );
      }
    }
  }
}

function validateMatched(matched, raw, codeRaw) {
  const problems = [];
  for (const key of Object.keys(matched)) {
    if (!ALLOWED_MATCHED_FIELDS.has(key)) problems.push(`matched: unknown field "${key}"`);
  }
  if (matched.schemaVersion !== 2) problems.push("matched.schemaVersion must be 2");
  if (matched.fileKey !== raw.fileKey)
    problems.push("matched.fileKey must match fetched raw fileKey");
  if (!Array.isArray(matched.components)) {
    problems.push("matched.components must be an array");
    return problems;
  }
  const seenComponents = new Set();
  const seenComponentNames = new Set();
  for (const component of matched.components) {
    const context = component.codeComponent ?? "unknown-component";
    for (const key of Object.keys(component)) {
      if (!ALLOWED_COMPONENT_FIELDS.has(key)) problems.push(`${context}: unknown field "${key}"`);
    }
    if (!component.codeComponent || !component.codeFile) {
      problems.push(`${context}: codeComponent + codeFile required`);
      continue;
    }
    const componentKey = `${component.codeComponent}::${component.codeFile}`;
    if (seenComponents.has(componentKey))
      problems.push(`${context}: duplicate component/file entry`);
    seenComponents.add(componentKey);
    if (seenComponentNames.has(component.codeComponent)) {
      problems.push(
        `${context}: duplicate codeComponent would overwrite ${component.codeComponent}.json`,
      );
    }
    seenComponentNames.add(component.codeComponent);
    const codeComponent = findCodeComponent(codeRaw, component.codeComponent, component.codeFile);
    if (!codeComponent) {
      problems.push(`${context}: component/file missing from extracted code API`);
      continue;
    }
    if (!Array.isArray(component.groups) || component.groups.length === 0) {
      problems.push(`${context}: groups[] required`);
      continue;
    }
    const seenGroups = new Set();
    for (const group of component.groups) {
      const groupContext = `${context}.${group.name ?? group.figmaNodeId ?? "unknown-group"}`;
      for (const key of Object.keys(group)) {
        if (!ALLOWED_GROUP_FIELDS.has(key))
          problems.push(`${groupContext}: unknown field "${key}"`);
      }
      if (!group.figmaNodeId || !group.name) {
        problems.push(`${groupContext}: figmaNodeId + name required`);
        continue;
      }
      const groupKey = `${group.figmaNodeId}::${group.name}`;
      if (seenGroups.has(groupKey)) problems.push(`${groupContext}: duplicate group entry`);
      seenGroups.add(groupKey);
      const rawComponent = findRawComponent(raw, group.figmaNodeId, group.name);
      if (!rawComponent) {
        problems.push(`${groupContext}: missing Figma group in fetched raw data`);
        continue;
      }
      if (!Array.isArray(group.mappings) || group.mappings.length === 0) {
        problems.push(`${groupContext}: non-empty mappings[] required`);
        continue;
      }
      const seenProps = new Set();
      for (const mapping of group.mappings) {
        if (seenProps.has(mapping.figmaProp)) {
          problems.push(`${groupContext}: duplicate figmaProp "${mapping.figmaProp}"`);
        }
        seenProps.add(mapping.figmaProp);
        validateMapping(
          problems,
          `${groupContext}.${mapping.figmaProp ?? "unknown-prop"}`,
          mapping,
          rawComponent.propertyDefinitions?.[mapping.figmaProp],
          codeComponent,
          component.codeFile,
        );
      }
      const missingProps = Object.keys(rawComponent.propertyDefinitions ?? {}).filter(
        (figmaProp) => !seenProps.has(figmaProp),
      );
      if (missingProps.length > 0) {
        problems.push(`${groupContext}: missing Figma properties [${missingProps.join(", ")}]`);
      }
    }
  }
  return problems;
}

function cmdFinalize(args) {
  const paths = cachePaths(isolatedCacheDir(args, "finalize"));
  if (!fs.existsSync(paths.matched)) {
    console.error(`❌ Missing ${paths.matched} (write Phase 2.5 matched first)`);
    process.exit(1);
  }
  if (!fs.existsSync(paths.raw)) {
    console.error(`❌ Missing ${paths.raw} — run fetch first`);
    process.exit(1);
  }
  if (!fs.existsSync(paths.codeRaw)) {
    console.error(`❌ Missing ${paths.codeRaw} — run extract first`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(paths.raw, "utf-8"));
  const codeRaw = JSON.parse(fs.readFileSync(paths.codeRaw, "utf-8"));
  const matched = JSON.parse(fs.readFileSync(paths.matched, "utf-8"));

  const problems = validateMatched(matched, raw, codeRaw);
  if (problems.length > 0) {
    console.error(`❌ Invalid ${paths.matched}:`);
    problems.forEach((p) => console.error("   - " + p));
    process.exit(1);
  }

  const prune = args.prune === true || args.prune === "true";
  if (prune) {
    console.error(
      "❌ --prune is disabled: finalize cannot independently prove complete-library scope; remove obsolete maps in a separate reviewed change",
    );
    process.exit(1);
  }

  const propMapDir = args["prop-map-dir"] || PROP_MAP_DIR;
  ensureDir(propMapDir);

  const writtenFiles = [];
  const summaries = [];
  for (const component of matched.components) {
    const codeComponent = findCodeComponent(codeRaw, component.codeComponent, component.codeFile);
    const definitions = component.groups.map((group) => {
      const rawComponent = findRawComponent(raw, group.figmaNodeId, group.name);
      return {
        name: group.name,
        figmaNodeId: group.figmaNodeId,
        propertyDefinitions: rawComponent?.propertyDefinitions ?? {},
      };
    });
    const filePath = path.join(propMapDir, `${component.codeComponent}.json`);
    const out = {
      schemaVersion: 2,
      syncedAt: nowIso(),
      source: {
        fileKey: raw.fileKey,
        definitionHash: hashJson(definitions),
      },
      target: {
        component: component.codeComponent,
        file: component.codeFile,
        apiHash: codeComponent.codeApiHash,
      },
      groups: component.groups,
    };
    fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
    writtenFiles.push(filePath);
    const mappings = component.groups.flatMap((group) => group.mappings);
    summaries.push({ component: component.codeComponent, groups: component.groups, mappings });
  }

  console.log(`✅ Wrote ${writtenFiles.length} → ${propMapDir}/`);
  console.log("   Existing prop maps preserved (--prune is intentionally disabled)");

  let totalProps = 0,
    high = 0,
    medium = 0,
    low = 0,
    compositionOnly = 0,
    unmapped = 0;

  for (const summary of summaries) {
    const compHigh = summary.mappings.filter((mapping) => mapping.confidence === "high").length;
    const compTotal = summary.mappings.length;
    const groupNames = summary.groups.map((group) => group.name).join(", ");

    totalProps += compTotal;
    high += compHigh;
    medium += summary.mappings.filter((mapping) => mapping.confidence === "medium").length;
    low += summary.mappings.filter((mapping) => mapping.confidence === "low").length;
    compositionOnly += summary.mappings.filter(
      (mapping) => mapping.mappingKind === "composition",
    ).length;
    unmapped += summary.mappings.filter((mapping) => mapping.mappingKind === "unmapped").length;

    if (compHigh === compTotal) {
      console.log(`✅ ${summary.component} — ${compHigh}/${compTotal} high [${groupNames}]`);
    } else {
      console.log(`⚠️  ${summary.component} — ${compHigh}/${compTotal} high [${groupNames}]`);
    }
  }

  console.log(
    `props ${totalProps} | high ${high} | medium ${medium} | low ${low} | composition ${compositionOnly} | unmapped ${unmapped}`,
  );
  if (unmapped > 0) {
    console.log(`⚠️  ${unmapped} unmapped — check note in prop-map`);
  }
  console.log(`📌 Commit ${propMapDir}/`);
  console.log("review: developer mapping/API review required; finalize is not merge approval");

  for (const p of [paths.raw, paths.codeRaw, paths.matched]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  console.log(`🧹 Cleared cycle cache in ${paths.cacheDir}/`);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  if (command === "fetch") return cmdFetch(args);
  if (command === "extract-code") return cmdExtractCode(args);
  if (command === "finalize") return cmdFinalize(args);
  if (command === "verify-source") return cmdVerifySource(args);

  console.error(
    "Usage: node figma-props-sync.cjs <fetch|extract-code|finalize|verify-source> --cache-dir .figma/cache/<task-id> [--options]",
  );
  process.exit(1);
}

main();
