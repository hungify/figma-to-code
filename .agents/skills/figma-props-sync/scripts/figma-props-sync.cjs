#!/usr/bin/env node
/**
 * fetch | extract-code | finalize — match is agent-written `_figma-props-matched.json`.
 * Prefer: pnpm figma-props:fetch|extract|finalize|test
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

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

const DEFAULT_CACHE_DIR = ".figma/cache";
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

function toPascalCase(name) {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function hashContent(source) {
  return "sha256:" + crypto.createHash("sha256").update(source).digest("hex");
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
  const paths = cachePaths(args["cache-dir"] || DEFAULT_CACHE_DIR);
  const token = process.env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_TOKEN;
  if (!token) {
    console.error("❌ Missing FIGMA_ACCESS_TOKEN or FIGMA_TOKEN in .env");
    process.exit(1);
  }
  if (!args["file-key"] || !args["node-ids"]) {
    console.error("❌ Need --file-key and --node-ids");
    process.exit(1);
  }

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

function extractPropsFromSource(source, componentName) {
  const props = {};

  const ifaceRegex = new RegExp(
    `(?:interface|type)\\s+${componentName}Props\\b[^{]*\\{([\\s\\S]*?)\\}`,
  );
  const ifaceMatch = source.match(ifaceRegex);
  if (ifaceMatch) {
    const body = ifaceMatch[1];
    const fieldRegex = /^\s*(\w+)\??\s*:/gm;
    let m;
    while ((m = fieldRegex.exec(body)) !== null) {
      props[m[1]] = { source: "interface" };
    }
  }

  const cvaRegex =
    /cva\([\s\S]*?\{\s*variants:\s*\{([\s\S]*?)\}\s*,?\s*(?:compoundVariants|defaultVariants|\}\s*\))/;
  const cvaMatch = source.match(cvaRegex);
  if (cvaMatch) {
    const variantsBody = cvaMatch[1];
    const variantRegex = /(\w+):\s*\{([^}]*)\}/g;
    let vm;
    while ((vm = variantRegex.exec(variantsBody)) !== null) {
      const propName = vm[1];
      const valuesBlock = vm[2];
      const values = [...valuesBlock.matchAll(/(\w+):\s*["']/g)].map((x) => x[1]);
      props[propName] = { ...(props[propName] || {}), source: "cva", values };
    }
  }

  return props;
}

function cmdExtractCode(args) {
  const paths = cachePaths(args["cache-dir"] || DEFAULT_CACHE_DIR);
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

    if (cached && cached.hash === hash) {
      reused++;
      continue;
    }

    reparsed++;
    const stem = path.basename(filePath).replace(/\.tsx$/, "");
    const componentName = toPascalCase(stem);
    cache[filePath] = {
      hash,
      componentName,
      extractedAt: nowIso(),
      props: extractPropsFromSource(source, componentName),
    };
  }

  for (const knownPath of Object.keys(cache)) {
    if (!seenFiles.has(knownPath)) delete cache[knownPath];
  }

  ensureDir(paths.cacheDir);
  fs.writeFileSync(paths.codeCache, JSON.stringify(cache, null, 2));

  const codeComponents = {};
  for (const [filePath, entry] of Object.entries(cache)) {
    codeComponents[entry.componentName] = {
      file: filePath,
      props: entry.props,
    };
  }
  fs.writeFileSync(
    paths.codeRaw,
    JSON.stringify({ uiDir, scannedAt: nowIso(), components: codeComponents }, null, 2),
  );

  console.log(
    `✅ Extract ${Object.keys(codeComponents).length} comps / ${tsxFiles.length} tsx (cache ${reused}, parse ${reparsed}) → ${paths.codeRaw}`,
  );
  console.log(`   Next: write ${paths.matched} (Phase 2.5), then finalize`);
}

const REQUIRED_PROP_FIELDS = ["type", "mappingKind", "confidence"];
const VALID_CONFIDENCE = ["high", "medium", "low"];
const VALID_MAPPING_KIND = ["direct", "override", "composition", "unmapped"];

function validateMatched(matched) {
  const problems = [];
  for (const [compName, comp] of Object.entries(matched)) {
    if (!comp.props || typeof comp.props !== "object") {
      problems.push(`${compName}: missing props object`);
      continue;
    }
    for (const [propName, def] of Object.entries(comp.props)) {
      for (const field of REQUIRED_PROP_FIELDS) {
        if (!(field in def)) problems.push(`${compName}.${propName}: missing "${field}"`);
      }
      if (def.confidence && !VALID_CONFIDENCE.includes(def.confidence)) {
        problems.push(`${compName}.${propName}: bad confidence "${def.confidence}"`);
      }
      if (def.mappingKind && !VALID_MAPPING_KIND.includes(def.mappingKind)) {
        problems.push(
          `${compName}.${propName}: bad mappingKind "${def.mappingKind}" (${VALID_MAPPING_KIND.join("/")})`,
        );
        continue;
      }
      if (def.mappingKind === "direct" && !def.reactProp) {
        problems.push(`${compName}.${propName}: direct needs reactProp`);
      }
      if (def.mappingKind === "override" && !def.valueOverrides) {
        problems.push(`${compName}.${propName}: override needs valueOverrides`);
      }
      if ((def.mappingKind === "composition" || def.mappingKind === "unmapped") && !def.note) {
        problems.push(`${compName}.${propName}: ${def.mappingKind} needs note`);
      }
      if (def.mappingKind === "unmapped" && def.reactProp) {
        problems.push(`${compName}.${propName}: unmapped must not set reactProp`);
      }
    }
  }
  return problems;
}

function cmdFinalize(args) {
  const paths = cachePaths(args["cache-dir"] || DEFAULT_CACHE_DIR);
  if (!fs.existsSync(paths.matched)) {
    console.error(`❌ Missing ${paths.matched} (write Phase 2.5 matched first)`);
    process.exit(1);
  }
  if (!fs.existsSync(paths.raw)) {
    console.error(`❌ Missing ${paths.raw} — run fetch first`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(paths.raw, "utf-8"));
  const matched = JSON.parse(fs.readFileSync(paths.matched, "utf-8"));

  const problems = validateMatched(matched);
  if (problems.length > 0) {
    console.error(`❌ Invalid ${paths.matched}:`);
    problems.forEach((p) => console.error("   - " + p));
    process.exit(1);
  }

  const propMapDir = args["prop-map-dir"] || PROP_MAP_DIR;
  ensureDir(propMapDir);

  const groupedByComponent = {};
  for (const [figmaGroupName, comp] of Object.entries(matched)) {
    const key = comp.codeComponent || figmaGroupName;
    if (!groupedByComponent[key]) {
      groupedByComponent[key] = {
        codeComponent: comp.codeComponent || null,
        codeFile: comp.codeFile || null,
        figmaGroups: [],
        props: {},
      };
    }
    groupedByComponent[key].figmaGroups.push({
      name: figmaGroupName,
      figmaNodeId: comp.figmaNodeId,
    });
    for (const [propName, def] of Object.entries(comp.props)) {
      if (Object.prototype.hasOwnProperty.call(groupedByComponent[key].props, propName)) {
        console.warn(`⚠️  ${key}.${propName} overwritten by group "${figmaGroupName}"`);
      }
      groupedByComponent[key].props[propName] = def;
    }
  }

  const writtenFiles = [];
  for (const [componentKey, data] of Object.entries(groupedByComponent)) {
    const filePath = path.join(propMapDir, `${componentKey}.json`);
    const out = {
      generatedAt: nowIso(),
      fileKey: raw.fileKey,
      ...data,
    };
    fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
    writtenFiles.push(filePath);
  }

  console.log(`✅ Wrote ${writtenFiles.length} → ${propMapDir}/`);

  let totalProps = 0,
    high = 0,
    medium = 0,
    low = 0,
    compositionOnly = 0,
    unmapped = 0;

  for (const [componentKey, data] of Object.entries(groupedByComponent)) {
    const props = Object.values(data.props);
    const compHigh = props.filter((p) => p.confidence === "high").length;
    const compTotal = props.length;
    const groupNames = data.figmaGroups.map((g) => g.name).join(", ");

    totalProps += compTotal;
    high += compHigh;
    medium += props.filter((p) => p.confidence === "medium").length;
    low += props.filter((p) => p.confidence === "low").length;
    compositionOnly += props.filter((p) => p.mappingKind === "composition").length;
    unmapped += props.filter((p) => p.mappingKind === "unmapped").length;

    if (!data.codeComponent) {
      console.log(`❌ ${componentKey} — no codeComponent [${groupNames}]`);
    } else if (compHigh === compTotal) {
      console.log(`✅ ${componentKey} — ${compHigh}/${compTotal} high [${groupNames}]`);
    } else {
      console.log(`⚠️  ${componentKey} — ${compHigh}/${compTotal} high [${groupNames}]`);
    }
  }

  console.log(
    `props ${totalProps} | high ${high} | medium ${medium} | low ${low} | composition ${compositionOnly} | unmapped ${unmapped}`,
  );
  if (unmapped > 0) {
    console.log(`⚠️  ${unmapped} unmapped — check note in prop-map`);
  }
  console.log(`📌 Commit ${propMapDir}/`);

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

  console.error(
    "Usage: node figma-props-sync.cjs <fetch|extract-code|finalize> [--cache-dir .figma/cache] [--options]",
  );
  process.exit(1);
}

main();
