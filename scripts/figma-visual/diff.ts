import * as fs from "node:fs";
import * as path from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export type VisualScore = {
  matchRatio: number;
  diffPixels: number;
  totalPixels: number;
  width: number;
  height: number;
  minMatch: number;
  maxDiffPixels: number | null;
  threshold: number;
  worstCellMatchRatio: number;
  clusterFail: boolean;
  pass: boolean;
  figma: string;
  actual: string;
  diff: string;
  resized: boolean;
};

const DEFAULT_MIN_MATCH = 0.99;
/** Playwright-style per-pixel YIQ threshold */
const DEFAULT_THRESHOLD = 0.2;
const CLUSTER_GRID = 4;
/** Fail full-page pass when one grid cell is this far below minMatch */
const CLUSTER_SLACK = 0.02;

export function readPng(filePath: string): PNG {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

/** Nearest-neighbor resize to target w×h. */
export function resizeNearest(src: PNG, width: number, height: number): PNG {
  if (src.width === width && src.height === height) return src;
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / width));
      const si = (src.width * sy + sx) << 2;
      const di = (width * y + x) << 2;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

/** True red diff pixel (exclude AA yellow from includeAA). */
function isRealDiffPixel(data: Buffer | Uint8Array, i: number): boolean {
  return data[i] > 200 && data[i + 1] < 80 && data[i + 2] < 80 && data[i + 3] > 128;
}

/**
 * Count real (red) diffs per grid cell → worst cell match ratio.
 * Catches chrome-ok / card-wrong without counting AA yellow noise.
 */
export function worstGridMatchRatio(diff: PNG, grid = CLUSTER_GRID): number {
  const { width, height, data } = diff;
  const cellW = Math.ceil(width / grid);
  const cellH = Math.ceil(height / grid);
  let worst = 1;

  for (let cy = 0; cy < grid; cy++) {
    for (let cx = 0; cx < grid; cx++) {
      const x0 = cx * cellW;
      const y0 = cy * cellH;
      const x1 = Math.min(width, x0 + cellW);
      const y1 = Math.min(height, y0 + cellH);
      let cellDiff = 0;
      let cellTotal = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          cellTotal += 1;
          const i = (width * y + x) << 2;
          if (isRealDiffPixel(data, i)) cellDiff += 1;
        }
      }
      if (cellTotal === 0) continue;
      const cellMatch = 1 - cellDiff / cellTotal;
      if (cellMatch < worst) worst = cellMatch;
    }
  }

  return worst;
}

function parseOptionalNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function diffPngs(
  figmaPath: string,
  actualPath: string,
  options: {
    minMatch?: number;
    maxDiffPixels?: number | null;
    outDir?: string;
    threshold?: number;
    /** When true (default), fail if a grid cell is much worse than overall (full-page trap) */
    clusterCheck?: boolean;
  } = {},
): VisualScore {
  const minMatch =
    options.minMatch ?? parseOptionalNumber(process.env.FIGMA_VISUAL_MIN_MATCH, DEFAULT_MIN_MATCH);
  const threshold =
    options.threshold ?? parseOptionalNumber(process.env.FIGMA_VISUAL_THRESHOLD, DEFAULT_THRESHOLD);

  const maxDiffEnv = process.env.FIGMA_VISUAL_MAX_DIFF_PIXELS;
  const maxDiffPixels =
    options.maxDiffPixels !== undefined
      ? options.maxDiffPixels
      : maxDiffEnv !== undefined && maxDiffEnv !== ""
        ? Number(maxDiffEnv)
        : null;

  const clusterCheck = options.clusterCheck ?? process.env.FIGMA_VISUAL_CLUSTER_CHECK !== "0";

  const figma = readPng(figmaPath);
  let actual = readPng(actualPath);
  let resized = false;

  if (actual.width !== figma.width || actual.height !== figma.height) {
    actual = resizeNearest(actual, figma.width, figma.height);
    resized = true;
  }

  const { width, height } = figma;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(figma.data, actual.data, diff.data, width, height, {
    threshold,
    includeAA: true,
  });
  const totalPixels = width * height;
  const matchRatio = totalPixels === 0 ? 0 : 1 - diffPixels / totalPixels;

  const worstCellMatchRatio = worstGridMatchRatio(diff);
  const clusterFail =
    clusterCheck && matchRatio >= minMatch && worstCellMatchRatio < minMatch - CLUSTER_SLACK;

  const ratioPass = matchRatio >= minMatch;
  const pixelBudgetPass =
    maxDiffPixels == null || !Number.isFinite(maxDiffPixels) || diffPixels <= maxDiffPixels;
  const pass = ratioPass && pixelBudgetPass && !clusterFail;

  const outDir = options.outDir ?? path.dirname(actualPath);
  fs.mkdirSync(outDir, { recursive: true });
  const diffPath = path.join(outDir, "diff.png");
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const score: VisualScore = {
    matchRatio,
    diffPixels,
    totalPixels,
    width,
    height,
    minMatch,
    maxDiffPixels: maxDiffPixels != null && Number.isFinite(maxDiffPixels) ? maxDiffPixels : null,
    threshold,
    worstCellMatchRatio,
    clusterFail,
    pass,
    figma: path.resolve(figmaPath),
    actual: path.resolve(actualPath),
    diff: path.resolve(diffPath),
    resized,
  };

  fs.writeFileSync(path.join(outDir, "visual-score.json"), `${JSON.stringify(score, null, 2)}\n`);
  return score;
}

/** Solid RGBA PNG for fixtures. */
export function makeSolidPng(
  width: number,
  height: number,
  rgba: [number, number, number, number],
) {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const o = i << 2;
    png.data[o] = rgba[0];
    png.data[o + 1] = rgba[1];
    png.data[o + 2] = rgba[2];
    png.data[o + 3] = rgba[3];
  }
  return png;
}

export function writePng(filePath: string, png: PNG) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG.sync.write(png));
}
