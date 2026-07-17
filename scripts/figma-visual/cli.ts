#!/usr/bin/env tsx
/**
 * Diff Figma gold PNG vs app capture. Writes diff.png + visual-score.json.
 *
 *   pnpm figma-visual:diff -- \
 *     --figma .figma/artifacts/x/y/figma-gold.png \
 *     --actual .figma/artifacts/x/y/actual.png \
 *     --out-dir .figma/artifacts/x/y \
 *     [--min-match 0.98]
 *
 * Exit 0 if matchRatio >= minMatch, else 1.
 */
import * as path from "node:path";

import { diffPngs } from "./diff";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const figma = arg("--figma");
  const actual = arg("--actual");
  if (!figma || !actual) {
    console.error(
      "Usage: figma-visual:diff -- --figma <gold.png> --actual <app.png> [--out-dir <dir>] [--min-match 0.98]",
    );
    process.exit(2);
  }

  const outDir = arg("--out-dir") ?? path.dirname(actual);
  const minRaw = arg("--min-match");
  const minMatch = minRaw !== undefined ? Number(minRaw) : undefined;

  const score = diffPngs(figma, actual, { outDir, minMatch });
  const pct = (score.matchRatio * 100).toFixed(2);
  const line = `matchRatio=${pct}% pass=${score.pass} diffPixels=${score.diffPixels}/${score.totalPixels} resized=${score.resized}`;
  console.log(line);
  console.log(`score: ${path.join(outDir, "visual-score.json")}`);
  console.log(`diff:  ${score.diff}`);

  process.exit(score.pass ? 0 : 1);
}

main();
