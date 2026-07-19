#!/usr/bin/env tsx
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

interface Node {
  id?: string;
  name?: string;
  type?: string;
  children?: Node[];
  componentPropertyDefinitions?: Record<
    string,
    {
      type?: string;
      defaultValue?: string | boolean;
      variantOptions?: string[];
      preferredValues?: Array<{ type?: string; key?: string }>;
    }
  >;
}

interface Args {
  fileKey?: string;
  sources: Array<{ id: string; nodeId: string }>;
  propMap?: string;
  out?: string;
  inputResponse?: string;
}

const NODE_ID = /^\d+:\d+$/;

function fail(message: string): never {
  console.error(`FAIL\n- ${message}`);
  process.exit(1);
}

function parseArgs(): Args {
  const argv = process.argv.slice(2).filter((arg) => arg !== "--");
  const args: Args = { sources: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--file-key" && value) args.fileKey = argv[++index];
    else if (arg === "--prop-map" && value) args.propMap = argv[++index];
    else if (arg === "--out" && value) args.out = argv[++index];
    else if (arg === "--input-response" && value) args.inputResponse = argv[++index];
    else if (arg === "--source" && value) {
      index += 1;
      const separator = value.indexOf("=");
      if (separator <= 0) fail(`invalid --source ${value}`);
      args.sources.push({
        id: value.slice(0, separator),
        nodeId: value.slice(separator + 1).replace(/-/g, ":"),
      });
    } else fail(`unknown or incomplete argument: ${arg}`);
  }
  if (!args.fileKey || !args.propMap || !args.out || args.sources.length === 0) {
    fail(
      "usage: figma-variant-inventory --file-key <key> --source <id=1:2> --prop-map <file> --out <file>",
    );
  }
  if (args.sources.some((source) => !NODE_ID.test(source.nodeId))) fail("invalid source nodeId");
  return args;
}

function envValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
      const separator = line.indexOf("=");
      if (separator <= 0 || line.slice(0, separator).trim() !== key) continue;
      return line
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  }
  return undefined;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: Buffer | string): string {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function findNode(node: Node, id: string): Node | undefined {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

function parseVariantName(name: string | undefined): Array<{ figmaProp: string; value: string }> {
  return (name ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.includes("="))
    .map((part) => {
      const separator = part.indexOf("=");
      return {
        figmaProp: part.slice(0, separator).trim(),
        value: part.slice(separator + 1).trim(),
      };
    });
}

async function main(): Promise<void> {
  const args = parseArgs();
  const propMapPath = path.resolve(args.propMap!);
  const propMap = JSON.parse(fs.readFileSync(propMapPath, "utf-8")) as {
    source: { fileKey: string; definitionHash: string };
    groups: Array<{ figmaNodeId: string; name: string }>;
  };
  if (propMap.source.fileKey !== args.fileKey) fail("prop map fileKey mismatch");
  let response: {
    version?: string;
    lastModified?: string;
    nodes?: Record<string, { document?: Node }>;
  };
  if (args.inputResponse) {
    response = JSON.parse(fs.readFileSync(args.inputResponse, "utf-8"));
  } else {
    const token = envValue("FIGMA_ACCESS_TOKEN");
    if (!token) fail("FIGMA_ACCESS_TOKEN missing");
    const requestedNodeIds = [
      ...new Set([
        ...args.sources.map((source) => source.nodeId),
        ...propMap.groups.map((group) => group.figmaNodeId),
      ]),
    ];
    const params = new URLSearchParams({
      ids: requestedNodeIds.join(","),
    });
    const result = await fetch(
      `https://api.figma.com/v1/files/${encodeURIComponent(args.fileKey!)}/nodes?${params}`,
      { headers: { "X-Figma-Token": token } },
    );
    if (!result.ok) fail(`Figma REST returned HTTP ${result.status}`);
    response = await result.json();
  }

  const sourceRoots = args.sources.map((source) => {
    const document = response.nodes?.[source.nodeId]?.document;
    if (!document) fail(`missing source node ${source.nodeId}`);
    return document;
  });
  const availableRoots = [
    ...sourceRoots,
    ...Object.values(response.nodes ?? {}).flatMap((entry) =>
      entry?.document ? [entry.document] : [],
    ),
  ];
  const entries: Array<{
    nodeId: string;
    groupNodeId: string;
    name: string;
    values: Array<{ figmaProp: string; value: string | boolean }>;
  }> = [];
  const domains: Array<{
    groupNodeId: string;
    figmaProp: string;
    figmaType: "VARIANT" | "BOOLEAN";
    values: Array<string | boolean>;
  }> = [];
  const definitions: Array<{
    name: string;
    figmaNodeId: string;
    propertyDefinitions: NonNullable<Node["componentPropertyDefinitions"]>;
  }> = [];
  for (const group of propMap.groups) {
    const groupNode = availableRoots.map((root) => findNode(root, group.figmaNodeId)).find(Boolean);
    if (!groupNode) fail(`prop-map group missing from source response: ${group.figmaNodeId}`);
    definitions.push({
      name: group.name,
      figmaNodeId: group.figmaNodeId,
      propertyDefinitions: groupNode.componentPropertyDefinitions ?? {},
    });
    for (const [figmaProp, definition] of Object.entries(
      groupNode.componentPropertyDefinitions ?? {},
    )) {
      if (definition.type === "VARIANT") {
        domains.push({
          groupNodeId: group.figmaNodeId,
          figmaProp,
          figmaType: "VARIANT",
          values: [...(definition.variantOptions ?? [])],
        });
      } else if (definition.type === "BOOLEAN") {
        domains.push({
          groupNodeId: group.figmaNodeId,
          figmaProp,
          figmaType: "BOOLEAN",
          values: [false, true],
        });
      }
    }
    const defaults = Object.entries(groupNode.componentPropertyDefinitions ?? {})
      .filter(
        ([, definition]) => definition.type !== "VARIANT" && definition.defaultValue !== undefined,
      )
      .map(([figmaProp, definition]) => ({ figmaProp, value: definition.defaultValue! }));
    const visit = (node: Node): void => {
      if (node.type === "COMPONENT" && node.id) {
        const nodeDefaults = Object.entries(node.componentPropertyDefinitions ?? {})
          .filter(([, definition]) => definition.defaultValue !== undefined)
          .map(([figmaProp, definition]) => ({ figmaProp, value: definition.defaultValue! }));
        const byProp = new Map(
          [...defaults, ...nodeDefaults, ...parseVariantName(node.name)].map((value) => [
            value.figmaProp,
            value,
          ]),
        );
        entries.push({
          nodeId: node.id,
          groupNodeId: group.figmaNodeId,
          name: node.name ?? "Unnamed",
          values: [...byProp.values()].sort((a, b) => a.figmaProp.localeCompare(b.figmaProp)),
        });
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(groupNode);
  }
  if (entries.length === 0) fail("no component variant nodes found");
  const definitionHash = hash(JSON.stringify(definitions));
  if (definitionHash !== propMap.source.definitionHash) {
    fail("prop map definitionHash mismatch; run figma-props-sync before variant inventory");
  }
  const payload = {
    schemaVersion: 3 as const,
    generator: "figma-variant-inventory@3" as const,
    fileKey: args.fileKey!,
    sourceNodes: [...args.sources].sort((a, b) => a.id.localeCompare(b.id)),
    version: response.version ?? null,
    lastModified: response.lastModified ?? null,
    definitionHash,
    propMapFile: path.relative(process.cwd(), propMapPath).replace(/\\/g, "/"),
    propMapHash: hash(fs.readFileSync(propMapPath)),
    domains: domains.sort((a, b) =>
      `${a.groupNodeId}:${a.figmaProp}`.localeCompare(`${b.groupNodeId}:${b.figmaProp}`),
    ),
    entries: entries.sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
  };
  const artifact = { ...payload, contentHash: hash(canonicalize(payload)) };
  const out = path.resolve(args.out!);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log("PASS");
  console.log(`variant-inventory: ${path.relative(process.cwd(), out)}`);
  console.log(`entries: ${entries.length}`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
