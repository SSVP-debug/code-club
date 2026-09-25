import { useBWMode } from "../../hooks/useBWMode";

/**
 * Landing-page Black & White Mode switch. It intentionally lives only in
 * LandingNav: the authenticated product uses the selected Universe as its
 * visual system. BWModeContext keeps the preference persisted so returning
 * visitors get the same landing-page appearance. As of Phase 1 of
 * the theme migration, that class no longer applies a grayscale filter —
 * it switches the platform between the dark (default) and light theme
 * defined by index.css's semantic tokens. The switch's own visuals below
 * are unchanged either way: they're a self-contained black/white track-
 * and-thumb metaphor, not a reflection of the surrounding page's theme.
 *
 * The switch itself gets its own little animation independent of the
 * page-wide filter fade: the track recolors, the thumb slides, and the
 * icon inside the thumb flips — three small, layered motions that read
 * as "this control just did something" the instant you tap it, rather
 * than waiting for the (slower) full-page grayscale transition to catch
 * your eye.
 */
function BWModeToggle({ showLabel = false }) {
  const { bwMode, toggleBWMode } = useBWMode();

  const switchEl = (
    <button
      type="button"
      role="switch"
      aria-checked={bwMode}
      aria-label="Toggle Black & White Mode"
      title={bwMode ? "Black & White Mode: On" : "Black & White Mode: Off"}
      onClick={toggleBWMode}
      className={`relative inline-flex items-center shrink-0 w-9 h-5 rounded-full transition-colors duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:ring-zinc-400 ${
        bwMode ? "bg-white" : "bg-zinc-700"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex items-center justify-center w-4 h-4 rounded-full shadow-sm transition-transform duration-300 ease-out ${
          bwMode ? "translate-x-4 bg-black" : "translate-x-0.5 bg-white"
        }`}
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 10 10"
          className="transition-transform duration-300 ease-out"
          style={{ transform: bwMode ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <circle
            cx="5"
            cy="5"
            r="4.1"
            fill="none"
            stroke={bwMode ? "white" : "black"}
            strokeWidth="0.9"
          />
          <path
            d="M5 0.9A4.1 4.1 0 0 1 5 9.1Z"
            fill={bwMode ? "white" : "black"}
          />
        </svg>
      </span>
    </button>
  );

  if (!showLabel) {
    return switchEl;
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--foreground)]">Black &amp; White Mode</span>
      {switchEl}
    </div>
  );
}

export default BWModeToggle;