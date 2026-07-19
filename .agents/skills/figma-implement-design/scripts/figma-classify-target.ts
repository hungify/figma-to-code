#!/usr/bin/env tsx
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

interface Args {
  fileKey?: string;
  sources: Array<{ id: string; nodeId: string }>;
  out?: string;
  inputResponse?: string;
}

interface FigmaNode {
  id?: string;
  name?: string;
  type?: string;
  visible?: boolean;
  children?: FigmaNode[];
}

interface NodesResponse {
  version?: string;
  lastModified?: string;
  nodes?: Record<
    string,
    {
      document?: FigmaNode;
      components?: Record<string, unknown>;
      componentSets?: Record<string, unknown>;
    } | null
  >;
}

type TargetKind = "screen" | "design-system-component" | "ambiguous";

const SOURCE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NODE_ID = /^\d+:\d+$/;

function fail(message: string): never {
  console.error(`FAIL\n- ${message}`);
  process.exit(1);
}

function parseArgs(): Args {
  const argv = process.argv.slice(2).filter((arg) => arg !== "--");
  const parsed: Args = { sources: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--file-key" && value) parsed.fileKey = argv[++index];
    else if (arg === "--out" && value) parsed.out = argv[++index];
    else if (arg === "--input-response" && value) parsed.inputResponse = argv[++index];
    else if (arg === "--source" && value) {
      index += 1;
      const separator = value.indexOf("=");
      if (separator <= 0) fail(`invalid --source "${value}"; expected source-id=1:2`);
      parsed.sources.push({
        id: value.slice(0, separator),
        nodeId: value.slice(separator + 1).replace(/-/g, ":"),
      });
    } else fail(`unknown or incomplete argument: ${arg}`);
  }
  if (!parsed.fileKey || !parsed.out || parsed.sources.length === 0) {
    fail("usage: figma-classify --file-key <key> --source <id=1:2>... --out <path>");
  }
  for (const source of parsed.sources) {
    if (!SOURCE_ID.test(source.id)) fail(`invalid source id: ${source.id}`);
    if (!NODE_ID.test(source.nodeId)) fail(`invalid source nodeId: ${source.nodeId}`);
  }
  if (new Set(parsed.sources.map((source) => source.id)).size !== parsed.sources.length) {
    fail("duplicate source id");
  }
  if (new Set(parsed.sources.map((source) => source.nodeId)).size !== parsed.sources.length) {
    fail("duplicate source nodeId");
  }
  return parsed;
}

function loadEnvValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0 || trimmed.slice(0, separator).trim() !== key) continue;
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value;
    }
  }
  return undefined;
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

function contentHash(value: unknown): string {
  return `sha256:${crypto.createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}

async function fetchResponse(args: Args): Promise<NodesResponse> {
  if (args.inputResponse) {
    return JSON.parse(fs.readFileSync(args.inputResponse, "utf-8")) as NodesResponse;
  }
  const token = loadEnvValue("FIGMA_ACCESS_TOKEN");
  if (!token) fail("FIGMA_ACCESS_TOKEN missing from environment/.env.local/.env");
  const params = new URLSearchParams({
    ids: args.sources.map((source) => source.nodeId).join(","),
  });
  const response = await fetch(
    `https://api.figma.com/v1/files/${encodeURIComponent(args.fileKey!)}/nodes?${params}`,
    { headers: { "X-Figma-Token": token } },
  );
  if (!response.ok) fail(`Figma REST returned HTTP ${response.status}`);
  return (await response.json()) as NodesResponse;
}

function collectNodeIds(node: FigmaNode): Set<string> {
  const ids = new Set<string>();
  const visit = (current: FigmaNode): void => {
    if (current.id) ids.add(current.id);
    for (const child of current.children ?? []) visit(child);
  };
  visit(node);
  return ids;
}

function classify(
  node: FigmaNode,
  componentIds: Set<string>,
): { targetKind: TargetKind; reason: string } {
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    return { targetKind: "design-system-component", reason: `selected node type is ${node.type}` };
  }
  if (node.type === "SECTION") {
    const children = (node.children ?? []).filter((child) => child.visible !== false);
    const componentRoots = children.filter((child) => {
      if (["COMPONENT", "COMPONENT_SET"].includes(child.type ?? "")) return true;
      const childIds = collectNodeIds(child);
      return [...componentIds].some((id) => childIds.has(id));
    }).length;
    const screenRoots = children.filter((child) => {
      if (child.type !== "FRAME") return false;
      const childIds = collectNodeIds(child);
      return ![...componentIds].some((id) => childIds.has(id));
    }).length;
    const classifiedRoots = componentRoots + screenRoots;
    if (componentRoots > 0 && screenRoots === 0 && classifiedRoots === children.length) {
      return {
        targetKind: "design-system-component",
        reason: `SECTION contains ${componentRoots} direct component root(s) only`,
      };
    }
    if (screenRoots > 0 && componentRoots === 0 && classifiedRoots === children.length) {
      return {
        targetKind: "screen",
        reason: `SECTION contains ${screenRoots} direct frame(s) only`,
      };
    }
    return {
      targetKind: "ambiguous",
      reason: "SECTION contains mixed or unsupported direct children",
    };
  }
  const subtreeIds = collectNodeIds(node);
  const metadataComponentRoots = [...componentIds].filter((id) => subtreeIds.has(id));
  if (metadataComponentRoots.length > 0) {
    return {
      targetKind: "design-system-component",
      reason: `selected subtree contains ${metadataComponentRoots.length} component definition(s) from Figma metadata`,
    };
  }
  if (node.type === "FRAME") {
    return { targetKind: "screen", reason: "selected node type is FRAME" };
  }
  return {
    targetKind: "ambiguous",
    reason: `selected node type ${node.type ?? "missing"} needs its containing screen frame or source component root`,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const response = await fetchResponse(args);
  const results = args.sources.map((source) => {
    const entry = response.nodes?.[source.nodeId];
    const document = entry?.document;
    if (!document) fail(`Figma response missing source node ${source.id}=${source.nodeId}`);
    const componentIds = new Set([
      ...Object.keys(entry?.components ?? {}),
      ...Object.keys(entry?.componentSets ?? {}),
    ]);
    const verdict = classify(document, componentIds);
    return {
      sourceId: source.id,
      nodeId: source.nodeId,
      nodeType: document.type ?? "UNKNOWN",
      nodeName: document.name ?? "Unnamed",
      ...verdict,
    };
  });
  const distinct = new Set(results.map((result) => result.targetKind));
  const targetKind: TargetKind = distinct.size === 1 ? results[0]!.targetKind : "ambiguous";
  const routeSkill =
    targetKind === "screen"
      ? "figma-implement-screen"
      : targetKind === "design-system-component"
        ? "figma-implement-component"
        : null;
  const payload = {
    schemaVersion: 1 as const,
    generator: "figma-classify-target@1" as const,
    fileKey: args.fileKey!,
    sourceNodes: [...args.sources].sort((a, b) => a.id.localeCompare(b.id)),
    version: response.version ?? null,
    lastModified: response.lastModified ?? null,
    targetKind,
    routeSkill,
    results,
  };
  const artifact = { ...payload, contentHash: contentHash(payload) };
  const outPath = path.resolve(args.out!);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(targetKind === "ambiguous" ? "STOP" : "PASS");
  console.log(`classification: ${path.relative(process.cwd(), outPath)}`);
  console.log(`target-kind: ${targetKind}`);
  console.log(`route-skill: ${routeSkill ?? "ask-user"}`);
  console.log(`content-hash: ${artifact.contentHash}`);
  if (targetKind === "ambiguous") process.exitCode = 2;
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
