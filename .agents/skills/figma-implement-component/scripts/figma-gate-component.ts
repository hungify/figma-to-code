#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { checkDoneGate } from "figma-fidelity";
import ts from "typescript";
import { z } from "zod";

const REPO_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+/;
const SOURCE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NODE_ID = /^\d+:\d+$/;
const HASH = /^sha256:[a-f0-9]{64}$/;

const evidenceSchema = z
  .object({ filePath: z.string().regex(REPO_PATH), contentHash: z.string().regex(HASH) })
  .strict();

const sourceNodeSchema = z
  .object({ id: z.string().regex(SOURCE_ID), nodeId: z.string().regex(NODE_ID) })
  .strict();

const artifactSchema = z
  .object({
    schemaVersion: z.literal(2),
    name: z.string().min(1),
    target: z
      .object({
        kind: z.literal("design-system-component"),
        componentName: z.string().regex(/^[A-Z][A-Za-z0-9]*$/),
        codeFile: z.string().startsWith("src/components/ui/").endsWith(".tsx"),
      })
      .strict(),
    source: z
      .object({ fileKey: z.string().min(1), nodes: z.array(sourceNodeSchema).min(1) })
      .strict(),
    classificationEvidence: evidenceSchema,
    propMapEvidence: evidenceSchema,
    variantEvidence: evidenceSchema,
    harness: z
      .object({
        filePath: z.string().regex(REPO_PATH).endsWith("-showcase.tsx"),
        route: z.string().startsWith("/showcase"),
        componentName: z.string().regex(/^[A-Z][A-Za-z0-9]*Showcase$/),
      })
      .strict(),
    requiredInteractionStates: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1),
    visualGaps: z.array(
      z
        .object({
          groupNodeId: z.string().regex(NODE_ID),
          figmaProp: z.string().min(1),
          value: z.boolean(),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    fidelityCases: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            sourceId: z.string().regex(SOURCE_ID),
            groupNodeId: z.string().regex(NODE_ID),
            goldNodeId: z.string().regex(NODE_ID),
            selector: z.string().min(1),
            expectSize: z
              .object({ width: z.number().int().positive(), height: z.number().int().positive() })
              .strict(),
            viewport: z
              .object({
                name: z.literal("desktop"),
                width: z.number().int().positive(),
                height: z.number().int().positive(),
              })
              .strict(),
            outDir: z.string().regex(REPO_PATH).startsWith(".figma/artifacts/design-system/"),
            profile: z.literal("component/strict"),
            interactionState: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            figmaValues: z.array(
              z
                .object({ figmaProp: z.string().min(1), value: z.union([z.string(), z.boolean()]) })
                .strict(),
            ),
          })
          .strict(),
      )
      .min(1),
    assets: z.array(
      z
        .object({
          figmaNode: z.string().min(1),
          kind: z.enum(["photo", "illustration", "logo", "decorative"]),
          filePath: z.string().regex(REPO_PATH),
          source: z.literal("figma-mcp"),
        })
        .strict(),
    ),
  })
  .strict();

const classificationSchema = z
  .object({
    schemaVersion: z.literal(1),
    generator: z.literal("figma-classify-target@1"),
    fileKey: z.string(),
    sourceNodes: z.array(sourceNodeSchema).min(1),
    version: z.string().nullable(),
    lastModified: z.string().nullable(),
    targetKind: z.literal("design-system-component"),
    routeSkill: z.literal("figma-implement-component"),
    results: z.array(z.unknown()),
    contentHash: z.string().regex(HASH),
  })
  .strict();

const variantInventorySchema = z
  .object({
    schemaVersion: z.literal(3),
    generator: z.literal("figma-variant-inventory@3"),
    fileKey: z.string().min(1),
    sourceNodes: z.array(sourceNodeSchema).min(1),
    version: z.string().nullable(),
    lastModified: z.string().nullable(),
    definitionHash: z.string().regex(HASH),
    propMapFile: z.string().regex(REPO_PATH),
    propMapHash: z.string().regex(HASH),
    domains: z.array(
      z
        .object({
          groupNodeId: z.string().regex(NODE_ID),
          figmaProp: z.string().min(1),
          figmaType: z.enum(["VARIANT", "BOOLEAN"]),
          values: z.array(z.union([z.string(), z.boolean()])).min(1),
        })
        .strict(),
    ),
    entries: z
      .array(
        z
          .object({
            nodeId: z.string().regex(NODE_ID),
            groupNodeId: z.string().regex(NODE_ID),
            name: z.string().min(1),
            values: z.array(
              z
                .object({
                  figmaProp: z.string().min(1),
                  value: z.union([z.string(), z.boolean()]),
                })
                .strict(),
            ),
          })
          .strict(),
      )
      .min(1),
    contentHash: z.string().regex(HASH),
  })
  .strict();

const propMapSchema = z
  .object({
    schemaVersion: z.literal(2),
    syncedAt: z.string().min(1),
    source: z
      .object({ fileKey: z.string().min(1), definitionHash: z.string().regex(HASH) })
      .strict(),
    target: z
      .object({
        component: z.string().min(1),
        file: z.string().min(1),
        apiHash: z.string().regex(HASH),
      })
      .strict(),
    groups: z.array(
      z
        .object({
          figmaNodeId: z.string().regex(NODE_ID),
          name: z.string().min(1),
          mappings: z.array(
            z
              .object({
                figmaProp: z.string().min(1),
                figmaType: z.string().min(1),
                mappingKind: z.enum(["direct", "override", "composition", "unmapped"]),
                valueMap: z.record(z.string(), z.unknown()).optional(),
                valueOverrides: z.record(z.string(), z.unknown()).optional(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .strict();

type Artifact = z.infer<typeof artifactSchema>;
type VariantInventory = z.infer<typeof variantInventorySchema>;

export function requiredEnumerableValues(
  groupNodeId: string,
  mapping: {
    figmaProp: string;
    figmaType: string;
    valueMap?: Record<string, unknown>;
    valueOverrides?: Record<string, unknown>;
  },
  variantInventory: VariantInventory | null,
): string[] {
  if (mapping.figmaType === "BOOLEAN") {
    return [
      ...new Set(
        (variantInventory?.entries ?? [])
          .filter((entry) => entry.groupNodeId === groupNodeId)
          .flatMap((entry) => entry.values)
          .filter((value) => value.figmaProp === mapping.figmaProp)
          .map((value) => String(value.value)),
      ),
    ];
  }
  if (mapping.figmaType === "VARIANT") {
    return (
      variantInventory?.domains.find(
        (domain) =>
          domain.groupNodeId === groupNodeId &&
          domain.figmaProp === mapping.figmaProp &&
          domain.figmaType === "VARIANT",
      )?.values ?? []
    ).map(String);
  }
  return Object.keys(mapping.valueMap ?? mapping.valueOverrides ?? {});
}

function fail(reasons: string[]): never {
  console.error("FAIL");
  for (const reason of reasons) console.error(`- ${reason}`);
  process.exit(1);
}

function parseArtifactPath(): string {
  const argv = process.argv.slice(2).filter((arg) => arg !== "--");
  if (argv.length !== 2 || argv[0] !== "--artifact" || !argv[1]) {
    fail(["usage: figma-gate-component.ts --artifact <component-implementation.json>"]);
  }
  return path.resolve(argv[1]);
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

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;
  } catch {
    fail([`unreadable JSON: ${file}`]);
  }
}

function runPropCheck(componentName: string): void {
  const result = spawnSync("pnpm", ["figma-props:check", "--", "--components", componentName], {
    cwd: process.cwd(),
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    fail([`prop-map freshness check failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`]);
  }
}

function runSourceRevisionCheck(evidencePath: string): void {
  const result = spawnSync("pnpm", ["figma-source:verify", "--", "--evidence", evidencePath], {
    cwd: process.cwd(),
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    fail([
      `current component source revision check failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    ]);
  }
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (output.includes("WARN")) {
    console.warn(`component source freshness:\n${output.trim()}`);
  }
}

function validateHashedJson<T>(
  evidence: { filePath: string; contentHash: string },
  schema: z.ZodType<T>,
  label: string,
  reasons: string[],
): T | null {
  if (!fs.existsSync(evidence.filePath)) {
    reasons.push(`${label} missing: ${evidence.filePath}`);
    return null;
  }
  const parsed = schema.safeParse(readJson(evidence.filePath));
  if (!parsed.success) {
    reasons.push(`${label} invalid: ${evidence.filePath}`);
    return null;
  }
  const value = parsed.data as T & { contentHash: string };
  const { contentHash, ...payload } = value;
  const actual = payloadHash(payload);
  if (contentHash !== actual || evidence.contentHash !== actual) {
    reasons.push(`${label} contentHash mismatch`);
  }
  return parsed.data;
}

function hasNamedComponent(file: string, componentName: string): boolean {
  if (!fs.existsSync(file)) return false;
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let declared = false;
  let exported = false;
  for (const statement of source.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const isExported = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name?.text === componentName
    ) {
      declared = true;
      exported ||= Boolean(isExported);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === componentName) {
          declared = true;
          exported ||= Boolean(isExported);
        }
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (element.name.text === componentName) exported = true;
      }
    }
  }
  return declared && exported;
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}

function harnessRouteExists(artifact: Artifact): boolean {
  return listFiles("src/routes/showcase")
    .filter((file) => file.endsWith(".tsx"))
    .some((file) => {
      const content = fs.readFileSync(file, "utf-8");
      return (
        content.includes(`createFileRoute("${artifact.harness.route}")`) &&
        content.includes(artifact.harness.componentName)
      );
    });
}

function validatePropMap(artifact: Artifact, reasons: string[]) {
  const evidence = artifact.propMapEvidence;
  const expectedPath = `.figma/prop-map/${artifact.target.componentName}.json`;
  if (evidence.filePath !== expectedPath) {
    reasons.push(`propMapEvidence.filePath must be ${expectedPath}`);
  }
  if (!fs.existsSync(evidence.filePath)) {
    reasons.push(`prop map missing: ${evidence.filePath}`);
    return null;
  }
  const raw = fs.readFileSync(evidence.filePath);
  if (sha256(raw) !== evidence.contentHash) reasons.push("propMapEvidence contentHash mismatch");
  const parsed = propMapSchema.safeParse(readJson(evidence.filePath));
  if (!parsed.success) {
    reasons.push(`prop map invalid: ${evidence.filePath}`);
    return null;
  }
  const propMap = parsed.data;
  if (propMap.source.fileKey !== artifact.source.fileKey) reasons.push("prop map fileKey mismatch");
  if (propMap.target.component !== artifact.target.componentName) {
    reasons.push("prop map target component mismatch");
  }
  if (propMap.target.file !== artifact.target.codeFile)
    reasons.push("prop map target file mismatch");
  return propMap;
}

function validateCoverage(
  artifact: Artifact,
  propMap: z.infer<typeof propMapSchema> | null,
  variantInventory: z.infer<typeof variantInventorySchema> | null,
  reasons: string[],
): void {
  if (!artifact.requiredInteractionStates.includes("default")) {
    reasons.push('requiredInteractionStates must include "default"');
  }
  const states = new Set(artifact.fidelityCases.map((item) => item.interactionState));
  for (const state of artifact.requiredInteractionStates) {
    if (!states.has(state)) reasons.push(`interaction state lacks fidelity case: ${state}`);
  }
  if (!propMap) return;
  const groups = new Map(propMap.groups.map((group) => [group.figmaNodeId, group]));
  const domains = new Map(
    (variantInventory?.domains ?? []).map((domain) => [
      `${domain.groupNodeId}\u0000${domain.figmaProp}`,
      domain,
    ]),
  );
  for (const testCase of artifact.fidelityCases) {
    if (!groups.has(testCase.groupNodeId)) {
      reasons.push(`fidelity case ${testCase.id} references unknown prop-map group`);
    }
    const seenProps = new Set<string>();
    for (const value of testCase.figmaValues) {
      if (seenProps.has(value.figmaProp)) {
        reasons.push(`fidelity case ${testCase.id} duplicates figmaProp ${value.figmaProp}`);
      }
      seenProps.add(value.figmaProp);
    }
  }
  for (const group of propMap.groups) {
    const cases = artifact.fidelityCases.filter((item) => item.groupNodeId === group.figmaNodeId);
    for (const mapping of group.mappings) {
      const domain = domains.get(`${group.figmaNodeId}\u0000${mapping.figmaProp}`);
      if (
        (mapping.figmaType === "VARIANT" || mapping.figmaType === "BOOLEAN") &&
        (!domain || domain.figmaType !== mapping.figmaType)
      ) {
        reasons.push(
          `enumerable Figma prop missing generated domain: group=${group.figmaNodeId} prop=${mapping.figmaProp} type=${mapping.figmaType}`,
        );
      }
      const values = requiredEnumerableValues(group.figmaNodeId, mapping, variantInventory);
      if (mapping.figmaType === "BOOLEAN" && values.length === 0) {
        reasons.push(
          `BOOLEAN Figma prop has no value represented by variant evidence: group=${group.figmaNodeId} prop=${mapping.figmaProp}`,
        );
      }
      if (mapping.figmaType === "BOOLEAN") {
        for (const booleanValue of [false, true]) {
          const represented = values.includes(String(booleanValue));
          const gaps = artifact.visualGaps.filter(
            (gap) =>
              gap.groupNodeId === group.figmaNodeId &&
              gap.figmaProp === mapping.figmaProp &&
              gap.value === booleanValue,
          );
          if (!represented && gaps.length !== 1) {
            reasons.push(
              `unrepresented BOOLEAN value requires exactly one visualGap: group=${group.figmaNodeId} prop=${mapping.figmaProp} value=${booleanValue}`,
            );
          }
          if (represented && gaps.length > 0) {
            reasons.push(
              `visualGap declared for represented BOOLEAN value: group=${group.figmaNodeId} prop=${mapping.figmaProp} value=${booleanValue}`,
            );
          }
        }
      }
      for (const value of values) {
        const covered = cases.some((testCase) =>
          testCase.figmaValues.some(
            (entry) => entry.figmaProp === mapping.figmaProp && String(entry.value) === value,
          ),
        );
        if (!covered) {
          reasons.push(
            `uncovered Figma value: group=${group.figmaNodeId} prop=${mapping.figmaProp} value=${value}`,
          );
        }
      }
    }
  }
}

function validateVariantInventory(
  artifact: Artifact,
  classification: z.infer<typeof classificationSchema> | null,
  propMap: z.infer<typeof propMapSchema> | null,
  reasons: string[],
): z.infer<typeof variantInventorySchema> | null {
  const inventory = validateHashedJson(
    artifact.variantEvidence,
    variantInventorySchema,
    "variant evidence",
    reasons,
  );
  if (!inventory) return null;
  if (inventory.fileKey !== artifact.source.fileKey) reasons.push("variant fileKey mismatch");
  if (inventory.propMapFile !== artifact.propMapEvidence.filePath) {
    reasons.push("variant propMapFile mismatch");
  }
  if (inventory.propMapHash !== artifact.propMapEvidence.contentHash) {
    reasons.push("variant propMapHash mismatch");
  }
  if (propMap && inventory.definitionHash !== propMap.source.definitionHash) {
    reasons.push("variant definitionHash does not match prop map");
  }
  if (classification && inventory.version !== classification.version) {
    reasons.push("variant version does not match classification");
  }
  if (classification && inventory.lastModified !== classification.lastModified) {
    reasons.push("variant lastModified does not match classification");
  }
  const expectedSources = artifact.source.nodes.map((node) => `${node.id}:${node.nodeId}`).sort();
  const actualSources = inventory.sourceNodes.map((node) => `${node.id}:${node.nodeId}`).sort();
  if (!sameJson(expectedSources, actualSources)) reasons.push("variant sourceNodes mismatch");
  const entries = new Map(inventory.entries.map((entry) => [entry.nodeId, entry]));
  if (entries.size !== inventory.entries.length) reasons.push("variant evidence duplicates nodeId");
  const domainKeys = new Set(
    inventory.domains.map((domain) => `${domain.groupNodeId}\u0000${domain.figmaProp}`),
  );
  if (domainKeys.size !== inventory.domains.length)
    reasons.push("variant evidence duplicates domain");
  for (const testCase of artifact.fidelityCases) {
    const entry = entries.get(testCase.goldNodeId);
    if (!entry) {
      reasons.push(`fidelity case ${testCase.id} goldNodeId absent from variant evidence`);
      continue;
    }
    if (entry.groupNodeId !== testCase.groupNodeId) {
      reasons.push(`fidelity case ${testCase.id} goldNodeId belongs to different prop-map group`);
    }
    for (const declared of testCase.figmaValues) {
      const bound = entry.values.some(
        (value) =>
          value.figmaProp === declared.figmaProp && String(value.value) === String(declared.value),
      );
      if (!bound) {
        reasons.push(
          `fidelity case ${testCase.id} value not bound to goldNodeId: ${declared.figmaProp}=${declared.value}`,
        );
      }
    }
  }
  return inventory;
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalize(left) === canonicalize(right);
}

function isVisualQualityReason(reason: string): boolean {
  return reason === "pass is not true." || reason === "blocking residual diff cluster remains.";
}

function formatMatchRatio(value: unknown): string {
  return typeof value === "number" ? `${(value * 100).toFixed(2)}%` : "n/a";
}

function validateVisuals(artifact: Artifact, reasons: string[]): void {
  const verdict = checkDoneGate({
    cwd: process.cwd(),
    viewports: artifact.fidelityCases.map((item) => ({
      viewport: item.viewport.name,
      outDir: path.resolve(item.outDir),
      fileKey: artifact.source.fileKey,
      nodeId: item.goldNodeId,
      profile: item.profile,
      selector: item.selector,
      expectSize: item.expectSize,
    })),
  });
  verdict.viewports.forEach((viewport, index) => {
    const testCase = artifact.fidelityCases[index];
    if (!testCase) return;
    const integrityReasons = viewport.reasons.filter((reason) => !isVisualQualityReason(reason));
    if (integrityReasons.length > 0) {
      reasons.push(`fidelity case ${testCase.id} evidence invalid: ${integrityReasons.join("; ")}`);
    }
    const scorePath = path.join(path.resolve(testCase.outDir), "visual-score.json");
    if (!fs.existsSync(scorePath)) return;
    const score = readJson(scorePath) as Record<string, unknown>;
    const qualityReasons = viewport.reasons.filter(isVisualQualityReason);
    const summary = `${testCase.id} match=${formatMatchRatio(score.matchRatio)} engine-pass=${String(score.pass === true)} diff=${path.join(path.resolve(testCase.outDir), "diff.png")}`;
    if (qualityReasons.length > 0) {
      console.warn(`VISUAL_REVIEW_REQUIRED: ${summary}; ${qualityReasons.join("; ")}`);
    } else {
      console.log(`visual-review: ${summary}`);
    }
  });
  for (const testCase of artifact.fidelityCases) {
    const outDir = path.resolve(testCase.outDir);
    const runMetaPath = path.join(outDir, "run-meta.json");
    if (!fs.existsSync(runMetaPath)) continue;
    const runMeta = readJson(runMetaPath) as Record<string, unknown>;
    const expectedViewportSize = {
      width: testCase.viewport.width,
      height: testCase.viewport.height,
    };
    if (!sameJson(runMeta.viewportSize, expectedViewportSize)) {
      reasons.push(`fidelity case ${testCase.id} runMeta.viewportSize mismatch`);
    }
  }
}

function main(): void {
  const artifactPath = parseArtifactPath();
  const parsed = artifactSchema.safeParse(readJson(artifactPath));
  if (!parsed.success) {
    fail([
      `component implementation artifact invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    ]);
  }
  const artifact = parsed.data;
  runPropCheck(artifact.target.componentName);
  runSourceRevisionCheck(artifact.variantEvidence.filePath);
  const reasons: string[] = [];
  const relativeArtifactPath = path.relative(process.cwd(), artifactPath).replace(/\\/g, "/");
  if (
    !relativeArtifactPath.startsWith(".figma/artifacts/design-system/") ||
    path.basename(relativeArtifactPath) !== "component-implementation.json"
  ) {
    reasons.push(
      "component artifact must be .figma/artifacts/design-system/<Component>/component-implementation.json",
    );
  }
  const taskDir = path.posix.dirname(relativeArtifactPath);
  for (const [label, evidence] of [
    ["classificationEvidence", artifact.classificationEvidence],
    ["variantEvidence", artifact.variantEvidence],
  ] as const) {
    if (path.posix.dirname(evidence.filePath) !== taskDir) {
      reasons.push(`${label} must live beside component-implementation.json`);
    }
  }
  const classification = validateHashedJson(
    artifact.classificationEvidence,
    classificationSchema,
    "classification evidence",
    reasons,
  );
  if (classification) {
    if (classification.fileKey !== artifact.source.fileKey)
      reasons.push("classification fileKey mismatch");
    const expected = artifact.source.nodes.map((node) => `${node.id}:${node.nodeId}`).sort();
    const actual = classification.sourceNodes.map((node) => `${node.id}:${node.nodeId}`).sort();
    if (!sameJson(expected, actual)) reasons.push("classification sourceNodes mismatch");
  }
  const propMap = validatePropMap(artifact, reasons);
  if (!hasNamedComponent(artifact.target.codeFile, artifact.target.componentName)) {
    reasons.push(`target codeFile lacks named export ${artifact.target.componentName}`);
  }
  if (!hasNamedComponent(artifact.harness.filePath, artifact.harness.componentName)) {
    reasons.push(`harness lacks named export ${artifact.harness.componentName}`);
  }
  if (!harnessRouteExists(artifact)) {
    reasons.push(
      `showcase route ${artifact.harness.route} does not mount ${artifact.harness.componentName}`,
    );
  }
  const selectors = new Set<string>();
  const ids = new Set<string>();
  const outDirs = new Set<string>();
  for (const testCase of artifact.fidelityCases) {
    if (selectors.has(testCase.selector))
      reasons.push(`duplicate fidelity selector: ${testCase.selector}`);
    if (ids.has(testCase.id)) reasons.push(`duplicate fidelity case id: ${testCase.id}`);
    if (outDirs.has(testCase.outDir)) reasons.push(`duplicate fidelity outDir: ${testCase.outDir}`);
    selectors.add(testCase.selector);
    ids.add(testCase.id);
    outDirs.add(testCase.outDir);
    const expectedSuffix = `/variants/${testCase.id}`;
    if (!testCase.outDir.endsWith(expectedSuffix)) {
      reasons.push(`fidelity case ${testCase.id} outDir must end with ${expectedSuffix}`);
    }
    if (!testCase.outDir.startsWith(`${taskDir}/variants/`)) {
      reasons.push(`fidelity case ${testCase.id} escapes component task directory`);
    }
    if (!artifact.source.nodes.some((node) => node.id === testCase.sourceId)) {
      reasons.push(`fidelity case ${testCase.id} has unknown sourceId`);
    }
  }
  for (const asset of artifact.assets) {
    if (!fs.existsSync(asset.filePath)) reasons.push(`asset missing: ${asset.filePath}`);
  }
  const variantInventory = validateVariantInventory(artifact, classification, propMap, reasons);
  validateCoverage(artifact, propMap, variantInventory, reasons);
  validateVisuals(artifact, reasons);
  if (reasons.length > 0) fail(reasons);

  console.log("PASS");
  console.log(`artifact: ${path.relative(process.cwd(), artifactPath)}`);
  console.log(`component: ${artifact.target.componentName}`);
  console.log(`fidelity-cases: ${artifact.fidelityCases.length}`);
  console.log(
    "gates: source-availability, classification, prop-map, variant-binding, API, coverage, fidelity",
  );
  console.log("review: developer code review + visual diff + manual UI test required");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
