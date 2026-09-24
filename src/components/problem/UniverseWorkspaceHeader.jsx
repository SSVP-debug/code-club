import { Activity, FlaskConical, LockKeyhole, Rocket, Shield, Terminal, Triangle } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

const EMBLEMS = {
  heist: LockKeyhole,
  lab: FlaskConical,
  terminal: Terminal,
  arena: Triangle,
  startup: Rocket,
  neutral: Shield,
};

const STAGES = [
  { id: "understand", label: "Understand" },
  { id: "build", label: "Build" },
  { id: "validate", label: "Validate" },
];

function UniverseWorkspaceHeader({ stage = "build", isSolved = false }) {
  const { theme } = useTheme();
  const visual = theme.visual ?? {};
  const Icon = EMBLEMS[visual.emblem ?? visual.motif] ?? Shield;
  const isDefault = theme.id === "default";

  const activeStage = isSolved ? "validate" : stage;
  const activeIndex = STAGES.findIndex((item) => item.id === activeStage);

  return (
    <div
      className={`universe-workspace-header ${isDefault ? "universe-workspace-header--default" : ""}`}
      data-workspace-stage={activeStage}
      aria-label={isDefault ? undefined : `${visual.codename} coding workspace`}
    >
      <div className="universe-workspace-header__identity">
        <div className="universe-workspace-header__icon" aria-hidden="true">
          <Icon size={15} strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <div className="universe-workspace-header__eyebrow">
            {visual.eyebrow || "CODE CLUB WORKSPACE"}
          </div>
          <div className="universe-workspace-header__title">
            {isDefault ? "Coding Workspace" : visual.codename}
          </div>
        </div>
      </div>

      {!isDefault && (
        <>
          <div className="universe-workspace-header__signal" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <div className="universe-workspace-header__stages" aria-label="Problem workflow">
            {STAGES.map((item, index) => {
              const isActive = index === activeIndex;
              const isComplete = index < activeIndex;

              return (
                <div
                  key={item.id}
                  className={`universe-workspace-stage ${isActive ? "is-active" : ""} ${isComplete ? "is-complete" : ""}`}
                  data-stage={item.id}
                >
                  <span className="universe-workspace-stage__dot">
                    {isComplete ? "✓" : index + 1}
                  </span>
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>

          <div className="universe-workspace-header__status">
            <Activity size={11} aria-hidden="true" />
            {visual.status || "SYSTEM ONLINE"}
          </div>
        </>
      )}
    </div>
  );
}

export default UniverseWorkspaceHeader;
