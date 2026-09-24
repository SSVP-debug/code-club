import { ACHIEVEMENTS_LIST } from "../../../config/achievementMetadata";
import { ACHIEVEMENT_ICONS, DEFAULT_ACHIEVEMENT_ICON } from "../../../config/achievementIcons";
import { useTheme } from "../../../hooks/useTheme";
import { useAppContext } from "../../../hooks/useAppContext";
import SectionCard from "../../ui/layout/SectionCard";
import EmptyState from "../../ui/feedback/EmptyState";
import { Trophy, CheckCircle2, Lock } from "lucide-react";

function AchievementGallery({
  achievements: achievementsProp,
  showLocked = true,
  collapsible = false,
  defaultOpen = true,
  storageKey = null,
} = {}) {
  const { theme } = useTheme();

  const { achievements: contextAchievements } = useAppContext();

  // Public-profile callers pass their own fetched achievements list instead
  // of relying on the viewer's own context — see plans/003-public-profile-parity.md.
  const achievements = achievementsProp ?? contextAchievements;

  const unlocked = new Set(
    achievements.map((a) => a.key)
  );

  // showLocked=false (used on public profiles) hides dimmed "Locked" badges
  // — those read as gamification motivation on the private page, but as
  // clutter on a page a recruiter is evaluating.
  const displayList = showLocked
    ? ACHIEVEMENTS_LIST
    : ACHIEVEMENTS_LIST.filter((a) => unlocked.has(a.key));

  const AchievementIcon = theme.words.achievementIcon || Trophy;

  return (
    <SectionCard
      className="universe-achievement-gallery"
      title={theme.words.achievements}
      icon={<Trophy size={18} strokeWidth={2} />}
      accented
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      storageKey={storageKey}
    >



      <div className="universe-achievement-gallery__summary" aria-label={`${unlocked.size} of ${displayList.length} achievements unlocked`}>
        <span>{unlocked.size} / {displayList.length} unlocked</span>
        <span>{displayList.length ? Math.round((unlocked.size / displayList.length) * 100) : 0}% milestone progress</span>
      </div>

      {achievements.length === 0 ? (
        <EmptyState
          icon={<AchievementIcon size={28} strokeWidth={1.75} />}
          title={theme.words.noAchievements}
          description="Keep solving to unlock your first badge."
          compact
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {displayList.map((achievement) => {
            const isUnlocked =
              unlocked.has(achievement.key);

            const Icon = ACHIEVEMENT_ICONS[achievement.key] || DEFAULT_ACHIEVEMENT_ICON;

            return (
              <div
                key={achievement.key}
                data-universe-achievement={isUnlocked ? "unlocked" : "locked"}
                className={`universe-achievement-card rounded-xl p-4 ${isUnlocked
                  ? "bg-[var(--surface-elevated)]"
                  : "bg-[var(--surface)] opacity-50"
                  }`}
              >
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                  {achievement.title}
                </h3>

                <p className="text-[var(--muted-foreground)] text-sm mt-2">
                  {achievement.description}
                </p>

                {showLocked && (
                  <p className="mt-2 text-xs flex items-center gap-1.5">
                    {isUnlocked ? (
                      <>
                        <CheckCircle2 size={12} strokeWidth={2.5} className="text-green-400" aria-hidden="true" />
                        Unlocked
                      </>
                    ) : (
                      <>
                        <Lock size={12} strokeWidth={2.5} className="text-[var(--muted-foreground)]" aria-hidden="true" />
                        Locked
                      </>
                    )}
                  </p>
                )}
              </div>
            );
          })}

        </div>
      )}
    </SectionCard>
  );
}

export default AchievementGallery;