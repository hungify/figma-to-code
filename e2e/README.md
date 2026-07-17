# Visual verify — Figma implement screens only

Playwright harness for **visual regression on screens produced by `figma-implement-design`**.

Not in scope: showcase (`/showcase`), DS matrix, functional smoke.

## Layout

```
e2e/
  support/                 # fixtures, constants, visual helpers
  pages/screens/           # Page Objects for feature screens
  visual/                  # <feature>/<screen>.visual.spec.ts
playwright.config.ts
```

## Commands

```bash
pnpm test:visual           # desktop + mobile visual
pnpm test:visual:update    # refresh baselines
pnpm test:visual:ui        # UI mode
```

## Add a screen (after Figma implement)

1. Route exists under `src/features/<feature>/screens/<screen>/…` (or matching `src/routes/…`)
2. Page object → `e2e/pages/screens/<feature>/<screen>.page.ts` (locators/actions only; no `expect`)
3. Optional fixture in `e2e/support/fixtures.ts`
4. Spec → `e2e/visual/<feature>/<screen>.visual.spec.ts` with `@visual`
5. Capture root (or full page) via `settleUi` + `expectLocatorScreenshot` / `expectPageScreenshot`
6. Baseline: `pnpm test:visual:update`

### Spec sketch

```ts
import { test } from "../../support/fixtures";
import { settleUi, expectPageScreenshot } from "../../support/visual";
import { ExampleScreenPage } from "../../pages/screens/example/example-screen.page";

test.describe("Example screen @visual", () => {
  test("desktop/mobile match baseline", async ({ page }) => {
    await test.step("Arrange", async () => {
      const screen = new ExampleScreenPage(page);
      await screen.goto();
      await settleUi(page);
    });

    await test.step("Assert", async () => {
      await expectPageScreenshot(page, "example-screen.png");
    });
  });
});
```

Delete `e2e/visual/_pending.visual.spec.ts` when the first real screen spec lands.

## Notes

- Projects: `chromium-visual` (1280×720) + `mobile-visual` (390×844 Chromium)
- `maxDiffPixelRatio: 0.02` for font/AA noise
- Optional later: Figma PNG under `e2e/fixtures/figma/` + diff helper
