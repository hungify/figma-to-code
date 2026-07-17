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
  pass: boolean;
  figma: string;
  actual: string;
  diff: string;
  resized: boolean;
};

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

export function diffPngs(
  figmaPath: string,
  actualPath: string,
  options: {
    minMatch?: number;
    outDir?: string;
    threshold?: number;
  } = {},
): VisualScore {
  const minMatch = options.minMatch ?? Number(process.env.FIGMA_VISUAL_MIN_MATCH ?? 0.98);
  const threshold = options.threshold ?? 0.1;

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
    pass: matchRatio >= minMatch,
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
