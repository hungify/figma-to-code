#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { requiredEnumerableValues } from "./figma-gate-component";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const gate = path.join(
  root,
  ".agents/skills/figma-implement-component/scripts/figma-gate-component.ts",
);
const artifactRoot = `.figma/artifacts/design-system/PressureButton-${process.pid}`;
const absoluteRoot = path.join(root, artifactRoot);
const codeFile = "src/components/ui/button.tsx";
const propMapFile = ".figma/prop-map/Button.json";
const harnessFile = "src/components/button-showcase.tsx";
const definitionFixtureFile = path.join(
  root,
  ".agents/skills/figma-implement-component/scripts/fixtures/button-definition-groups.json",
);
const mockDir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-component-fetch-mock-"));
const mockFetchPath = path.join(mockDir, "mock-fetch.cjs");
const definitionGroups = JSON.parse(fs.readFileSync(definitionFixtureFile, "utf-8")).groups;
fs.writeFileSync(
  mockFetchPath,
  `const groups = ${JSON.stringify(definitionGroups)};\n` +
    "global.fetch = async (url) => { const ids = new URL(url).searchParams.get('ids').split(','); const byId = new Map(groups.map((group) => [group.figmaNodeId, group])); return { ok: true, status: 200, statusText: 'OK', json: async () => ({ version: 'fixture', lastModified: null, nodes: Object.fromEntries(ids.map((id) => { const group = byId.get(id); return [id, { document: group ? { id, name: group.name, type: 'COMPONENT_SET', componentPropertyDefinitions: group.propertyDefinitions } : { id, name: 'Source', type: 'FRAME' } }]; })) }) }; };\n",
);
const testEnv = {
  ...process.env,
  FIGMA_ACCESS_TOKEN: "pressure-token",
  NODE_OPTIONS: `--require=${mockFetchPath}`,
};

interface PressureFigmaValue {
  figmaProp: string;
  value: string | boolean;
}

interface PressureFidelityCase {
  id: string;
  sourceId: string;
  groupNodeId: string;
  goldNodeId: string;
  selector: string;
  expectSize: { width: number; height: number };
  viewport: { name: string; width: number; height: number };
  outDir: string;
  profile: string;
  interactionState: string;
  figmaValues: PressureFigmaValue[];
}

interface PressureVisualGap {
  groupNodeId: string;
  figmaProp: string;
  value: boolean;
  reason: string;
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

function sha256(content: Buffer | string): string {
  return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

function payloadHash(value: unknown): string {
  return sha256(canonicalize(value));
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeEvidence(outDir: string, nodeId: string, selector: string): void {
  const absolute = path.join(root, outDir);
  fs.mkdirSync(absolute, { recursive: true });
  const files = {
    gold: path.join(absolute, "figma-gold.png"),
    goldMeta: path.join(absolute, "figma-gold.meta.json"),
    actual: path.join(absolute, "actual.png"),
    diff: path.join(absolute, "diff.png"),
  };
  fs.writeFileSync(files.gold, "gold");
  fs.writeFileSync(files.actual, "actual");
  fs.writeFileSync(files.diff, "diff");
  const capturedAt = new Date().toISOString();
  writeJson(files.goldMeta, {
    fileKey: "k0CrXX6p2CCRPHpzEv3EaW",
    nodeId,
    fetchedAt: capturedAt,
  });
  const expectSize = { width: 160, height: 48 };
  const shared = {
    fileKey: "k0CrXX6p2CCRPHpzEv3EaW",
    nodeId,
    viewport: "desktop",
    profile: "component/strict",
    selector,
    expectSize,
  };
  writeJson(path.join(absolute, "visual-score.json"), {
    schemaVersion: 2,
    ...shared,
    pass: true,
    runType: "final",
    capturedAt,
    stability: "stable",
    outDir: absolute,
    gold: {
      path: files.gold,
      metaPath: files.goldMeta,
      fileKey: shared.fileKey,
      nodeId,
      fetchedAt: capturedAt,
    },
    topIssues: [],
    evidenceHashes: Object.fromEntries(
      Object.entries(files).map(([key, file]) => [key, sha256(fs.readFileSync(file))]),
    ),
  });
  writeJson(path.join(absolute, "run-meta.json"), {
    schemaVersion: 2,
    ...shared,
    viewportSize: { width: 1024, height: 768 },
  });
  writeJson(path.join(absolute, "punch-list.json"), {
    schemaVersion: 2,
    pass: true,
    items: [],
  });
}

function run(artifactPath: string, script = gate) {
  return spawnSync("pnpm", ["exec", "tsx", script, "--artifact", artifactPath], {
    cwd: root,
    env: testEnv,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function runPackage(command: "figma-gate:all" | "figma-gate:component", artifactPath: string) {
  return spawnSync("pnpm", [command, "--", "--artifact", artifactPath], {
    cwd: root,
    env: testEnv,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function runVariantInventory(responsePath: string, outPath: string, sourceNodeId = "18:3145") {
  return spawnSync(
    "pnpm",
    [
      "figma-variant-inventory",
      "--",
      "--file-key",
      "k0CrXX6p2CCRPHpzEv3EaW",
      "--source",
      `button=${sourceNodeId}`,
      "--prop-map",
      propMapFile,
      "--out",
      outPath,
      "--input-response",
      responsePath,
    ],
    { cwd: root, encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 },
  );
}

function assertCase(
  name: string,
  result: ReturnType<typeof run>,
  expectation: "PASS" | "FAIL",
  needle?: string,
): void {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok =
    expectation === "PASS"
      ? result.status === 0 && output.includes("PASS") && (!needle || output.includes(needle))
      : result.status !== 0 && output.includes("FAIL") && (!needle || output.includes(needle));
  if (!ok) throw new Error(`${name} expected ${expectation}\n${output}`);
  console.log(`✓ ${name} → ${expectation}`);
}

function main(): void {
  fs.mkdirSync(absoluteRoot, { recursive: true });
  try {
    const propMap = JSON.parse(fs.readFileSync(path.join(root, propMapFile), "utf-8"));
    const definitionFixture = JSON.parse(fs.readFileSync(definitionFixtureFile, "utf-8"));
    if (definitionFixture.definitionHash !== propMap.source.definitionHash) {
      throw new Error("button definition fixture is stale against committed prop map");
    }
    const definitionsByNodeId = new Map(
      definitionFixture.groups.map(
        (group: { figmaNodeId: string; propertyDefinitions: Record<string, unknown> }) => [
          group.figmaNodeId,
          group.propertyDefinitions,
        ],
      ),
    );
    const sourceNodes = [{ id: "button", nodeId: "18:3145" }];
    const classificationPayload = {
      schemaVersion: 1,
      generator: "figma-classify-target@1",
      fileKey: propMap.source.fileKey,
      sourceNodes,
      version: "fixture",
      lastModified: null,
      targetKind: "design-system-component",
      routeSkill: "figma-implement-component",
      results: [],
    };
    const classification = {
      ...classificationPayload,
      contentHash: payloadHash(classificationPayload),
    };
    const classificationPath = `${artifactRoot}/target-classification.json`;
    writeJson(path.join(root, classificationPath), classification);

    let caseIndex = 0;
    const fidelityCases: PressureFidelityCase[] = [];
    for (const group of propMap.groups) {
      const enumerable = group.mappings
        .map((mapping: Record<string, unknown>) => ({
          figmaProp: mapping.figmaProp as string,
          values:
            mapping.figmaType === "BOOLEAN"
              ? ["false", "true"]
              : Object.keys(
                  (mapping.valueMap ?? mapping.valueOverrides ?? {}) as Record<string, unknown>,
                ),
        }))
        .filter((mapping: { values: string[] }) => mapping.values.length > 0);
      const count = Math.max(
        1,
        ...enumerable.map((mapping: { values: string[] }) => mapping.values.length),
      );
      for (let index = 0; index < count; index += 1) {
        caseIndex += 1;
        const id = `group-${caseIndex}`;
        const nodeId = `900:${caseIndex}`;
        const selector = `[data-testid="figma.button.${id}"]`;
        const outDir = `${artifactRoot}/variants/${id}`;
        const figmaValues = enumerable.map((mapping: { figmaProp: string; values: string[] }) => ({
          figmaProp: mapping.figmaProp,
          value:
            mapping.values[index % mapping.values.length] === "true"
              ? true
              : mapping.values[index % mapping.values.length] === "false"
                ? false
                : mapping.values[index % mapping.values.length],
        }));
        fidelityCases.push({
          id,
          sourceId: "button",
          groupNodeId: group.figmaNodeId,
          goldNodeId: nodeId,
          selector,
          expectSize: { width: 160, height: 48 },
          viewport: { name: "desktop", width: 1024, height: 768 },
          outDir,
          profile: "component/strict",
          interactionState: "default",
          figmaValues,
        });
        makeEvidence(outDir, nodeId, selector);
      }
    }

    const artifact = {
      schemaVersion: 2,
      name: "Button",
      target: { kind: "design-system-component", componentName: "Button", codeFile },
      source: { fileKey: propMap.source.fileKey, nodes: sourceNodes },
      classificationEvidence: {
        filePath: classificationPath,
        contentHash: classification.contentHash,
      },
      propMapEvidence: {
        filePath: propMapFile,
        contentHash: sha256(fs.readFileSync(path.join(root, propMapFile))),
      },
      variantEvidence: { filePath: "", contentHash: "" },
      harness: {
        filePath: harnessFile,
        route: "/showcase/",
        componentName: "ButtonShowcase",
      },
      requiredInteractionStates: ["default"],
      visualGaps: [] as PressureVisualGap[],
      fidelityCases,
      assets: [],
    };
    const variantPath = `${artifactRoot}/figma-variant-inventory.json`;
    const variantResponsePath = path.join(absoluteRoot, "figma-variant-response.json");
    writeJson(variantResponsePath, {
      version: "fixture",
      lastModified: null,
      nodes: {
        "18:3145": {
          document: {
            id: "18:3145",
            name: "Button",
            type: "SECTION",
            children: propMap.groups.map((group: { figmaNodeId: string; name: string }) => ({
              id: group.figmaNodeId,
              name: group.name,
              type: "COMPONENT_SET",
              componentPropertyDefinitions: definitionsByNodeId.get(group.figmaNodeId),
              children: fidelityCases
                .filter((testCase) => testCase.groupNodeId === group.figmaNodeId)
                .map((testCase) => ({
                  id: testCase.goldNodeId,
                  name: testCase.id,
                  type: "COMPONENT",
                  componentPropertyDefinitions: Object.fromEntries(
                    testCase.figmaValues.map((value) => [
                      value.figmaProp,
                      {
                        type: typeof value.value === "boolean" ? "BOOLEAN" : "TEXT",
                        defaultValue: value.value,
                      },
                    ]),
                  ),
                })),
            })),
          },
        },
      },
    });
    assertCase(
      "variant-inventory-generator",
      runVariantInventory(variantResponsePath, variantPath),
      "PASS",
    );
    const staleDefinitionResponsePath = path.join(
      absoluteRoot,
      "stale-definition-figma-response.json",
    );
    const staleDefinitionResponse = JSON.parse(fs.readFileSync(variantResponsePath, "utf-8"));
    staleDefinitionResponse.nodes["18:3145"].document.children[0].componentPropertyDefinitions[
      "New property"
    ] = { type: "BOOLEAN", defaultValue: false };
    writeJson(staleDefinitionResponsePath, staleDefinitionResponse);
    assertCase(
      "variant-inventory-stale-definition",
      runVariantInventory(
        staleDefinitionResponsePath,
        `${artifactRoot}/stale-definition-inventory.json`,
      ),
      "FAIL",
      "prop map definitionHash mismatch",
    );
    const directVariantPath = `${artifactRoot}/direct-component-set-variant-inventory.json`;
    const directResponsePath = path.join(absoluteRoot, "direct-component-set-response.json");
    const variantResponse = JSON.parse(fs.readFileSync(variantResponsePath, "utf-8"));
    const groupNodes = variantResponse.nodes["18:3145"].document.children as Array<{
      id: string;
    }>;
    writeJson(directResponsePath, {
      version: "fixture",
      lastModified: null,
      nodes: Object.fromEntries(groupNodes.map((node) => [node.id, { document: node }])),
    });
    assertCase(
      "variant-inventory-direct-component-set",
      runVariantInventory(directResponsePath, directVariantPath, propMap.groups[0].figmaNodeId),
      "PASS",
    );
    const directInventory = JSON.parse(
      fs.readFileSync(path.join(root, directVariantPath), "utf-8"),
    );
    if (
      directInventory.sourceNodes.length !== 1 ||
      directInventory.sourceNodes[0]?.nodeId !== propMap.groups[0].figmaNodeId ||
      new Set(directInventory.entries.map((entry: { groupNodeId: string }) => entry.groupNodeId))
        .size !== propMap.groups.length
    ) {
      throw new Error("direct component-set inventory lost source binding or sibling groups");
    }
    const directVariantMapping = propMap.groups
      .flatMap((group: { figmaNodeId: string; mappings: Array<Record<string, unknown>> }) =>
        group.mappings.map((mapping) => ({ groupNodeId: group.figmaNodeId, mapping })),
      )
      .find(({ mapping }: { mapping: Record<string, unknown> }) => mapping.figmaType === "VARIANT");
    if (!directVariantMapping) throw new Error("pressure prop map lacks VARIANT mapping");
    const directWithoutValueMap = structuredClone(directVariantMapping.mapping) as {
      figmaProp: string;
      figmaType: string;
      valueMap?: Record<string, unknown>;
      valueOverrides?: Record<string, unknown>;
    };
    delete directWithoutValueMap.valueMap;
    const directDomainValues = requiredEnumerableValues(
      directVariantMapping.groupNodeId,
      directWithoutValueMap,
      directInventory,
    );
    const [, ...uncoveredDirectValues] = directDomainValues;
    if (directDomainValues.length < 2 || uncoveredDirectValues.length === 0) {
      throw new Error("direct VARIANT domain lost values when valueMap was absent");
    }
    console.log("✓ direct VARIANT without valueMap and partial coverage → FAIL");
    const variantInventory = JSON.parse(fs.readFileSync(path.join(root, variantPath), "utf-8"));
    if (variantInventory.definitionHash !== propMap.source.definitionHash) {
      throw new Error("variant inventory did not bind current definitionHash");
    }
    artifact.variantEvidence = {
      filePath: variantPath,
      contentHash: variantInventory.contentHash,
    };
    const artifactPath = path.join(absoluteRoot, "component-implementation.json");
    writeJson(artifactPath, artifact);
    assertCase("component-good", runPackage("figma-gate:component", artifactPath), "PASS");
    assertCase("component-dispatch", runPackage("figma-gate:all", artifactPath), "PASS");

    const staleDefinitionInventoryPayload = structuredClone(variantInventory);
    delete staleDefinitionInventoryPayload.contentHash;
    staleDefinitionInventoryPayload.definitionHash = `sha256:${"2".repeat(64)}`;
    const staleDefinitionInventory = {
      ...staleDefinitionInventoryPayload,
      contentHash: payloadHash(staleDefinitionInventoryPayload),
    };
    writeJson(path.join(root, variantPath), staleDefinitionInventory);
    const staleDefinitionArtifact = structuredClone(artifact);
    staleDefinitionArtifact.variantEvidence.contentHash = staleDefinitionInventory.contentHash;
    writeJson(artifactPath, staleDefinitionArtifact);
    assertCase(
      "component-stale-definition-artifact",
      run(artifactPath),
      "FAIL",
      "variant definitionHash does not match prop map",
    );

    const staleVersionInventoryPayload = structuredClone(variantInventory);
    delete staleVersionInventoryPayload.contentHash;
    staleVersionInventoryPayload.version = "stale-version";
    const staleVersionInventory = {
      ...staleVersionInventoryPayload,
      contentHash: payloadHash(staleVersionInventoryPayload),
    };
    writeJson(path.join(root, variantPath), staleVersionInventory);
    const staleVersionArtifact = structuredClone(artifact);
    staleVersionArtifact.variantEvidence.contentHash = staleVersionInventory.contentHash;
    writeJson(artifactPath, staleVersionArtifact);
    assertCase(
      "component-classification-inventory-version-drift",
      run(artifactPath),
      "FAIL",
      "variant version does not match classification",
    );
    writeJson(path.join(root, variantPath), variantInventory);

    const gapArtifact = structuredClone(artifact);
    const gapInventoryPayload = structuredClone(variantInventory);
    delete gapInventoryPayload.contentHash;
    const booleanGroup = propMap.groups.find(
      (group: { mappings: Array<Record<string, unknown>> }) =>
        group.mappings.some((mapping) => mapping.figmaType === "BOOLEAN"),
    );
    const booleanMapping = booleanGroup?.mappings.find(
      (mapping: Record<string, unknown>) => mapping.figmaType === "BOOLEAN",
    );
    for (const entry of gapInventoryPayload.entries) {
      if (entry.groupNodeId !== booleanGroup?.figmaNodeId) continue;
      entry.values = entry.values.filter(
        (value: { figmaProp: string; value: unknown }) =>
          !(value.figmaProp === booleanMapping?.figmaProp && value.value === false),
      );
    }
    const gapInventory = {
      ...gapInventoryPayload,
      contentHash: payloadHash(gapInventoryPayload),
    };
    writeJson(path.join(root, variantPath), gapInventory);
    gapArtifact.variantEvidence.contentHash = gapInventory.contentHash;
    for (const testCase of gapArtifact.fidelityCases) {
      testCase.figmaValues = testCase.figmaValues.filter(
        (value) => !(value.figmaProp === booleanMapping?.figmaProp && value.value === false),
      );
    }
    gapArtifact.visualGaps = [
      {
        groupNodeId: booleanGroup!.figmaNodeId,
        figmaProp: booleanMapping!.figmaProp,
        value: false,
        reason: "Pressure source has no false-state gold; behavior remains separately testable.",
      },
    ];
    writeJson(artifactPath, gapArtifact);
    assertCase("component-visual-gap-is-reviewable-without-logic-test", run(artifactPath), "PASS");
    writeJson(path.join(root, variantPath), variantInventory);

    const missingCoverage = structuredClone(artifact);
    const firstGroup = propMap.groups[0];
    const firstMapping = firstGroup?.mappings.find(
      (mapping: Record<string, unknown>) =>
        mapping.figmaType === "BOOLEAN" || mapping.valueMap || mapping.valueOverrides,
    );
    const uncoveredValue =
      firstMapping?.figmaType === "BOOLEAN"
        ? "false"
        : Object.keys(
            (firstMapping?.valueMap ?? firstMapping?.valueOverrides ?? {}) as Record<
              string,
              unknown
            >,
          )[0];
    for (const testCase of missingCoverage.fidelityCases) {
      if (testCase.groupNodeId !== firstGroup?.figmaNodeId) continue;
      testCase.figmaValues = testCase.figmaValues.filter(
        (entry) =>
          !(entry.figmaProp === firstMapping?.figmaProp && String(entry.value) === uncoveredValue),
      );
    }
    writeJson(artifactPath, missingCoverage);
    assertCase("component-uncovered-value", run(artifactPath), "FAIL", "uncovered Figma value");

    writeJson(artifactPath, {
      ...artifact,
      propMapEvidence: { ...artifact.propMapEvidence, contentHash: `sha256:${"f".repeat(64)}` },
    });
    assertCase(
      "component-prop-map-tamper",
      run(artifactPath),
      "FAIL",
      "propMapEvidence contentHash mismatch",
    );

    const unboundGold = structuredClone(artifact);
    unboundGold.fidelityCases[0]!.figmaValues[0]!.value = "not-the-gold-value";
    writeJson(artifactPath, unboundGold);
    assertCase(
      "component-unbound-gold-value",
      run(artifactPath),
      "FAIL",
      "value not bound to goldNodeId",
    );

    const visualDrift = structuredClone(artifact);
    const firstCase = visualDrift.fidelityCases[0]!;
    const scorePath = path.join(root, firstCase.outDir as string, "visual-score.json");
    const score = JSON.parse(fs.readFileSync(scorePath, "utf-8"));
    writeJson(scorePath, {
      ...score,
      pass: false,
      matchRatio: 0.9,
      topIssues: [{ kind: "residual", severity: "high", message: "Pressure mismatch." }],
    });
    writeJson(artifactPath, visualDrift);
    assertCase(
      "component-visual-quality-defers-to-developer",
      run(artifactPath),
      "PASS",
      "VISUAL_REVIEW_REQUIRED",
    );
    writeJson(scorePath, score);
    writeJson(scorePath, { ...score, selector: "[data-testid=wrong]" });
    writeJson(artifactPath, visualDrift);
    assertCase(
      "component-visual-drift",
      run(artifactPath),
      "FAIL",
      "selector does not match contract",
    );

    console.log("\nAll 14 component pressure cases ok");
  } finally {
    fs.rmSync(absoluteRoot, { recursive: true, force: true });
    fs.rmSync(mockDir, { recursive: true, force: true });
  }
}

main();
