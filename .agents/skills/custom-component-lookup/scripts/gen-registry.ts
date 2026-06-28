#!/usr/bin/env tsx
/**
 * gen-registry.ts
 * Scan custom React components và generate component-registry.json
 * Không cần JSDoc — chỉ cần TypeScript interface/type
 *
 * Usage:
 *   npx tsx scripts/gen-registry.ts --dir ./src/components --out ./component-registry.json
 *   npx tsx scripts/gen-registry.ts --dir ./src/components --figma-map ./figma-map.json --out ./component-registry.json
 */

import * as fs from "fs";
import * as path from "path";

import { glob } from "glob";
import * as docgen from "react-docgen-typescript";

// ─── CLI args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    dir: get("--dir") ?? "./src/components",
    out: get("--out") ?? "./component-registry.json",
    figmaMap: get("--figma-map"), // optional: path to figma-map.json
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PropEntry {
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

interface ComponentEntry {
  name: string;
  filePath: string;
  importPath: string;
  figmaNodes: string[]; // e.g. ["Facility/Card/Default", "Facility/Card/Compact"]
  props: Record<string, PropEntry>;
  variants: Record<string, string[]>; // union literal props
}

interface Registry {
  version: string;
  generatedAt: string;
  componentCount: number;
  components: Record<string, ComponentEntry>;
}

// ─── Figma node mapping ───────────────────────────────────────────────────────
// Convention: folder name → Figma group prefix
// Override via figma-map.json: { "FacilityCard": ["Facility/Card/Default", "Facility/Card/Compact"] }

function inferFigmaNodes(componentName: string, figmaMap: Record<string, string[]>): string[] {
  // 1. Explicit map wins
  if (figmaMap[componentName]) return figmaMap[componentName];

  // 2. Infer from name: FacilityCard → Facility/Card
  //    Split on PascalCase boundaries
  const parts = componentName
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ");
  if (parts.length >= 2) {
    const group = parts.slice(0, -1).join("/");
    const leaf = parts[parts.length - 1];
    return [`${group}/${leaf}/Default`];
  }

  // 3. Fallback: just the component name
  return [`${componentName}/Default`];
}

// ─── Extract variants (union literal props) ──────────────────────────────────

function extractVariants(rawProps: Record<string, docgen.PropItem>): Record<string, string[]> {
  const variants: Record<string, string[]> = {};
  for (const [name, prop] of Object.entries(rawProps)) {
    const values = (prop.type as any).value;
    if (Array.isArray(values) && values.length > 1) {
      variants[name] = values.map((v: any) => v.value.replace(/"/g, ""));
    }
  }
  return variants;
}

// ─── Derive import path from file path ───────────────────────────────────────

function deriveImportPath(filePath: string, baseDir: string): string {
  const rel = path.relative(baseDir, filePath).replace(/\\/g, "/");
  // Remove extension
  return "./" + rel.replace(/\.(tsx|ts)$/, "");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { dir, out, figmaMap: figmaMapPath } = parseArgs();

  const absDir = path.resolve(dir);
  const absOut = path.resolve(out);

  // Load figma-map.json if provided
  let figmaMap: Record<string, string[]> = {};
  if (figmaMapPath) {
    const mapFile = path.resolve(figmaMapPath);
    if (fs.existsSync(mapFile)) {
      figmaMap = JSON.parse(fs.readFileSync(mapFile, "utf-8"));
      console.log(`✓ Loaded figma-map from ${figmaMapPath}`);
    } else {
      console.warn(`⚠ figma-map not found: ${figmaMapPath}`);
    }
  }

  // Find all .tsx files
  const files = await glob(`${absDir}/**/*.tsx`, { ignore: ["**/*.test.*", "**/*.stories.*"] });

  if (files.length === 0) {
    console.error(`✗ No .tsx files found in ${absDir}`);
    process.exit(1);
  }

  console.log(`→ Scanning ${files.length} files in ${absDir}...`);

  // Setup react-docgen-typescript parser
  const tsconfigPath = path.resolve("./tsconfig.json");
  const parser = fs.existsSync(tsconfigPath)
    ? docgen.withCustomConfig(tsconfigPath, {
        shouldExtractLiteralValuesFromEnum: true,
        shouldRemoveUndefinedFromOptional: true,
        propFilter: (prop) => {
          // Filter out props inherited from node_modules (e.g. HTML attrs from React)
          if (prop.parent) {
            return !prop.parent.fileName.includes("node_modules");
          }
          return true;
        },
      })
    : docgen.withDefaultConfig();

  const registry: Registry = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    componentCount: 0,
    components: {},
  };

  for (const file of files) {
    let parsed: docgen.ComponentDoc[];
    try {
      parsed = parser.parse(file);
    } catch (e) {
      console.warn(`  ⚠ Skipped (parse error): ${path.relative(absDir, file)}`);
      continue;
    }

    if (parsed.length === 0) continue;

    for (const doc of parsed) {
      const props: Record<string, PropEntry> = {};

      for (const [propName, propInfo] of Object.entries(doc.props)) {
        // Use raw union string if available (e.g. '"primary" | "secondary"'), else type name
        const typeStr = (propInfo.type as any).raw ?? propInfo.type.name;
        props[propName] = {
          type: typeStr,
          required: propInfo.required,
          defaultValue: propInfo.defaultValue?.value ?? undefined,
          description: propInfo.description || undefined,
        };
      }

      const importPath = deriveImportPath(file, path.resolve("."));
      const figmaNodes = inferFigmaNodes(doc.displayName, figmaMap);
      const variants = extractVariants(doc.props);

      registry.components[doc.displayName] = {
        name: doc.displayName,
        filePath: path.relative(path.resolve("."), file),
        importPath,
        figmaNodes,
        props,
        variants,
      };

      console.log(`  ✓ ${doc.displayName} (${Object.keys(props).length} props)`);
    }
  }

  registry.componentCount = Object.keys(registry.components).length;

  // Write output
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(registry, null, 2), "utf-8");

  console.log(`\n✅ Registry generated: ${out}`);
  console.log(`   ${registry.componentCount} components indexed`);
}

main().catch((e) => {
  console.error("✗ Error:", e.message);
  process.exit(1);
});
