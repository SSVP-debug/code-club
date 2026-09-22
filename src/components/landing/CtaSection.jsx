import Button from "../ui/Button";
import Reveal from "./Reveal";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

function CtaSection({ user }) {
  return (
    <Reveal
      as="section"
      className="relative min-h-[620px] overflow-hidden px-6 py-28 md:min-h-[700px] md:px-12 md:py-36"
    >
      <LandingVisual
        src={LANDING_IMAGES.graduation}
        alt=""
        className="pointer-events-none absolute inset-0 h-full min-h-0 opacity-[0.9]"
        position="center"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(11,13,16,0.35)_35%,rgba(11,13,16,0.9)_82%,var(--background)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[var(--background)] to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-[460px] max-w-3xl items-center justify-center text-center">
        <div>
          <p className="mb-5 font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--muted-foreground)]">
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
      </div>
    </Reveal>
  );
}

export default CtaSection;
