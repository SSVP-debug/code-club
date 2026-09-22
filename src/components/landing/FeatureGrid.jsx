import { useState } from "react";
import { Mic, Layers, Zap, Brain, Flame, BarChart3, Trophy, ArrowUpRight } from "lucide-react";
import Reveal from "./Reveal";
import { SITE_DOMAIN } from "../../config/site.js";

const FEATURES = [
  {
    Icon: Mic,
    title: "Live AI Mock Interviews",
    tag: "Live",
    description:
      "Practice with an AI interviewer that asks follow-ups, pushes on your approach, and gives real feedback not just a hint panel.",
    detail:
      "Practice the pressure of a real interview. The AI interviewer can challenge your approach with follow-up questions and give feedback on how you reason, not just whether your final answer is correct.",
  },
  {
    Icon: Layers,
    title: "Themed Universes",
    description:
      "Practice as a lab scientist cracking experiments or a hacker breaching digital vaults five story worlds built on the same DSA curriculum.",
    detail:
      "The same DSA fundamentals become more engaging through themed story worlds. Solve problems inside different contexts while keeping the underlying curriculum and difficulty structure consistent.",
  },
  {
    Icon: Zap,
    title: "Multi-language Judge",
    description:
      "Submit in Python, JavaScript, Java, or C++. Runs against hidden test cases on our Judge0 backend same as production interviews.",
    detail:
      "Write solutions in the language you actually want to practice. Submissions run against hidden test cases through the Judge0-backed execution pipeline, so your result reflects an actual judged submission.",
  },
  {
    Icon: Brain,
    title: "AI Coaching",
    description:
      "Topic-level insights powered by Claude. What to practice next, not just "try harder."",
    detail:
      "Use topic-level signals to understand what deserves attention next. Coaching is designed to turn your practice history into a more useful next-step recommendation.",
  },
  {
    Icon: Flame,
    title: "Streaks & XP",
    description:
      "Daily challenges, streak tracking, and unlockable themes built to keep you coming back, not just once a week before an interview.",
    detail:
      "Build consistency through daily challenges, streak tracking, XP, and unlockable themes. The goal is to make regular practice easier to maintain between interviews.",
  },
  {
    Icon: BarChart3,
    title: "Progress Analytics",
    description:
      "Topic-wise coverage heatmaps, difficulty breakdown, and solve velocity. Know exactly what's left.",
    detail:
      "See where your practice is concentrated and where gaps remain with topic coverage, difficulty breakdowns, and solve-velocity signals.",
  },
  {
    Icon: Trophy,
    title: "Public Profile",
    tag: "Beta",
    description: `Share your solve history at ${SITE_DOMAIN}/u/yourname consistency speaks louder than a resume line.`,
    detail:
      "Turn your verified practice history into a shareable coding identity. Your profile can give colleges and recruiters a clearer view of consistent problem-solving activity.",
  },
];

function InterviewSnippet() {
  return (
    <div className="mt-8 max-w-lg border-l-2 border-verdict-accept/60 pl-4 font-mono-ui text-xs">
      <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
        <span className="h-1.5 w-1.5 rounded-full bg-verdict-pending" />
        AI interviewer · follow-up
      </div>
      <p className="mt-2 leading-relaxed text-[var(--foreground)]/80">
        "Your solution is O(n²) — can you get to O(n) using a hash map?"
      </p>
    </div>
  );
}

function FeatureGrid() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = FEATURES[activeIndex];

  return (
    <Reveal as="section" className="bg-[var(--surface)] px-6 py-20 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="mb-4 font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--accent-text)]">
            What's included
          </p>
          <h2 className="text-lp-h2-detail font-display font-bold tracking-tight text-[var(--foreground)]">
            Everything you need.
            <br />
            Nothing you don't.
          </h2>
          <p className="mt-4 max-w-xl text-[var(--muted-foreground)]">
            Seven focused capabilities built around consistent, placement-ready
            practice.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-[0.78fr_1.22fr]">
          <div className="flex flex-col border-y border-[var(--border)]">
            {FEATURES.map((feature, index) => {
              const Icon = feature.Icon;
              const isActive = index === activeIndex;

              return (
                <button
                  key={feature.title}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => setActiveIndex(index)}
                  className={`group flex min-h-[76px] items-center gap-4 border-b border-[var(--border)] px-5 text-left transition-all duration-200 last:border-b-0 ${
                    isActive
                      ? "bg-[var(--background)] text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--background)]/60 hover:text-[var(--foreground)]"
                  }`}
                  aria-pressed={isActive}
                >
                  <span className={`font-mono-ui text-[10px] tracking-[0.16em] ${isActive ? "text-[var(--accent-text)]" : "text-[var(--muted-foreground)]"}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border transition-colors ${isActive ? "border-verdict-accept/30 bg-verdict-accept/10 text-[var(--accent-text)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}>
                    <Icon size={17} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    {feature.title}
                    {feature.tag ? (
                      <span className="ml-2 font-mono-ui text-[9px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                        {feature.tag}
                      </span>
                    ) : null}
                  </span>
                  <ArrowUpRight
                    size={15}
                    className={`transition-transform duration-200 ${isActive ? "translate-x-0.5 -translate-y-0.5 text-[var(--accent-text)]" : "opacity-0 group-hover:opacity-60"}`}
                  />
                </button>
              );
            })}
          </div>

          <div className="relative min-h-[532px] overflow-hidden border border-[var(--border-strong)] bg-[var(--background)]">
            <div
              key={active.title}
              className="flex h-full min-h-[532px] flex-col justify-between p-7 md:p-9"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-ui text-xs tracking-[0.16em] text-[var(--accent-text)]">
                    {String(activeIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="h-px w-10 bg-[var(--border-strong)]" />
                  <span className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    Feature
                  </span>
                </div>

                <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-verdict-accept/10 text-[var(--accent-text)]">
                  <active.Icon size={27} strokeWidth={1.8} />
                </div>

                <h3 className="mt-7 max-w-xl text-3xl font-display font-bold tracking-tight text-[var(--foreground)] md:text-4xl">
                  {active.title}
                  {active.tag ? (
                    <span className="ml-3 align-middle font-mono-ui text-xs font-normal uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      {active.tag}
                    </span>
                  ) : null}
                </h3>

                <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted-foreground)] md:text-lg">
                  {active.detail}
                </p>

                <div className="mt-6 max-w-2xl border-t border-[var(--border)] pt-5">
                  <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                    {active.description}
                  </p>
                </div>

                {activeIndex === 0 ? <InterviewSnippet /> : null}
              </div>

              <div className="mt-10 flex items-end justify-between border-t border-[var(--border)] pt-4">
                <span className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Code Club capability
                </span>
                <span className="font-mono-ui text-[10px] text-[var(--muted-foreground)]">
                  {String(activeIndex + 1).padStart(2, "0")} / 07
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default FeatureGrid;
