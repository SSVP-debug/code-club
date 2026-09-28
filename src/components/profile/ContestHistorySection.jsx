import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../services/api";
import { useTheme } from "../../hooks/useTheme";
import SectionCard from "../ui/layout/SectionCard";
import EmptyState from "../ui/feedback/EmptyState";
import { Swords, Trophy } from "lucide-react";

/**
 * ContestHistorySection — Profile's contest history (Phase 12D), powered
 * by GET /api/contests/mine, which didn't exist before this phase — there
 * was no "contests I've participated in" query anywhere in the backend.
 */
export default function ContestHistorySection({ collapsible = true }) {
  const { theme } = useTheme();
  const [contests, setContests] = useState(undefined); // undefined = loading

  useEffect(() => {
    apiFetch("/api/contests/mine")
      .then((d) => setContests(d.contests || []))
      .catch(() => setContests([]));
  }, []);

  return (
    <SectionCard
      title="Contest History"
      subtitle="Every contest you've taken part in"
      icon={<Swords size={18} strokeWidth={2} />}
      accented
      collapsible={collapsible}
      defaultOpen={false}
      storageKey="profile-collapse-contest-history"
    >
      {contests === undefined ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 bg-[var(--surface-elevated)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : contests.length === 0 ? (
        <EmptyState
          icon={<Swords size={28} strokeWidth={1.75} />}
          title="No contests yet"
          description="Join a public or private contest to see your results here."
          compact
        />
      ) : (
        <div className="space-y-2">
          {contests.map((c) => (
            <Link
              key={c._id}
              to={`/club/public-contests/${c._id}`}
              className="flex items-center justify-between gap-3 bg-[var(--surface-elevated)] hover:bg-[var(--surface-elevated)]/70 rounded-xl px-4 py-3 transition"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {c.myRank === 1 && <Trophy size={13} className="text-yellow-400 flex-shrink-0" aria-hidden="true" />}
                  {c.title}
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {c.status === "ended" ? "Ended" : c.status === "active" ? "Live now" : "Upcoming"}
                  {" · "}{c.mySolvedCount}/{c.problemCount} solved
                  {" · "}{c.participantCount} participants
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold" style={{ color: theme.colors.primary }}>{c.myScore}</p>
                {c.myRank && <p className="text-xs text-[var(--muted-foreground)]">#{c.myRank}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  );
}