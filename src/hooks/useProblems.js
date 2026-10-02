import { useEffect, useState } from "react";
import { apiFetchOptional } from "../services/api";

/**
 * The frontend reads canonical problem data from the API. `backend/problems/<slug>/`
 * is the authoring source of truth; there is intentionally no local metadata
 * catalog to merge into the API response.
 */
function enrichProblems(problemList, acceptanceRates = {}) {
  return problemList.map((problem) => ({
    ...problem,
    acceptanceRate: acceptanceRates[problem.slug]?.rate ?? null,
  }));
}

async function loadFallbackProblems(acceptanceRates = {}) {
  const { default: fallbackProblems } = await import("../data/generated/problemFallback");
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

        const [data, acceptanceRates] = await Promise.all([
          apiFetchOptional("/api/problems"),
          apiFetchOptional("/api/problems/stats/acceptance").catch((err) => {
            console.warn("[useProblems] Acceptance rates fetch failed:", err.message);
            return {};
          }),
        ]);

        if (cancelled) return;

        if (!data || data.length === 0) {
          const fallbackProblems = await loadFallbackProblems(acceptanceRates);
          if (cancelled) return;
          setProblems(fallbackProblems);
        } else {
          setProblems(enrichProblems(data, acceptanceRates));
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[useProblems] API fetch failed:", err.message);
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
