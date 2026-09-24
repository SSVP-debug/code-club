import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getStorageData, setStorageData } from "../../../services/storageService";

function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
  accented = false,
  collapsible = false,
  defaultOpen = true,
  storageKey = null,
}) {
  const hasHeader = title || action;

  const [open, setOpen] = useState(() => {
    if (!collapsible) return true;
    return storageKey ? getStorageData(storageKey, defaultOpen) : defaultOpen;
  });

  function toggle() {
    const next = !open;
    setOpen(next);
    if (storageKey) setStorageData(storageKey, next);
  }

  return (
    <div
      className={`universe-card relative overflow-hidden bg-[var(--surface)] rounded-2xl p-4 sm:p-6 border ${
        accented ? "border-[var(--theme-border,#27272a)]" : "border-[var(--border)]"
      } ${className}`}
    >
      {/* Top accent stripe — only when this card opts into the theme */}
      {accented && (
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--theme-primary,#2dd4bf)] to-[var(--theme-accent,#0d9488)]"
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      {hasHeader && (
        <div
          className={`flex items-start justify-between gap-3 mb-4 ${
            collapsible ? "cursor-pointer select-none -m-1 p-1 rounded-lg hover:bg-[var(--foreground)]/[0.03] transition" : ""
          }`}
          onClick={collapsible ? toggle : undefined}
          role={collapsible ? "button" : undefined}
          tabIndex={collapsible ? 0 : undefined}
          aria-expanded={collapsible ? open : undefined}
          onKeyDown={
            collapsible
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                  }
                }
              : undefined
          }
        >
          {/* Title group */}
          <div className="min-w-0 flex items-start gap-2.5">
            {icon && (
              <span
                className="text-lg leading-tight flex-shrink-0"
                style={accented ? { color: "var(--theme-primary, #2dd4bf)" } : undefined}
                aria-hidden="true"
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="text-xl font-semibold text-[var(--foreground)] leading-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-[var(--muted-foreground)] text-sm mt-1">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right-aligned action slot + collapse chevron */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {action && (
              <div onClick={(e) => e.stopPropagation()}>{action}</div>
            )}
            {collapsible && (
              <ChevronDown
                size={18}
                strokeWidth={2}
                className={`text-[var(--muted-foreground)] transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {/* Grid-rows trick (0fr ↔ 1fr) gives a smooth height transition
          without measuring scrollHeight in JS. Body stays mounted while
          collapsed (not unmounted) so toggling is instant, no re-fetch. */}
      {collapsible ? (
        <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export default SectionCard;