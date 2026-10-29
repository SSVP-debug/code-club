let dashboardImportPromise;

/**
 * Shared dynamic import for React.lazy and intent-based prefetching.
 * Concurrent hover/focus/navigation triggers reuse the same promise.
 */
export function preloadDashboard() {
  if (!dashboardImportPromise) {
    dashboardImportPromise = import("../pages/Dashboard");
  }
  return dashboardImportPromise;
}
