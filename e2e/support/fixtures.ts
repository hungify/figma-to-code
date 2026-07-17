import { test as base, expect } from "@playwright/test";

/**
 * Fixture layer for Figma screen visuals.
 * Specs import `{ test, expect }` from here only.
 * Register a page object per implemented screen, e.g.:
 *
 *   bookingConfirmPage: async ({ page }, use) => {
 *     await use(new BookingConfirmPage(page));
 *   },
 */
type AppFixtures = Record<string, never>;

export const test = base.extend<AppFixtures>({});

export { expect };
