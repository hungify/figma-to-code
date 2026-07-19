#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
interface Case {
  name: string;
  document: unknown;
  components?: Record<string, unknown>;
  componentSets?: Record<string, unknown>;
  expectedKind: "screen" | "design-system-component" | "ambiguous";
  expectedStatus: number;
}

const cases: Case[] = [
  {
    name: "frame-screen",
    document: { id: "1:2", name: "Login", type: "FRAME" },
    expectedKind: "screen",
    expectedStatus: 0,
  },
  {
    name: "component-set",
    document: { id: "1:2", name: "Button", type: "COMPONENT_SET" },
    expectedKind: "design-system-component",
    expectedStatus: 0,
  },
  {
    name: "component-set-returned-as-frame-wrapper",
    document: {
      id: "1:2",
      name: "Button",
      type: "FRAME",
      children: [{ id: "2:1", name: "State=Default", type: "COMPONENT" }],
    },
    components: { "2:1": { name: "State=Default" } },
    componentSets: { "1:2": { name: "Button" } },
    expectedKind: "design-system-component",
    expectedStatus: 0,
  },
  {
    name: "component-section-with-frame-wrappers",
    document: {
      id: "1:2",
      name: "Controls",
      type: "SECTION",
      children: [
        {
          id: "2:1",
          name: "Button",
          type: "FRAME",
          children: [{ id: "3:1", name: "State=Default", type: "COMPONENT" }],
        },
        {
          id: "2:2",
          name: "Input",
          type: "FRAME",
          children: [{ id: "3:2", name: "State=Default", type: "COMPONENT" }],
        },
      ],
    },
    components: {
      "3:1": { name: "State=Default" },
      "3:2": { name: "State=Default" },
    },
    componentSets: { "2:1": { name: "Button" } },
    expectedKind: "design-system-component",
    expectedStatus: 0,
  },
  {
    name: "screen-section",
    document: {
      id: "1:2",
      name: "Auth",
      type: "SECTION",
      children: [
        { id: "2:1", name: "Mobile", type: "FRAME" },
        { id: "2:2", name: "Desktop", type: "FRAME" },
      ],
    },
    expectedKind: "screen",
    expectedStatus: 0,
  },
  {
    name: "instance-ambiguous",
    document: { id: "1:2", name: "Button instance", type: "INSTANCE" },
    expectedKind: "ambiguous",
    expectedStatus: 2,
  },
  {
    name: "mixed-section",
    document: {
      id: "1:2",
      name: "Mixed",
      type: "SECTION",
      children: [
        { id: "2:1", name: "Button", type: "COMPONENT_SET" },
        { id: "2:2", name: "Login", type: "FRAME" },
      ],
    },
    componentSets: { "2:1": { name: "Button" } },
    expectedKind: "ambiguous",
    expectedStatus: 2,
  },
];

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "figma-classify-pressure-"));
let failures = 0;
try {
  for (const testCase of cases) {
    const input = path.join(temp, `${testCase.name}-input.json`);
    const out = path.join(temp, `${testCase.name}-out.json`);
    fs.writeFileSync(
      input,
      `${JSON.stringify({
        nodes: {
          "1:2": {
            document: testCase.document,
            components: testCase.components,
            componentSets: testCase.componentSets,
          },
        },
      })}\n`,
    );
    const result = spawnSync(
      "pnpm",
      [
        "figma-classify",
        "--",
        "--file-key",
        "fixture",
        "--source",
        "target=1:2",
        "--out",
        out,
        "--input-response",
        input,
      ],
      { cwd: root, encoding: "utf-8" },
    );
    const artifact = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf-8")) : null;
    const ok =
      result.status === testCase.expectedStatus && artifact?.targetKind === testCase.expectedKind;
    if (ok) console.log(`✓ ${testCase.name} → ${testCase.expectedKind}`);
    else {
      failures += 1;
      console.error(`✗ ${testCase.name}`);
      console.error(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    }
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

if (failures > 0) process.exit(1);
console.log(`\nAll ${cases.length} classifier pressure cases ok`);
