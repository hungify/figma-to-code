/** Shared viewports for Figma screen visual projects. */
export const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 390, height: 844 },
} as const;

/**
 * Routes for Figma-implemented screens only.
 * Add an entry when `figma-implement-design` lands a screen.
 *
 * @example
 * ROUTES.bookingConfirm = "/booking/confirm"
 */
export const ROUTES = {} as const;
