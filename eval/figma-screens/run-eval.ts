#!/usr/bin/env tsx
/**
 * Score-only eval: gate + Figma visual match for each enabled case.
 * Agent implement is manual / separate chat — this harness only grades.
 *
 *   pnpm figma-eval
 *   pnpm figma-eval -- --cases eval/figma-screens/cases
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { diffPngs } from "../../scripts/figma-visual/diff";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type CaseJson = {
  id: string;
  enabled?: boolean;
  artifactDir: string;
  figmaGold?: string;
  actual?: string;
  minMatch?: number;
  gate?: { artifact: string; files?: string[] };
};

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadCases(dir: string): { dir: string; meta: CaseJson }[] {
  if (!fs.existsSync(dir)) return [];
  const out: { dir: string; meta: CaseJson }[] = [];
  for (const name of fs.readdirSync(dir)) {
    const caseDir = path.join(dir, name);
    const metaPath = path.join(caseDir, "case.json");
    if (!fs.statSync(caseDir).isDirectory() || !fs.existsSync(metaPath)) continue;
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as CaseJson;
    out.push({ dir: caseDir, meta });
  }
  return out;
}

function runGate(meta: CaseJson): { ok: boolean; log: string } {
  if (!meta.gate?.artifact) return { ok: true, log: "gate skipped (no artifact)" };
  const gateScript = path.join(
    root,
    ".agents/skills/figma-implement-design/scripts/figma-gate-components.ts",
  );
  const args = [
    gateScript,
    "--artifact",
    path.resolve(root, meta.gate.artifact),
    "--require-prop-map",
  ];
  for (const f of meta.gate.files ?? []) {
    args.push("--files", path.resolve(root, f));
  }
  const r = spawnSync("pnpm", ["exec", "tsx", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  const log = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { ok: r.status === 0, log };
}

function main() {
  const casesDir = path.resolve(root, arg("--cases") ?? "eval/figma-screens/cases");
  const cases = loadCases(casesDir).filter(
    (c) => c.meta.enabled !== false && c.meta.id !== "_template",
  );

  if (cases.length === 0) {
    console.log("figma-eval: no enabled cases (add cases/<id>/case.json with enabled:true)");
    process.exit(0);
  }

  const results: Array<Record<string, unknown>> = [];
  let failed = 0;

  for (const { meta } of cases) {
    const artifactDir = path.resolve(root, meta.artifactDir);
    const gold = path.join(artifactDir, meta.figmaGold ?? "figma-gold.png");
    const actual = path.join(artifactDir, meta.actual ?? "actual.png");

    const gate = runGate(meta);
    let visual: { ok: boolean; matchRatio?: number; log: string } = {
      ok: false,
      log: "missing png",
    };

    if (fs.existsSync(gold) && fs.existsSync(actual)) {
      const score = diffPngs(gold, actual, {
        outDir: artifactDir,
        minMatch: meta.minMatch ?? Number(process.env.FIGMA_VISUAL_MIN_MATCH ?? 0.98),
      });
      visual = {
        ok: score.pass,
        matchRatio: score.matchRatio,
        log: `matchRatio=${(score.matchRatio * 100).toFixed(2)}% pass=${score.pass}`,
      };
    } else {
      visual.log = `missing files gold=${fs.existsSync(gold)} actual=${fs.existsSync(actual)}`;
    }

    const ok = gate.ok && visual.ok;
    if (!ok) failed++;
    results.push({
      id: meta.id,
      pass: ok,
      gate: gate.ok,
      visual: visual.ok,
      matchRatio: visual.matchRatio ?? null,
      gateLog: gate.log.trim().slice(0, 500),
      visualLog: visual.log,
    });
    console.log(
      `${ok ? "PASS" : "FAIL"} ${meta.id} gate=${gate.ok} visual=${visual.ok} ${visual.matchRatio != null ? `${(visual.matchRatio * 100).toFixed(2)}%` : ""}`,
    );
  }

  const outPath = path.join(root, "eval/figma-screens/last-scorecard.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ failed, results }, null, 2)}\n`);
  console.log(`scorecard: ${outPath}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
