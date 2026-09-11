import { useEffect, useState } from "react";
import { useAppContext } from "../../../hooks/useAppContext";
import {
  getDailyChallenge,
} from "../../../utils/dailyChallenge";

import { useTheme } from "../../../hooks/useTheme";
import SectionCard from "../../ui/layout/SectionCard";
import Button from "../../ui/Button";
import { CheckCircle2 } from "lucide-react";

function DailyChallengeSection() {
  const { theme } = useTheme();
  const [challenge, setChallenge] = useState(null);

  const {
    dailyChallengeHistory,
  } = useAppContext();

  useEffect(() => {
    let cancelled = false;
    getDailyChallenge().then((dc) => {
      if (!cancelled) setChallenge(dc);
    });
    return () => { cancelled = true; };
  }, []);

  if (!challenge) {
    return (
      <SectionCard accented>
        <div className="text-[var(--muted-foreground)] text-sm">Loading today's challenge…</div>
      </SectionCard>
    );
  }

  const today = new Date()
    .toISOString()
    .split("T")[0];

  const completedToday =
    dailyChallengeHistory.some(
      (entry) =>
        entry.date === today &&
        entry.slug === challenge.slug
    );

  // Kept deliberately minimal — just enough to identify + start today's
  // problem. Difficulty and the full description used to render here too,
  // but the description in particular had no length cap, so on longer
  // problems this card grew taller than Continue Learning/Weekly Goal/Next
  // Contest and (via grid stretch) dragged all three of them up with it,
  // leaving dead space in the shorter ones. Full details are one click
  // away on the problem page itself.
  return (
    <SectionCard accented>

      <p className="text-[var(--muted-foreground)] text-sm mb-2">
        {theme.words.dailyChallenge}
      </p>

      <h2
        className="text-xl sm:text-3xl font-bold break-words line-clamp-2 mb-6"
        title={challenge.title}
      >
        {challenge.title}
      </h2>

      {completedToday ? (
        <div className="inline-flex items-center gap-2 bg-[var(--theme-primary,#2dd4bf)] text-black px-6 py-3 rounded-xl font-semibold">
          <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden="true" />
          Completed Today
        </div>
      ) : (
        <Button to={`/problems/${challenge.slug}`} variant="theme">
          {theme.words.solveChallenge}
        </Button>
      )}

    </SectionCard>
  );
}

export default DailyChallengeSection;