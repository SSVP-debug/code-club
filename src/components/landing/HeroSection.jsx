import Button from "../ui/Button";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

const TRUST_SIGNALS = "Free to use · No credit card · Google login in 10 sec";

function HeroSection({ user }) {
  return (
    <section className="relative overflow-hidden px-6 pt-24 pb-20 md:px-12 md:pb-28 md:pt-32 lg:pt-36">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="lp-reveal lp-in-view max-w-2xl text-center lg:text-left">
          <p className="mb-6 inline-flex items-center justify-center gap-2 font-mono-ui text-lp-eyebrow uppercase tracking-lp-eyebrow text-[var(--muted-foreground)]">
            <span className="h-1.5 w-1.5 rounded-full bg-verdict-pending" />
            Placement season 2026 — batches open now
          </p>

          <h1 className="text-lp-h1 font-display font-bold tracking-tight text-[var(--foreground)]">
            Every solve, <span className="text-[var(--accent-text)]">verified.</span>
            <br />
            Every profile, provable.
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-[var(--muted-foreground)] lg:max-w-xl">
            Code Club checks every submission server-side, so your solve
            history means something to the people looking at it.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
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

          <p className="mt-5 font-mono-ui text-xs text-[var(--muted-foreground)]">
            {TRUST_SIGNALS}
          </p>
        </div>

        <LandingVisual
          src={LANDING_IMAGES.hero}
          alt="Student coding on a laptop"
          priority
          className="min-h-[300px] md:min-h-[400px] lg:min-h-[460px]"
          position="center"
        />
      </div>
    </section>
  );
}

export default HeroSection;
