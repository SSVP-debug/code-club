/**
 * Theme artwork contract.
 *
 * These paths intentionally point to frontend assets. The generated artwork
 * should be split into five individual WebP/JPG files with these names and
 * placed under src/assets/themes/.
 *
 * The artwork is used ONLY as a background layer. Theme copy, icons, and
 * controls remain rendered in the foreground with a readability overlay.
 */
export const THEME_BACKGROUNDS = {
  codeHeist: "/src/assets/themes/code-heist.webp",
  breakingBug: "/src/assets/themes/breaking-bug.webp",
  ghostProtocol: "/src/assets/themes/ghost-protocol.webp",
  survivalCode: "/src/assets/themes/survival-code.webp",
  debugDynasty: "/src/assets/themes/debug-dynasty.webp",
};
