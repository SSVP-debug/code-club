/**
 * useProblems.js
 *
 * Fetches problems from the MongoDB backend via GET /api/problems.
 * Falls back to a generated, public-safe problem catalog if the API is
 * unreachable or the database has no seeded problems.
 *
 * The fallback is generated from backend/problems/<slug>/ and dynamically
 * imported only on the fallback path. It contains no hidden testcases and no
 * editorial content, so it cannot become a second hand-authored source of
 * truth or reintroduce the old hidden-test bundle leak.
 */

import { useEffect, useState } from "react";
import { apiFetchOptional } from "../services/api";
import problemMetadata from "../data/problemMetadata";

function enrichProblems(problemList, acceptanceRates = {}) {
  return problemList.map((problem) => ({
    ...problem,
    ...(problemMetadata[problem.slug] || {}),
    // Only attach when we actually have data — missing entry means "not
    // enough submissions yet", which ProblemCard treats differently from 0%.
    acceptanceRate: acceptanceRates[problem.slug]?.rate ?? null,
  }));
}

async function loadFallbackProblems(acceptanceRates = {}) {
  const { default: fallbackProblems } = await import(
    "../data/generated/problemFallback"
  );
  return enrichProblems(fallbackProblems, acceptanceRates);
}

export function useProblems() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchProblems() {
      try {
        setLoading(true);
        setError(null);

        // Acceptance rates are a nice-to-have display detail, not core data —
        // fetched in parallel but never allowed to block or fail the problem
        // list itself. If this fetch fails, cards just show no acceptance %.
        // Guest Mode: these two are genuinely public on the backend
        // (backend/routes/problemRoutes.js — no auth middleware at all),
        // so apiFetchOptional (not apiFetch, which throws for a guest
        // with no Firebase user) is used here — same request either way
        // for an authenticated caller, but guests reach the real API
        // instead of falling straight to the fallback below.
        const [data, acceptanceRates] = await Promise.all([
          apiFetchOptional("/api/problems"),
          apiFetchOptional("/api/problems/stats/acceptance").catch((err) => {
            console.warn("[useProblems] Acceptance rates fetch failed:", err.message);
            return {};
          }),
        ]);

        if (cancelled) return;

        if (!data || data.length === 0) {
          // DB seeded but empty — use generated fallback so the page stays
          // functional without coupling the frontend to the authoring files.
          console.info("[useProblems] API returned 0 problems. Using generated fallback.");
          const fallbackProblems = await loadFallbackProblems(acceptanceRates);
          if (cancelled) return;
          setProblems(fallbackProblems);
        } else {
          setProblems(enrichProblems(data, acceptanceRates));
        }
      } catch (err) {
        if (cancelled) return;

        console.error("[useProblems] API fetch failed:", err.message);
        // Non-breaking: show generated public-safe problems so discovery still
        // works when the backend is unavailable. Opening/submitting a problem
        // still requires the backend, as expected.
        const fallbackProblems = await loadFallbackProblems();
        if (cancelled) return;
        setProblems(fallbackProblems);
        setError("Could not load problems from server. Showing cached problem set.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProblems();
    return () => { cancelled = true; };
  }, []);

  return { problems, loading, error };
}
