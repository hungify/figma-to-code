#!/usr/bin/env tsx
/**
 * component-lookup.ts — Component registry CLI for AI agents (Claude Code, Cursor)
 *
 * Commands:
 *   npx tsx scripts/component-lookup.ts info
 *   npx tsx scripts/component-lookup.ts list
 *   npx tsx scripts/component-lookup.ts docs <ComponentName>
 *   npx tsx scripts/component-lookup.ts figma "<FigmaNodePath>"
 *   npx tsx scripts/component-lookup.ts search <query>
 */

import * as fs from "fs";
import * as path from "path";

// ─── Load registry ────────────────────────────────────────────────────────────

const REGISTRY_PATH = path.resolve("./component-registry.json");

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error(
      `✗ component-registry.json not found.\n  Run: npx tsx scripts/gen-registry.ts --dir ./src/components --out ./component-registry.json`,
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatProps(props: Record<string, any>): string {
  const rows = Object.entries(props).map(([name, p]) => {
    const req = p.required ? "✅ required" : "optional";
    const def = p.defaultValue !== undefined ? `  default: ${p.defaultValue}` : "";
    return `  ${name}: ${p.type}\n    ${req}${def}${p.description ? `\n    ${p.description}` : ""}`;
  });
  return rows.join("\n\n");
}

function formatVariants(variants: Record<string, string[]>): string {
  if (Object.keys(variants).length === 0) return "  (none)";
  return Object.entries(variants)
    .map(([name, values]) => `  ${name}: ${values.map((v) => `"${v}"`).join(" | ")}`)
    .join("\n");
}

function buildUsageExample(component: any): string {
  const requiredProps = Object.entries(component.props)
    .filter(([, p]: any) => p.required)
    .map(([name, p]: any) => {
      if (p.type === "string") return `  ${name}="..."`;
      if (p.type === "boolean") return `  ${name}={true}`;
      if (p.type.includes("=>")) return `  ${name}={() => {}}`;
      if (p.type.includes("[]")) return `  ${name}={[]}`;
      // union — pick first variant
      const first = (component.variants[name] ?? [])[0];
      return first ? `  ${name}="${first}"` : `  ${name}={...}`;
    })
    .join("\n");

  return `import { ${component.name} } from "${component.importPath}";\n\n<${component.name}\n${requiredProps}\n/>`;
}

function printComponentDocs(component: any) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`COMPONENT: ${component.name}`);
  console.log(`${"─".repeat(60)}`);
  console.log(`\nImport path:\n  ${component.importPath}`);
  console.log(`\nFile:\n  ${component.filePath}`);
  console.log(`\nFigma nodes:`);
  component.figmaNodes.forEach((n: string) => console.log(`  • ${n}`));
  console.log(`\nProps:\n${formatProps(component.props)}`);
  console.log(`\nVariants:\n${formatVariants(component.variants)}`);
  console.log(`\nUsage example:\n`);
  console.log(buildUsageExample(component));
  console.log();
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdInfo(registry: any) {
  console.log(`\n📦 Component Registry`);
  console.log(`   Version:    ${registry.version}`);
  console.log(`   Generated:  ${new Date(registry.generatedAt).toLocaleString()}`);
  console.log(`   Components: ${registry.componentCount}`);
}

function cmdList(registry: any) {
  console.log(`\n📋 Registered Components (${registry.componentCount})\n`);
  for (const [name, c] of Object.entries(registry.components) as any) {
    const propCount = Object.keys(c.props).length;
    const variantCount = Object.keys(c.variants).length;
    console.log(`  ${name}`);
    console.log(`    Props: ${propCount}  Variants: ${variantCount}`);
    console.log(`    Figma: ${c.figmaNodes[0]}`);
    console.log();
  }
}

function cmdDocs(registry: any, componentName: string) {
  const component = registry.components[componentName];
  if (!component) {
    console.error(`✗ Component not found: ${componentName}`);
    console.error(`  Available: ${Object.keys(registry.components).join(", ")}`);
    process.exit(1);
  }
  printComponentDocs(component);
}

function cmdFigma(registry: any, nodePath: string) {
  const matches = Object.values(registry.components).filter((c: any) =>
    c.figmaNodes.some((n: string) => n.toLowerCase().includes(nodePath.toLowerCase())),
  );

  if (matches.length === 0) {
    console.error(`✗ No component found for Figma node: "${nodePath}"`);
    console.error(`  Try: npx tsx scripts/component-lookup.ts list`);
    process.exit(1);
  }

  console.log(`\n🎨 Found ${matches.length} component(s) for "${nodePath}"`);
  matches.forEach((c: any) => printComponentDocs(c));
}

function cmdSearch(registry: any, query: string) {
  const q = query.toLowerCase();
  const matches = Object.values(registry.components).filter((c: any) => {
    if (c.name.toLowerCase().includes(q)) return true;
    if (c.figmaNodes.some((n: string) => n.toLowerCase().includes(q))) return true;
    if (Object.keys(c.props).some((p) => p.toLowerCase().includes(q))) return true;
    return false;
  });

  if (matches.length === 0) {
    console.log(`✗ No results for "${query}"`);
    process.exit(1);
  }

  console.log(`\n🔍 ${matches.length} result(s) for "${query}"`);
  matches.forEach((c: any) => printComponentDocs(c));
}

// ─── Main ────────────────────────────────────────────────────────────────────

const [, , command, ...rest] = process.argv;

if (!command) {
  console.log(`Usage:
  npx tsx scripts/component-lookup.ts info
  npx tsx scripts/component-lookup.ts list
  npx tsx scripts/component-lookup.ts docs <ComponentName>
  npx tsx scripts/component-lookup.ts figma "<FigmaNodePath>"
  npx tsx scripts/component-lookup.ts search <query>`);
  process.exit(0);
}

const registry = loadRegistry();

switch (command) {
  case "info":
    cmdInfo(registry);
    break;
  case "list":
    cmdList(registry);
    break;
  case "docs":
    cmdDocs(registry, rest[0]);
    break;
  case "figma":
    cmdFigma(registry, rest.join(" "));
    break;
  case "search":
    cmdSearch(registry, rest.join(" "));
    break;
  default:
    console.error(`✗ Unknown command: ${command}`);
    process.exit(1);
}
