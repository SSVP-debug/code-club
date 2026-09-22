import { Link } from "react-router-dom";
import { GraduationCap, Briefcase, Building2, ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

const ROLES = [
  {
    id: "student",
    index: "01",
    Icon: GraduationCap,
    title: "Students",
    body: "Practice across themed universes, build streaks, and run AI mock interviews before the real one.",
    cta: "Start solving",
    accent: "text-role-student",
  },
  {
    id: "recruiter",
    index: "02",
    Icon: Briefcase,
    title: "Recruiters",
    body: "Search candidates by real, server-verified solve history and send skills tests directly — no resume guesswork.",
    cta: "Recruiter access",
    accent: "text-role-recruiter",
    image: LANDING_IMAGES.recruiter,
    alt: "Recruiter interviewing a software candidate",
  },
  {
    id: "tpo",
    index: "03",
    Icon: Building2,
    title: "TPOs",
    body: "Track your batch's placement readiness — solve counts, streaks, topic coverage — in one dashboard instead of a spreadsheet.",
    cta: "TPO dashboard",
    accent: "text-role-tpo",
    image: LANDING_IMAGES.tpo,
    alt: "Placement officer speaking with college students",
  },
];

function AudienceGrid({ user }) {
  const destination = user ? "/dashboard" : "/portal";

  return (
    <Reveal as="section" className="relative overflow-hidden bg-[var(--surface)] px-6 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="mb-4 font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--muted-foreground)]">
              Ecosystem
            </p>
            <h2 className="text-lp-h2-spine font-display font-bold tracking-tight text-[var(--foreground)]">
              One coding journey.
              <br />
              A wider ecosystem around it.
            </h2>
          </div>
          <p className="max-w-xl text-[var(--muted-foreground)] lg:justify-self-end">
            Students build proof. Colleges, Training & Placement Officers,
            and recruiters can use that proof across the placement journey.
          </p>
        </div>

        <div className="relative mt-14 h-[300px] overflow-hidden md:h-[430px]">
          <LandingVisual
            src={LANDING_IMAGES.ecosystem}
            alt="College student working in a library"
            className="lp-visual-on-surface absolute inset-0 h-full min-h-0"
            position="center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--surface)] via-transparent to-[var(--surface)]/20" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--surface)] to-transparent" />
          <div className="absolute bottom-7 left-0 max-w-md">
            <p className="font-mono-ui text-xs uppercase tracking-lp-label text-[var(--muted-foreground)]">
              Build proof before placement day
            </p>
            <p className="mt-2 text-lg font-medium text-[var(--foreground)]">
              Your practice history becomes a visible signal of what you can actually do.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--border)]">
          {ROLES.map((r) => {
            const Icon = r.Icon;
            return (
              <div
                key={r.id}
                className="group relative overflow-hidden border-b border-[var(--border)] py-7 md:py-9"
              >
                {r.image ? (
                  <>
                    <LandingVisual
                      src={r.image}
                      alt=""
                      className="lp-visual-on-surface pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[44%] min-h-0 opacity-45 md:block"
                      position="center"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] bg-gradient-to-r from-[var(--surface)] via-[var(--surface)]/45 to-transparent md:block" />
                  </>
                ) : null}

                <div className="relative z-10 grid gap-5 md:grid-cols-[110px_1fr_auto] md:items-center">
                  <div className="flex items-center gap-3 font-mono-ui text-xs text-[var(--muted-foreground)]">
                    <span>{r.index}</span>
                    <Icon size={17} className={r.accent} aria-hidden="true" />
                  </div>
                  <div className="max-w-2xl">
                    <h3 className="text-xl font-display font-semibold text-[var(--foreground)]">
                      {r.title}
                    </h3>
                    <p className="mt-2 text-[var(--muted-foreground)]">
                      {r.body}
                    </p>
                  </div>
                  <Link
                    to={destination}
                    className={`relative inline-flex items-center gap-1.5 text-sm font-semibold ${r.accent} transition hover:translate-x-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]`}
                  >
                    {r.cta}
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

export default AudienceGrid;
