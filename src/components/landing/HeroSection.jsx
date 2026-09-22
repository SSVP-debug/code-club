import Button from "../ui/Button";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

const TRUST_SIGNALS = "Free to use · No credit card · Google login in 10 sec";

function HeroSection({ user, stats }) {
  return (
    <section className="relative isolate min-h-[620px] overflow-hidden px-6 pb-0 pt-28 md:min-h-[700px] md:px-12 md:pt-32 lg:min-h-[760px]">
      <LandingVisual
        src={LANDING_IMAGES.hero}
        alt=""
        priority
        className="lp-hero-visual pointer-events-none absolute inset-0 h-full min-h-0 w-full"
        position="center"
      />

      <div className="lp-hero-overlay-x pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,rgba(11,13,16,0.97)_18%,rgba(11,13,16,0.84)_34%,rgba(11,13,16,0.38)_55%,rgba(11,13,16,0.04)_78%,rgba(11,13,16,0.12)_100%)]" />
      <div className="lp-hero-overlay-y pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,13,16,0.18)_0%,transparent_22%,transparent_78%,var(--background)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[500px] max-w-6xl items-center pb-12 md:min-h-[570px] md:pb-14">
        <div className="max-w-[570px]">
          <div className="lp-reveal lp-in-view">
            <p className="mb-5 inline-flex items-center gap-2 font-mono-ui text-lp-eyebrow uppercase tracking-lp-eyebrow text-[var(--accent-text)]">
              <span className="h-1.5 w-1.5 rounded-full bg-verdict-accept" />
              Practice · Grow · Get Noticed
            </p>

            <h1 className="max-w-2xl text-lp-h1 font-display font-bold tracking-tight text-[var(--foreground)]">
              Turn your coding
              <br />
              practice into
              <br />
              your future.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--muted-foreground)] md:text-lg">
              Solve problems. Track progress. Build your coding identity.
              <br className="hidden md:block" />
              Connect with your college, TPOs and recruiters.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                to={user ? "/dashboard" : "/portal"}
                variant="theme"
                size="lg"
                className="shadow-lg shadow-verdict-accept/10"
              >
                {user ? "Go to Dashboard →" : "Start Coding →"}
              </Button>
              <Button
                to={user ? "/problems" : "/login?role=student"}
                variant="secondary"
                size="lg"
              >
                Browse Problems
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="lp-hero-proof relative z-10 mx-auto max-w-6xl border-t border-white/10 bg-[linear-gradient(90deg,rgba(11,13,16,0.92),rgba(11,13,16,0.45),transparent)]">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, index) => (
            <div
              key={s.key ?? s.label}
              className={`px-4 py-4 md:px-5 md:py-5 ${index < stats.length - 1 ? "md:border-r md:border-white/10" : ""} ${index === 1 ? "border-r border-white/10 md:border-r" : ""}`}
            >
              <p className="text-xl font-bold tracking-tight text-[var(--foreground)] md:text-2xl">
                {s.value}
              </p>
              <p className="mt-1 font-mono-ui text-[9px] uppercase tracking-[0.16em] text-white/55 md:text-[10px]">
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
