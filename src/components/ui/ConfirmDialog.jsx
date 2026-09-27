import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Button from "./Button";

/**
 * ConfirmDialog — generic yes/no confirmation modal.
 *
 * Checked src/components/ui/ before building this (plan 003's instruction):
 * every existing modal in the app (CollegeVerifyModal, LevelUpModal,
 * CreatePlaylistModal, etc.) is bespoke and feature-specific — there was no
 * shared confirm/dialog primitive to reuse. This is deliberately small and
 * generic so the next feature needing a "are you sure?" prompt (not just
 * plan 003's delete/reset-progress actions) can reuse it instead of rolling
 * its own overlay markup again.
 *
 * Overlay/backdrop convention matches CollegeVerifyModal.jsx
 * (`fixed inset-0 bg-black/70 ... onClick={onClose}`) for visual
 * consistency with the rest of the app's modals.
 *
 * Admin UX audit (Phase UI-3, P2): this component now gates several
 * higher-stakes flows than it originally did (suspend, role change,
 * impersonation, reject — not just delete/reset-progress), so it's worth
 * bringing up to the same bar as SideDrawer.jsx, the app's other shared
 * dialog primitive:
 *   - A fast (120-150ms), reduced-motion-aware fade/scale-in instead of
 *     popping into existence — matches SideDrawer's "fast > cinematic"
 *     philosophy, not a bigger animation.
 *   - Focus moves onto Cancel when the dialog opens (not Confirm — for a
 *     destructive action, an accidental stray Enter keypress should never
 *     land on "Delete"), is trapped inside the dialog while open, and
 *     returns to whatever triggered it once it closes, per the WAI-ARIA
 *     dialog pattern SideDrawer already established. Focus is found via
 *     the same FOCUSABLE_SELECTOR query the tab-trap already uses rather
 *     than a ref on Button, since Button isn't a forwardRef component and
 *     this deliberately avoids touching that shared, widely-used file for
 *     what's a single-consumer-type need right now.
 *   - Escape cancels, unless a request is already in flight (`loading`),
 *     matching the pattern that the Cancel button already disables during
 *     loading.
 * This is a shared `ui/` primitive, not an admin-only one — its only
 * current consumers happen to be admin flows, but any portal adopting it
 * later gets these behaviors for free. Flagged in the phase report for
 * UI-4 as a shared-infrastructure change, even though it's additive and
 * doesn't alter any existing call site's props.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}) {
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Read via a ref inside the keydown handler rather than depending on
  // `loading`/`onCancel` directly — both change identity across renders
  // (onCancel is typically a fresh inline arrow function per call site),
  // and re-running the effect below on every render would re-run its
  // mount-time focus/cleanup logic too. This keeps the listener attached
  // exactly once while still reading current values, not stale ones.
  const latestRef = useRef({ loading, onCancel });
  useEffect(() => {
    latestRef.current = { loading, onCancel };
  });

  useEffect(() => {
    triggerRef.current = document.activeElement;
    requestAnimationFrame(() => {
      panelRef.current?.querySelector(FOCUSABLE_SELECTOR)?.focus();
    });

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        if (!latestRef.current.loading) latestRef.current.onCancel();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.12 }}
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
        onClick={loading ? undefined : onCancel}
        role="presentation"
      >
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.97 }}
          transition={{ duration: reducedMotion ? 0 : 0.15, ease: "easeOut" }}
          className="w-full max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <h2 id="confirm-dialog-title" className="text-[var(--foreground)] font-bold text-base mb-1.5">
            {title}
          </h2>
          {description && <p className="text-[var(--muted-foreground)] text-sm mb-5">{description}</p>}
          {children}
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              size="sm"
              variant={destructive ? "danger" : "primary"}
              onClick={onConfirm}
              loading={loading}
              disabled={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}