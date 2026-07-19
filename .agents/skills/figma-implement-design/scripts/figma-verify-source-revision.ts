#!/usr/bin/env tsx
import * as fs from "node:fs";
import * as path from "node:path";

interface SourceEvidence {
  fileKey: string;
  sourceNodes: Array<{ id: string; nodeId: string }>;
  version: string | null;
  lastModified: string | null;
}

function fail(message: string): never {
  console.error(`FAIL\n- ${message}`);
  process.exit(1);
}

function envValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
      const [candidate, ...rest] = line.split("=");
      if (candidate?.trim() !== key) continue;
      return rest
        .join("=")
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  }
  return undefined;
}

function evidencePath(): string {
  const argv = process.argv.slice(2).filter((arg) => arg !== "--");
  if (argv.length !== 2 || argv[0] !== "--evidence" || !argv[1]) {
    fail("usage: figma-verify-source-revision --evidence <generated-evidence.json>");
  }
  return path.resolve(argv[1]);
}

function readEvidence(file: string): SourceEvidence {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    fail(`unreadable evidence: ${file}`);
  }
  const evidence = value as Partial<SourceEvidence>;
  if (
    !evidence.fileKey ||
    !Array.isArray(evidence.sourceNodes) ||
    evidence.sourceNodes.length === 0 ||
    !evidence.sourceNodes.every((source) => source?.id && /^\d+:\d+$/.test(source.nodeId))
  ) {
    fail(`invalid source evidence: ${file}`);
  }
  return evidence as SourceEvidence;
}

async function main(): Promise<void> {
  const file = evidencePath();
  const evidence = readEvidence(file);
  const token = envValue("FIGMA_ACCESS_TOKEN");
  if (!token) fail("FIGMA_ACCESS_TOKEN missing");
  const ids = evidence.sourceNodes.map((source) => source.nodeId);
  const url = `https://api.figma.com/v1/files/${encodeURIComponent(evidence.fileKey)}/nodes?ids=${ids.join(",")}`;
  const response = await fetch(url, { headers: { "X-Figma-Token": token } });
  if (!response.ok) fail(`Figma REST returned HTTP ${response.status}`);
  const current = (await response.json()) as {
    version?: string;
    lastModified?: string;
    nodes?: Record<string, unknown>;
  };
  for (const id of ids) {
    if (!current.nodes?.[id]) fail(`current Figma response missing source node ${id}`);
  }
  const warnings: string[] = [];
  if ((current.version ?? null) !== evidence.version) {
    warnings.push(
      `Figma file version changed: evidence=${evidence.version} current=${current.version ?? null}`,
    );
  }
  if ((current.lastModified ?? null) !== evidence.lastModified) {
    warnings.push(
      `Figma file lastModified changed: evidence=${evidence.lastModified} current=${current.lastModified ?? null}`,
    );
  }
  console.log("PASS");
  for (const warning of warnings) {
    console.warn(
      `WARN\n- ${warning}\n- Refresh target evidence before final visual review when relevant.`,
    );
  }
  console.log(`source-revision: ${evidence.version ?? "null"}/${evidence.lastModified ?? "null"}`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
