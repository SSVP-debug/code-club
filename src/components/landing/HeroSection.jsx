import Button from "../ui/Button";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

const TRUST_SIGNALS = "Free to use · No credit card · Google login in 10 sec";

function HeroSection({ user, stats }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--border)] px-6 pb-0 pt-16 md:px-12 md:pt-20">
      <LandingVisual
        src={LANDING_IMAGES.hero}
        alt=""
        priority
        className="lp-hero-visual pointer-events-none absolute inset-y-0 right-0 h-full w-full min-h-0 opacity-100 md:w-[78%]"
        position="center"
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,var(--background)_18%,rgba(11,13,16,0.96)_34%,rgba(11,13,16,0.68)_50%,rgba(11,13,16,0.14)_72%,rgba(11,13,16,0.18)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,var(--background)_0%,transparent_14%,transparent_72%,var(--background)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[430px] max-w-6xl items-center pb-10 md:min-h-[500px] md:pb-12">
        <div className="max-w-[570px]">
          <div className="lp-reveal lp-in-view">
            <p className="mb-5 inline-flex items-center gap-2 font-mono-ui text-lp-eyebrow uppercase tracking-lp-eyebrow text-[var(--muted-foreground)]">
              <span className="h-1.5 w-1.5 rounded-full bg-verdict-pending" />
              Placement season 2026 — batches open now
            </p>

            <h1 className="max-w-2xl text-lp-h1 font-display font-bold tracking-tight text-[var(--foreground)]">
              Every solve, <span className="text-[var(--accent-text)]">verified.</span>
              <br />
              Every profile, provable.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--muted-foreground)] md:text-lg">
              Code Club checks every submission server-side, so your solve
              history means something to the people looking at it.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                to={user ? "/dashboard" : "/portal"}
                variant="theme"
                size="lg"
                className="shadow-lg shadow-verdict-accept/10"
              >
                {user ? "Go to Dashboard →" : "Start for Free →"}
              </Button>
              <Button
                to={user ? "/problems" : "/login?role=student"}
                variant="secondary"
                size="lg"
              >
                Browse Problems
              </Button>
            </div>

            <p className="mt-4 font-mono-ui text-[11px] text-[var(--muted-foreground)]">
              {TRUST_SIGNALS}
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl border-t border-[var(--border)] bg-[linear-gradient(90deg,rgba(11,13,16,0.96),rgba(11,13,16,0.54),transparent)]">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, index) => (
            <div
              key={s.key ?? s.label}
              className={`px-4 py-4 md:px-5 md:py-5 ${index < stats.length - 1 ? "md:border-r md:border-[var(--border)]" : ""} ${index === 1 ? "border-r border-[var(--border)] md:border-r" : ""}`}
            >
              <p className="text-xl font-bold tracking-tight text-[var(--accent-text)] md:text-2xl">
                {s.value}
              </p>
              <p className="mt-1 font-mono-ui text-[9px] uppercase tracking-[0.16em] text-[var(--muted-foreground)] md:text-[10px]">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
