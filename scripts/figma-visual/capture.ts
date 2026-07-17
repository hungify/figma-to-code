#!/usr/bin/env tsx
/**
 * Capture a route screenshot with Playwright Chromium.
 *
 *   pnpm figma-visual:capture -- \
 *     --url http://127.0.0.1:3000/feature/screen \
 *     --out .figma/artifacts/feature/screen/actual.png \
 *     [--viewport 1280x720] [--full-page]
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { chromium } from "@playwright/test";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function has(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const url = arg("--url");
  const out = arg("--out");
  if (!url || !out) {
    console.error(
      "Usage: figma-visual:capture -- --url <url> --out <actual.png> [--viewport 1280x720] [--full-page]",
    );
    process.exit(2);
  }

  const vp = arg("--viewport") ?? "1280x720";
  const [w, h] = vp.split("x").map(Number);
  if (!w || !h) {
    console.error(`Invalid --viewport ${vp}`);
    process.exit(2);
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    }
  });
  await page.screenshot({
    path: out,
    fullPage: has("--full-page"),
    animations: "disabled",
  });
  await browser.close();
  console.log(`wrote ${path.resolve(out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
