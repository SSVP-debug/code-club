import Button from "../ui/Button";
import Reveal from "./Reveal";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

function CtaSection({ user }) {
  return (
    <Reveal
      as="section"
      className="relative min-h-[500px] overflow-hidden px-6 py-24 md:min-h-[560px] md:px-12 md:py-28"
    >
      <LandingVisual
        src={LANDING_IMAGES.graduation}
        alt=""
        className="pointer-events-none absolute inset-0 h-full min-h-0 opacity-[0.95]"
        position="center"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(11,13,16,0.1)_0%,rgba(11,13,16,0.42)_42%,rgba(11,13,16,0.9)_78%,var(--background)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[420px] max-w-3xl items-center justify-center text-center">
        <div>
          <p className="mb-4 font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--muted-foreground)]">
            Get started
          </p>
          <h2 className="text-lp-h1 font-display font-bold tracking-tight text-[var(--foreground)]">
            Prove it. Don&apos;t just say it.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[var(--muted-foreground)]">
            Every problem here is graded the same way — hidden test cases,
            checked server-side, no exceptions. Start building a solve
            history that means something.
          </p>
          <div className="mt-8">
            <Button
              to={user ? "/dashboard" : "/portal"}
              variant="theme"
              size="xl"
              className="shadow-xl shadow-verdict-accept/10"
            >
              {user ? "Go to Dashboard →" : "Start Solving Free →"}
            </Button>
          </div>
          <p className="mt-4 font-mono-ui text-xs text-[var(--muted-foreground)]">
            Google sign-in · Ready in 10 seconds
          </p>
        </div>
      </div>
    </Reveal>
  );
}

export default CtaSection;
