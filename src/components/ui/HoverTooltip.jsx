import { cloneElement, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * HoverTooltip
 *
 * Wraps an icon-only control (collapsed sidebar button, etc.) and shows a
 * small dark label beside it on hover/focus — the "hover a symbol, see
 * its name" interaction from Claude's own sidebar.
 *
 * `side="top"` (added for ActivityHeatmapCard's per-day cells) centers the
 * tooltip above the anchor instead of beside it — a dense grid of small
 * cells has neighbors immediately left/right, so anchoring there risks
 * the tooltip overlapping the next cell; "top" doesn't have that problem.
 *
 * Two things this deliberately gets right, both learned the hard way:
 *
 * 1. No wrapper DOM node. `children` (the actual button/Link) gets the
 *    ref and event handlers attached directly via cloneElement, rather
 *    than being wrapped in an extra <span>. An earlier version used a
 *    `display: contents` wrapper span to avoid disturbing layout — but a
 *    `display: contents` element generates no box, so
 *    `getBoundingClientRect()` on it returns an all-zero rect. That sent
 *    every tooltip to the viewport's top-left corner instead of beside
 *    the icon. Anchoring the ref to the real element sidesteps the
 *    problem entirely instead of working around it.
 *
 * 2. Rendered through a portal into document.body rather than as a plain
 *    `position: absolute` child, so it always escapes parent scroll/
 *    overflow clipping — a container with `overflow-y-auto` (like the
 *    collapsed workspace nav) silently coerces the other axis to `auto`
 *    too per the CSS overflow spec, clipping anything that pokes out of
 *    it. Positioning via the anchor's live bounding rect sidesteps that
 *    too.
 *
 * Usage: <HoverTooltip label="Learning Paths"><button>…</button></HoverTooltip>
 * `children` must be a single element that forwards its ref to a real
 * DOM node (native elements and react-router's <Link> both do).
 */
function HoverTooltip({ label, side = "right", children }) {
  const anchorRef = useRef(null);
  const [coords, setCoords] = useState(null);

  function show() {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (side === "top") {
      setCoords({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    } else {
      setCoords(
        side === "right"
          ? { top: rect.top + rect.height / 2, left: rect.right + 8 }
          : { top: rect.top + rect.height / 2, left: rect.left - 8 }
      );
    }
  }

  function hide() {
    setCoords(null);
  }

  // eslint-disable-next-line react-hooks/refs -- anchorRef.current is only ever read inside show() (below), which is only invoked from real DOM event handlers (onMouseEnter/onFocus/etc.), never during render. The rule can't verify that across the cloneElement/closure boundary, but this is exactly the ref-forwarding-without-a-wrapper-span pattern documented in this file's header comment.
  const trigger = cloneElement(children, {
    ref: anchorRef,
    onMouseEnter: (e) => {
      children.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e) => {
      children.props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e) => {
      children.props.onFocus?.(e);
      show();
    },
    onBlur: (e) => {
      children.props.onBlur?.(e);
      hide();
    },
  });

  return (
    <>
      {trigger}
      {coords &&
        createPortal(
          <span
            role="tooltip"
            className={`pointer-events-none fixed z-[100] whitespace-nowrap rounded-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] shadow-xl ${
              side === "top"
                ? "-translate-x-1/2 -translate-y-full"
                : `-translate-y-1/2 ${side === "right" ? "" : "-translate-x-full"}`
            }`}
            style={{ top: coords.top, left: coords.left }}
          >
            {label}
          </span>,
          document.body
        )}
    </>
  );
}

export default HoverTooltip;