#!/usr/bin/env tsx
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const baseSkillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.dirname(baseSkillRoot);
const repoRoot = path.resolve(skillsRoot, "../..");
const agentMetadataSkillNames = [
  "figma-implement-design",
  "figma-implement-screen",
  "figma-implement-component",
] as const;
const canonicalSkillNames = [...agentMetadataSkillNames, "figma-props-sync"] as const;
type CanonicalSkillName = (typeof canonicalSkillNames)[number];
const errors: string[] = [];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function relative(file: string): string {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

function validateSkill(skillName: CanonicalSkillName): void {
  const skillRoot = path.join(skillsRoot, skillName);
  const skillFile = path.join(skillRoot, "SKILL.md");
  const metadataPath = path.join(skillRoot, "agents/openai.yaml");
  if (!fs.existsSync(skillFile)) {
    errors.push(`${skillName}/SKILL.md: missing`);
    return;
  }
  const content = fs.readFileSync(skillFile, "utf-8");
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    errors.push(`${skillName}/SKILL.md: YAML frontmatter missing`);
  } else {
    const fields = match[1]
      .split("\n")
      .filter((line) => /^[a-z][a-z0-9-]*:/.test(line))
      .map((line) => line.slice(0, line.indexOf(":")));
    const actual = [...new Set(fields)].sort();
    if (JSON.stringify(actual) !== JSON.stringify(["description", "name"])) {
      errors.push(`${skillName}/SKILL.md: frontmatter fields must be name + description`);
    }
    const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    if (name !== skillName) errors.push(`${skillName}/SKILL.md: name mismatch (${name})`);
    const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
    if (description.length < 80)
      errors.push(`${skillName}/SKILL.md: trigger description too short`);
  }
  if (content.includes("TODO")) errors.push(`${skillName}/SKILL.md: unresolved TODO`);
  if (content.split("\n").length > 500) errors.push(`${skillName}/SKILL.md: exceeds 500 lines`);

  const requiresAgentMetadata = (agentMetadataSkillNames as readonly string[]).includes(skillName);
  if (requiresAgentMetadata && !fs.existsSync(metadataPath)) {
    errors.push(`${skillName}/agents/openai.yaml: missing`);
  } else if (requiresAgentMetadata) {
    const metadata = fs.readFileSync(metadataPath, "utf-8");
    if (!metadata.includes(`$${skillName}`)) {
      errors.push(`${skillName}/agents/openai.yaml: default_prompt must mention $${skillName}`);
    }
    const referencedAssets = new Set(
      [...metadata.matchAll(/\.\/assets\/[^"'\s]+/g)].map((asset) => asset[0].slice(2)),
    );
    for (const asset of walk(path.join(skillRoot, "assets"))) {
      const assetPath = path.relative(skillRoot, asset).replace(/\\/g, "/");
      if (!referencedAssets.has(assetPath)) errors.push(`${skillName}/${assetPath}: unused asset`);
    }
    for (const asset of referencedAssets) {
      if (!fs.existsSync(path.join(skillRoot, asset))) {
        errors.push(`${skillName}/agents/openai.yaml: missing referenced asset ${asset}`);
      }
    }
  }

  for (const file of walk(skillRoot).filter((candidate) => candidate.endsWith(".md"))) {
    const markdown = fs.readFileSync(file, "utf-8");
    if (
      path.basename(file) !== "SKILL.md" &&
      markdown.split("\n").length > 100 &&
      !markdown.includes("## Contents")
    ) {
      errors.push(`${relative(file)}: long reference requires Contents section`);
    }
    for (const link of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = link[1].split("#", 1)[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
        errors.push(`${relative(file)}: broken local link ${link[1]}`);
      }
    }
  }
  for (const file of walk(skillRoot)) {
    if (path.basename(file) === ".DS_Store") errors.push(`${relative(file)}: forbidden metadata`);
  }
}

for (const skillName of canonicalSkillNames) validateSkill(skillName);

const required: Record<CanonicalSkillName, string[]> = {
  "figma-implement-design": [
    "references/classification.md",
    "references/validation.md",
    "scripts/figma-classify-pressure.ts",
    "scripts/figma-classify-target.ts",
    "scripts/figma-gate-dispatch.ts",
    "scripts/figma-verify-source-revision.ts",
    "scripts/validate-skill.ts",
  ],
  "figma-implement-screen": [
    "references/automation.md",
    "references/contract.md",
    "references/structure.md",
    "references/visual.md",
    "scripts/figma-gate-screen-components-pressure.ts",
    "scripts/figma-gate-screen-components-internal.ts",
    "scripts/figma-gate-screen-pressure.ts",
    "scripts/figma-gate-screen.ts",
    "scripts/figma-inventory.ts",
    "scripts/fixtures/good-screen/component-resolution.json",
  ],
  "figma-implement-component": [
    "references/contract.md",
    "references/visual.md",
    "scripts/figma-gate-component-pressure.ts",
    "scripts/figma-gate-component.ts",
    "scripts/fixtures/button-definition-groups.json",
    "scripts/figma-variant-inventory.ts",
  ],
  "figma-props-sync": [
    "references/schema.md",
    "scripts/figma-props-pressure.ts",
    "scripts/figma-props-sync.cjs",
  ],
};
for (const [skillName, files] of Object.entries(required)) {
  for (const file of files) {
    if (!fs.existsSync(path.join(skillsRoot, skillName, file))) {
      errors.push(`${skillName}/${file}: required surface missing`);
    }
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8")) as {
  scripts?: Record<string, string>;
};
for (const command of [
  "figma-classify",
  "figma-gate:all",
  "figma-gate:component",
  "figma-gate:screen",
  "figma-gate:test",
  "figma-inventory",
  "figma-props:test",
  "figma-props:verify-source",
  "figma-skill:validate",
  "figma-source:verify",
  "figma-variant-inventory",
]) {
  if (!packageJson.scripts?.[command]) errors.push(`package.json: missing ${command}`);
}
if (!packageJson.scripts?.check?.includes("pnpm figma-props:test")) {
  errors.push("package.json: check must run figma-props:test");
}

if (errors.length > 0) {
  console.error("FAIL");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("PASS");
console.log(`skills: ${canonicalSkillNames.join(", ")}`);
console.log(
  "checks: frontmatter, triggers, progressive disclosure, metadata, links, assets, canonical surfaces",
);
