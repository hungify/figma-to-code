import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Shared visual helpers — reuse from visual specs and future Figma-diff scripts.
 */
export type ScreenshotOptions = Parameters<Locator["screenshot"]>[0] & {
  /** Playwright expect.toHaveScreenshot name (stable across CI). */
  name?: string;
};

export async function expectPageScreenshot(
  page: Page,
  name: string,
  options?: Parameters<Page["screenshot"]>[0],
) {
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    ...options,
  });
}

export async function expectLocatorScreenshot(
  locator: Locator,
  name: string,
  options?: ScreenshotOptions,
) {
  await expect(locator).toHaveScreenshot(name, options);
}

/** Wait for fonts so screenshots / assertions are less flaky. */
export async function settleUi(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    }
  });
}
