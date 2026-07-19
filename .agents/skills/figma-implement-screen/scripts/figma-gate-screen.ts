#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { checkDoneGate } from "figma-fidelity";

interface Evidence {
  filePath: string;
  contentHash: string;
}

interface VisualContract {
  id: string;
  sourceId: string;
  sourceNodeId: string;
  goldNodeId: string;
  role: "primary" | "supplemental";
  scope: "page" | "region";
  viewport: { name: "mobile" | "desktop"; width: number; height: number };
  outDir: string;
  profile: "page" | "component/strict";
  selector?: string;
  expectSize?: { width: number; height: number };
  pageReason?: string;
}

interface Artifact {
  name: string;
  target: { kind: "screen" };
  source: { fileKey: string };
  classificationEvidence?: Evidence;
  inventoryEvidence?: Evidence;
  ignoredInventoryNodes?: unknown[];
  entryComponents?: unknown[];
  implementationFiles: string[];
  resolved: Array<{ kind: "design-system" | "layout"; codeComponent: string }>;
  visualContracts: VisualContract[];
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const componentGate = path.join(scriptDir, "figma-gate-screen-components-internal.ts");

function fail(reasons: string[]): never {
  console.error("FAIL");
  for (const reason of reasons) console.error(`- ${reason}`);
  process.exit(1);
}

function parseArtifactPath(): string {
  const argv = process.argv.slice(2).filter((arg) => arg !== "--");
  if (argv.length !== 2 || argv[0] !== "--artifact" || !argv[1]) {
    fail(["usage: figma-gate-screen.ts --artifact <screen-implementation.json>"]);
  }
  return path.resolve(argv[1]);
}

function runStep(command: string, args: string[], label: string): void {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    fail([`${label} failed${output ? `:\n${output}` : ""}`]);
  }
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (output.includes("WARN")) {
    console.warn(`${label}:\n${output.trim()}`);
  }
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

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;
  } catch {
    fail([`unreadable JSON: ${file}`]);
  }
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

function validateVisuals(artifact: Artifact, reasons: string[]): number {
  const verdict = checkDoneGate({
    viewports: artifact.visualContracts.map((contract) => ({
      viewport: contract.viewport.name,
      outDir: path.resolve(contract.outDir),
      fileKey: artifact.source.fileKey,
      nodeId: contract.goldNodeId,
      profile: contract.profile,
      selector: contract.scope === "region" ? contract.selector : undefined,
      expectSize: contract.scope === "region" ? contract.expectSize : undefined,
    })),
    cwd: process.cwd(),
  });
  verdict.viewports.forEach((viewport, index) => {
    const contract = artifact.visualContracts[index];
    if (!contract) return;
    const integrityReasons = viewport.reasons.filter((reason) => !isVisualQualityReason(reason));
    if (integrityReasons.length > 0) {
      reasons.push(
        `visual contract ${contract.id} evidence invalid: ${integrityReasons.join("; ")}`,
      );
    }
    const scorePath = path.join(path.resolve(contract.outDir), "visual-score.json");
    if (!fs.existsSync(scorePath)) return;
    const score = readJson(scorePath) as Record<string, unknown>;
    const qualityReasons = viewport.reasons.filter(isVisualQualityReason);
    const summary = `${contract.id} match=${formatMatchRatio(score.matchRatio)} engine-pass=${String(score.pass === true)} diff=${path.join(path.resolve(contract.outDir), "diff.png")}`;
    if (qualityReasons.length > 0) {
      reasons.push(
        `visual contract ${contract.id} quality blocked: ${summary}; ${qualityReasons.join("; ")}`,
      );
    } else {
      console.log(`visual-review: ${summary}`);
    }
  });

  for (const contract of artifact.visualContracts) {
    const outDir = path.resolve(contract.outDir);
    const runMetaPath = path.join(outDir, "run-meta.json");
    if (!fs.existsSync(runMetaPath)) continue;
    const runMeta = readJson(runMetaPath) as Record<string, unknown>;
    const expectedViewportSize = {
      width: contract.viewport.width,
      height: contract.viewport.height,
    };
    if (!sameJson(runMeta.viewportSize, expectedViewportSize)) {
      reasons.push(
        `visual contract ${contract.id} runMeta.viewportSize mismatch: actual=${JSON.stringify(runMeta.viewportSize)} expected=${JSON.stringify(expectedViewportSize)}`,
      );
    }
  }
  return artifact.visualContracts.length;
}

function main() {
  const artifactPath = parseArtifactPath();
  const artifact = readJson(artifactPath) as Artifact;
  if (artifact.target.kind !== "screen") {
    fail([`figma-gate:screen requires target.kind=screen; got ${artifact.target.kind}`]);
  }
  const designSystemComponents = [
    ...new Set(
      (Array.isArray(artifact.resolved) ? artifact.resolved : [])
        .filter((resolution) => resolution.kind === "design-system")
        .map((resolution) => resolution.codeComponent),
    ),
  ];
  if (designSystemComponents.length > 0) {
    runStep(
      "pnpm",
      ["figma-props:check", "--", "--components", designSystemComponents.join(",")],
      "task prop-map freshness check",
    );
    runStep(
      "node",
      [
        ".agents/skills/figma-props-sync/scripts/figma-props-sync.cjs",
        "verify-source",
        "--components",
        designSystemComponents.join(","),
      ],
      "current Figma prop-source check",
    );
  }
  runStep(
    "pnpm",
    ["exec", "tsx", componentGate, "--artifact", artifactPath],
    "component contract gate",
  );
  if (artifact.inventoryEvidence) {
    runStep(
      "pnpm",
      ["figma-source:verify", "--", "--evidence", artifact.inventoryEvidence.filePath],
      "current screen source revision check",
    );
  }

  const reasons: string[] = [];
  const relativeArtifactPath = path.relative(process.cwd(), artifactPath).replace(/\\/g, "/");
  if (
    !relativeArtifactPath.startsWith(".figma/artifacts/screens/") ||
    path.basename(relativeArtifactPath) !== "screen-implementation.json"
  ) {
    reasons.push(
      "screen artifact must be .figma/artifacts/screens/<feature>/<screen>/screen-implementation.json",
    );
  }
  const taskDir = path.posix.dirname(relativeArtifactPath);
  if (!artifact.classificationEvidence) {
    reasons.push("classificationEvidence required by unified screen gate");
  }
  for (const [label, evidence] of [
    ["classificationEvidence", artifact.classificationEvidence],
    ["inventoryEvidence", artifact.inventoryEvidence],
  ] as const) {
    if (evidence && path.posix.dirname(evidence.filePath) !== taskDir) {
      reasons.push(`${label} must live beside screen-implementation.json`);
    }
  }
  for (const contract of artifact.visualContracts) {
    if (!contract.outDir.startsWith(`${taskDir}/`)) {
      reasons.push(`visual contract ${contract.id} escapes screen task directory`);
    }
  }
  if (!artifact.inventoryEvidence) reasons.push("inventoryEvidence required by unified gate");
  if (!Array.isArray(artifact.ignoredInventoryNodes)) {
    reasons.push("ignoredInventoryNodes[] required by unified gate (empty allowed)");
  }
  if (!Array.isArray(artifact.entryComponents)) {
    reasons.push(
      "entryComponents[] required by unified gate (empty allowed only when no local React roots)",
    );
  }
  const visualContracts = validateVisuals(artifact, reasons);
  if (reasons.length > 0) fail(reasons);

  console.log("PASS");
  console.log(`artifact: ${path.relative(process.cwd(), artifactPath)}`);
  console.log(`name: ${artifact.name}`);
  console.log(`implementation-files: ${artifact.implementationFiles.length}`);
  console.log(`visual-contracts-done: ${visualContracts}`);
  console.log(
    "gates: source-availability, inventory, prop-map, components, ownership, visual-done",
  );
  console.log("review: developer code review + visual diff + manual UI test required");
}

main();
