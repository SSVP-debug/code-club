import Button from "../ui/Button";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

const TRUST_SIGNALS = "Free to use · No credit card · Google login in 10 sec";

function HeroSection({ user }) {
  return (
    <section className="relative min-h-[760px] overflow-hidden px-6 pb-24 pt-28 md:min-h-[860px] md:px-12 md:pb-32 md:pt-32 lg:min-h-[900px] lg:flex lg:items-center">
      <LandingVisual
        src={LANDING_IMAGES.hero}
        alt=""
        priority
        className="pointer-events-none absolute inset-0 h-full min-h-0 opacity-100 [&_.lp-visual-image]:scale-[1.04] md:[&_.lp-visual-image]:scale-[1.06]"
        position="top"
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,rgba(11,13,16,0.88)_24%,rgba(11,13,16,0.38)_52%,rgba(11,13,16,0.08)_76%,rgba(11,13,16,0.2)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,13,16,0.18)_0%,transparent_28%,transparent_72%,var(--background)_100%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="max-w-3xl">
          <div className="lp-reveal lp-in-view">
            <p className="mb-6 inline-flex items-center gap-2 font-mono-ui text-lp-eyebrow uppercase tracking-lp-eyebrow text-[var(--muted-foreground)]">
              <span className="h-1.5 w-1.5 rounded-full bg-verdict-pending" />
              Placement season 2026 — batches open now
            </p>

            <h1 className="max-w-3xl text-lp-h1 font-display font-bold tracking-tight text-[var(--foreground)]">
              Every solve, <span className="text-[var(--accent-text)]">verified.</span>
              <br />
              Every profile, provable.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-[var(--muted-foreground)] md:text-xl">
              Code Club checks every submission server-side, so your solve
              history means something to the people looking at it.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
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
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
