import Button from "../ui/Button";
import Reveal from "./Reveal";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

function CtaSection({ user }) {
  return (
    <Reveal
      as="section"
      className="relative overflow-hidden border-t border-[var(--border-strong)] bg-[var(--surface)] px-6 py-24 md:px-12 md:py-32"
    >
      <LandingVisual
        src={LANDING_IMAGES.graduation}
        alt=""
        className="pointer-events-none absolute inset-0 h-full min-h-0 opacity-[0.72]"
      />

      <div className="relative z-10 mx-auto max-w-2xl rounded-3xl border border-verdict-accept/20 bg-[var(--surface)]/55 px-6 py-12 text-center backdrop-blur-[1px] md:px-14 md:py-16">
        <p className="mb-5 font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--muted-foreground)]">
          Get started
        </p>
        <h2 className="text-lp-h1 font-display font-bold tracking-tight text-[var(--foreground)]">
          Prove it. Don&apos;t just say it.
        </h2>
        <p className="mt-5 text-[var(--muted-foreground)]">
          Every problem here is graded the same way - hidden test cases,
          checked server-side, no exceptions. Start building a solve
          history that means something.
        </p>

        <div className="mt-9">
          <Button
            to={user ? "/dashboard" : "/portal"}
            variant="theme"
            size="xl"
            className="shadow-xl shadow-verdict-accept/10"
          >
            {user ? "Go to Dashboard →" : "Start Solving Free →"}
          </Button>
        </div>

        <p className="mt-5 font-mono-ui text-xs text-[var(--muted-foreground)]">
          Google sign-in · Ready in 10 seconds
        </p>
      </div>
    </Reveal>
  );
}

export default CtaSection;
