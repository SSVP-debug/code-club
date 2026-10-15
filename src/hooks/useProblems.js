import { useEffect, useState } from "react";
import { apiFetchOptional } from "../services/api";

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

export function useProblems(options = {}) {
  const {
    enabled = true,
    paginated = false,
    page = 1,
    limit = 30,
    cursor = null,
    searchTerm = "",
    selectedDifficulty = "All",
    selectedTopic = "All",
    scope = "",
  } = options;

  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit,
    total: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [topics, setTopics] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;

    async function fetchProblems() {
      try {
        setLoading(true);
        setError(null);

        if (paginated) {
          const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
          });
          if (cursor !== null && cursor !== undefined) params.set("cursor", String(cursor));

          const search = searchTerm.trim();
          if (search) params.set("search", search);
          if (selectedDifficulty !== "All") params.set("difficulty", selectedDifficulty);
          if (selectedTopic !== "All") params.set("topic", selectedTopic);
          if (scope) params.set("scope", scope);

          const data = await apiFetchOptional(`/api/problems?${params.toString()}`);
          if (cancelled) return;

          if (!data || !Array.isArray(data.problems)) {
            throw new Error("Invalid paginated problem response");
          }

          // Acceptance rates are requested only for the visible page. This
          // keeps the old analytics UX while avoiding a collection-wide
          // submission aggregation or a 10K-entry client payload.
          let acceptanceRates = {};
          const slugs = data.problems.map((problem) => problem.slug).filter(Boolean);
          if (slugs.length) {
            try {
              acceptanceRates = await apiFetchOptional(
                `/api/problems/stats/acceptance?slugs=${encodeURIComponent(slugs.join(","))}`
              ) || {};
            } catch (err) {
              console.warn("[useProblems] Page acceptance rates fetch failed:", err.message);
            }
          }
          if (cancelled) return;

          setProblems(enrichProblems(data.problems, acceptanceRates));
          setPagination({
            page: data.page ?? page,
            limit: data.limit ?? limit,
            total: data.total ?? 0,
            hasNext: Boolean(data.hasNext),
            cursor: data.cursor ?? cursor,
            nextCursor: data.nextCursor ?? null,
            hasNext: Boolean(data.hasNext),
            hasPrevious: Boolean(data.hasPrevious),
          });
          setTopics(Array.isArray(data.topics) ? data.topics : []);
          return;
        }

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
          setPagination({
            page: 1,
            limit: fallbackProblems.length,
            total: fallbackProblems.length,
            hasNext: false,
            hasPrevious: false,
          });
          setTopics([...new Set(fallbackProblems.map((p) => p.topic).filter(Boolean))].sort());
        } else {
          const enriched = enrichProblems(data, acceptanceRates);
          setProblems(enriched);
          setPagination({
            page: 1,
            limit: enriched.length,
            total: enriched.length,
            hasNext: false,
            hasPrevious: false,
          });
          setTopics([...new Set(enriched.map((p) => p.topic).filter(Boolean))].sort());
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[useProblems] API fetch failed:", err.message);

        try {
          const fallbackProblems = await loadFallbackProblems();
          if (cancelled) return;

          if (paginated) {
            const term = searchTerm.trim().toLowerCase();
            const filtered = fallbackProblems.filter((problem) => {
              const matchesDifficulty =
                selectedDifficulty === "All" || problem.difficulty === selectedDifficulty;
              const matchesTopic =
                selectedTopic === "All" || problem.topic === selectedTopic;
              const matchesSearch =
                !term ||
                problem.title?.toLowerCase().includes(term) ||
                problem.slug?.toLowerCase().includes(term) ||
                problem.topic?.toLowerCase().includes(term) ||
                problem.pattern?.toLowerCase().includes(term) ||
                problem.companies?.some((company) => company.toLowerCase().includes(term));
              return matchesDifficulty && matchesTopic && matchesSearch;
            });
            const start = (page - 1) * limit;
            const pageProblems = filtered.slice(start, start + limit);
            setProblems(pageProblems);
            setPagination({
              page,
              limit,
              total: filtered.length,
              hasNext: start + limit < filtered.length,
              hasPrevious: page > 1,
            });
            setTopics([...new Set(fallbackProblems.map((p) => p.topic).filter(Boolean))].sort());
          } else {
            setProblems(fallbackProblems);
            setPagination({
              page: 1,
              limit: fallbackProblems.length,
              total: fallbackProblems.length,
              hasNext: false,
              hasPrevious: false,
            });
            setTopics([...new Set(fallbackProblems.map((p) => p.topic).filter(Boolean))].sort());
          }
          setError("Could not load problems from server. Showing cached problem set.");
        } catch (fallbackError) {
          console.error("[useProblems] Fallback load failed:", fallbackError.message);
          setError("Could not load problems.");
          setProblems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProblems();
    return () => { cancelled = true; };
  }, [enabled, paginated, page, limit, cursor, searchTerm, selectedDifficulty, selectedTopic, scope]);

  return { problems, loading, error, pagination, topics };
}
