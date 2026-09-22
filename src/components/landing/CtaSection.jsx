import Button from "../ui/Button";
import Reveal from "./Reveal";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

function CtaSection({ user }) {
  return (
    <Reveal
      as="section"
      className="relative isolate min-h-[440px] overflow-hidden px-6 py-20 md:min-h-[500px] md:px-12 md:py-24"
    >
      <LandingVisual
        src={LANDING_IMAGES.graduation}
        alt=""
        priority
        className="lp-final-cta-visual pointer-events-none absolute inset-0 h-full min-h-0"
        position="center"
      />

      <div className="relative z-10 mx-auto flex min-h-[360px] max-w-3xl items-center justify-center text-center">
        <div className="lp-final-cta-copy">
          <p className="mb-4 font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--accent-text)]">
            A brighter tomorrow
          </p>

          <h2 className="text-lp-h1 font-display font-bold tracking-tight">
            Start building before
            <br />
            placement season.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed">
            Your coding journey doesn&apos;t start when companies arrive.
            <br className="hidden md:block" />
            It starts with the problems you solve today.
          </p>

          <div className="mt-8">
            <Button
              to={user ? "/dashboard" : "/portal"}
              variant="theme"
              size="xl"
              className="shadow-xl shadow-verdict-accept/10"
            >
              {user ? "Go to Dashboard →" : "Start Coding Now →"}
            </Button>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default CtaSection;
