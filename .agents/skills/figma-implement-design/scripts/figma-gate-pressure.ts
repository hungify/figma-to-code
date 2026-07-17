#!/usr/bin/env tsx
/**
 * Pressure tests for figma-gate-components.
 * Cases that must FAIL without correct skill discipline; good case must PASS.
 */
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const gate = path.join(
  root,
  ".agents/skills/figma-implement-design/scripts/figma-gate-components.ts",
);
const fixtures = path.join(root, ".agents/skills/figma-implement-design/scripts/fixtures");

interface Case {
  name: string;
  expect: "PASS" | "FAIL";
  args: string[];
  mustInclude?: string[];
}

const cases: Case[] = [
  {
    name: "bad-extend",
    expect: "FAIL",
    args: [
      "--artifact",
      path.join(fixtures, "bad-extend/component-resolution.json"),
      "--require-prop-map",
    ],
    mustInclude: ["invalid decision"],
  },
  {
    name: "bad-raw-create",
    expect: "FAIL",
    args: [
      "--artifact",
      path.join(fixtures, "bad-raw-create/component-resolution.json"),
      "--files",
      path.join(fixtures, "bad-raw-create/BadRawCreate.tsx"),
    ],
    mustInclude: ["raw primitive markup"],
  },
  {
    name: "bad-figma-prop-name",
    expect: "FAIL",
    args: [
      "--artifact",
      path.join(fixtures, "bad-figma-prop-name/component-resolution.json"),
      "--files",
      path.join(fixtures, "bad-figma-prop-name/BadFigmaPropName.tsx"),
      "--require-prop-map",
      "--check-prop-map-usage",
    ],
    mustInclude: ["figma prop name"],
  },
  {
    name: "good-button",
    expect: "PASS",
    args: [
      "--artifact",
      path.join(fixtures, "good-button/component-resolution.json"),
      "--files",
      path.join(fixtures, "good-button/GoodButton.tsx"),
      "--require-prop-map",
      "--require-usage",
      "--check-prop-map-usage",
    ],
  },
];

let failed = 0;

for (const testCase of cases) {
  const result = spawnSync("pnpm", ["exec", "tsx", gate, ...testCase.args], {
    cwd: root,
    encoding: "utf-8",
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const passed = output.includes("PASS") && result.status === 0;
  const failedRun = output.includes("FAIL") || result.status !== 0;
  const ok =
    testCase.expect === "PASS"
      ? passed
      : failedRun && (testCase.mustInclude?.every((needle) => output.includes(needle)) ?? true);

  if (!ok) {
    failed += 1;
    console.error(`✗ ${testCase.name} (expected ${testCase.expect})`);
    console.error(output);
  } else {
    console.log(`✓ ${testCase.name} → ${testCase.expect}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} pressure case(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${cases.length} pressure cases ok`);
