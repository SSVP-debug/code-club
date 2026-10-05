import { ChevronLeft, ChevronRight } from "lucide-react";
import BrowseToolbar from "./BrowseToolbar";
import ProblemList from "./ProblemList";

function BrowseView({
  loading,
  error,
  filtered,
  topics,
  selectedTopic,
  setSelectedTopic,
  selectedDifficulty,
  setSelectedDifficulty,
  searchTerm,
  setSearchTerm,
  searchSuggestions,
  hideSolved,
  toggleHideSolved,
  pagination,
  onPreviousPage,
  onNextPage,
}) {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 30;
  const total = pagination?.total ?? filtered.length;
  const firstItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastItem = total === 0 ? 0 : Math.min(page * limit, total);

  return (
    <>
      <BrowseToolbar
        topics={topics}
        selectedTopic={selectedTopic}
        setSelectedTopic={setSelectedTopic}
        selectedDifficulty={selectedDifficulty}
        setSelectedDifficulty={setSelectedDifficulty}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchSuggestions={searchSuggestions}
        hideSolved={hideSolved}
        toggleHideSolved={toggleHideSolved}
      />

      {error && (
        <div className="mb-4 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {!loading && (
        <div className="flex items-center justify-between gap-3 mb-3 text-xs text-[var(--muted-foreground)]">
          <p>
            {total === 0 ? "No problems found" : `Showing ${firstItem}–${lastItem} of ${total}`}
          </p>
          {total > 0 && (
            <p className="whitespace-nowrap">
              Page {page} of {Math.max(1, Math.ceil(total / limit))}
            </p>
          )}
        </div>
      )}

      <ProblemList
        loading={loading}
        filtered={filtered}
        setSelectedDifficulty={setSelectedDifficulty}
        setSelectedTopic={setSelectedTopic}
        setSearchTerm={setSearchTerm}
      />

      {!loading && total > 0 && (
        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={!pagination?.hasPrevious}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-elevated)] disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <span className="text-xs text-[var(--muted-foreground)] hidden sm:block">
            {firstItem}–{lastItem} of {total}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!pagination?.hasNext}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-elevated)] disabled:opacity-40 disabled:pointer-events-none"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}

export default BrowseView;
