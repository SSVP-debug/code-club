import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import SectionCard from "../ui/layout/SectionCard";
import { rankTopicsByCompletion } from "../../utils/rankTopics";

const SHOW_COUNT = 2;
function AICoachCard({ problems, topicStats, onPracticeTopic }) {
  const weakTopics = useMemo(() => {
    const ranked = rankTopicsByCompletion(problems, topicStats);
    return ranked.filter((row) => row.solved > 0 && row.pct < 100).slice(0, SHOW_COUNT);
  }, [problems, topicStats]);

  if (weakTopics.length === 0) return null;

  return (
    <SectionCard
      className="universe-ai-coach"
      title="AI Coach"
      icon={<Sparkles size={16} className="text-[var(--theme-primary,#2dd4bf)]" />}
    >
      <div className="universe-ai-coach__signal">ADAPTIVE SIGNAL</div>
      <p className="text-[var(--muted-foreground)] text-xs mb-3">You could use more reps in:</p>

      <div className="flex flex-col gap-2">
        {weakTopics.map((row) => (
          <button
            key={row.topic}
            onClick={() => onPracticeTopic(row.topic)}
            data-universe-coach-action="practice"
            className="universe-ai-coach__topic flex items-center justify-between gap-3 w-full text-left rounded-xl border border-[var(--border)] px-3 py-2.5 hover:border-[var(--theme-primary,#2dd4bf)]/40 hover:bg-[var(--theme-primary,#2dd4bf)]/5 transition"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">{row.topic}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {row.solved}/{row.total} solved
              </p>
            </div>
            <span className="text-xs font-semibold text-[var(--theme-primary,#2dd4bf)] whitespace-nowrap flex-shrink-0">
              Practice →
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

export default AICoachCard;