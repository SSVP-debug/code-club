import ContinueLearningCard from "./ContinueLearningCard";
import DailyMissionCard from "./DailyMissionCard";
import LearningProgressCard from "./LearningProgressCard";
import AICoachCard from "./AICoachCard";
import ContestCountdownCard from "../dashboard/sections/ContestCountdownCard";
import { useTheme } from "../../hooks/useTheme";
import { Activity, FlaskConical, LockKeyhole, Rocket, Shield, Terminal, Triangle } from "lucide-react";

function LearningWorkspace({
  problems = [],
  solvedCount = 0,
  progress = 0,
  topicStats = {},
  solvedDifficulty = { easy: 0, medium: 0, hard: 0 },
  attemptedCount = 0,
  submissions = [],
  currentStreak = 0,
  onPracticeTopic = () => {},
}) {
  const { theme } = useTheme();
  const visual = theme.visual ?? {};
  const emblemMap = { heist: LockKeyhole, lab: FlaskConical, terminal: Terminal, arena: Triangle, startup: Rocket, neutral: Shield };
  const Emblem = emblemMap[visual.emblem ?? visual.motif] ?? Shield;
  const isDefault = theme.id === "default";

  return (
    <div className="universe-learning p-4 flex flex-col gap-4" data-universe-learning={theme.id}>

      {/* Panel header */}
      <div className="universe-learning__header">
        <div className="universe-learning__identity">
          <div className="universe-learning__emblem" aria-hidden="true"><Emblem size={17} strokeWidth={1.8} /></div>
          <div>
            <span className="universe-learning__eyebrow">{isDefault ? "CODE CLUB LEARNING" : visual.eyebrow}</span>
            <h2 className="text-sm font-bold text-[var(--foreground)]">{isDefault ? "Where am I" : visual.heroTitle}</h2>
          </div>
        </div>
        <span className="universe-learning__status"><Activity size={10} /> {isDefault ? "LEARNING HUB" : visual.status}</span>
      </div>
      <p className="universe-learning__description text-[var(--muted-foreground)] text-xs">
        {isDefault ? "Your learning hub. Track, reflect and improve." : visual.heroDescription}
      </p>

      <div className="universe-learning__stage-label">MISSION CONTROL / LEARNING SIGNAL</div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-xl p-3 text-center">
          <p className="text-lg font-bold leading-none tabular-nums text-[var(--foreground)]">{solvedCount}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide mt-1">Solved</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-xl p-3 text-center">
          <p className="text-lg font-bold leading-none tabular-nums text-[var(--theme-primary,#2dd4bf)]">{progress}%</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide mt-1">Progress</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-xl p-3 text-center">
          <p className="text-lg font-bold leading-none tabular-nums text-[var(--foreground)]">{problems.length}</p>
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide mt-1">Vaults</p>
        </div>
      </div>

      {/* Cards */}
      <ContinueLearningCard />
      <DailyMissionCard submissions={submissions} currentStreak={currentStreak} />
      <AICoachCard
        problems={problems}
        topicStats={topicStats}
        onPracticeTopic={onPracticeTopic}
      />
      <LearningProgressCard
        solvedCount={solvedCount}
        total={problems.length}
        progress={progress}
        solvedDifficulty={solvedDifficulty}
        attemptedCount={attemptedCount}
      />
      {/* Reuses the same card built for Dashboard — not a duplicate
          implementation. See known-issue note in PROJECT_STATE.md re:
          this card's error-state bug; still open as of this phase. */}
      <ContestCountdownCard />

    </div>
  );
}

export default LearningWorkspace;