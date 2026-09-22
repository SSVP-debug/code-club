import { Link } from "react-router-dom";
import { GraduationCap, Briefcase, Building2, ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

const ROLES = [
  {
    id: "student",
    Icon: GraduationCap,
    title: "Students",
    body: "Practice, track, and build a coding identity that shows what you can actually do.",
    cta: "Start solving",
    accent: "text-role-student",
    image: LANDING_IMAGES.ecosystem,
    imageAlt: "Students on a college campus",
  },
  {
    id: "tpo",
    Icon: Building2,
    title: "TPOs",
    subtitle: "Training & Placement Officers",
    body: "Discover and engage with verified talent from your college before placement season gets busy.",
    cta: "TPO dashboard",
    accent: "text-role-tpo",
    image: LANDING_IMAGES.tpo,
    imageAlt: "Training and placement discussion",
  },
  {
    id: "recruiter",
    Icon: Briefcase,
    title: "Recruiters",
    body: "Find consistent problem solvers through verified coding activity, not resume claims alone.",
    cta: "Recruiter access",
    accent: "text-role-recruiter",
    image: LANDING_IMAGES.recruiter,
    imageAlt: "Recruiter interviewing a candidate",
  },
];

function AudienceGrid({ user }) {
  const destination = user ? "/dashboard" : "/portal";

  return (
    <Reveal
      as="section"
      className="relative overflow-hidden bg-[var(--surface)] px-6 py-20 md:px-12 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--accent-text)]">
            Built for the placement ecosystem
          </p>
          <h2 className="text-lp-h2-spine font-display font-bold tracking-tight text-[var(--foreground)]">
            One platform.
            <br />
            Three sides of the placement journey.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-[var(--muted-foreground)]">
            Students build proof. TPOs discover talent. Recruiters find
            problem solvers through work they can actually verify.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {ROLES.map((r) => {
            const Icon = r.Icon;

            return (
              <article
                key={r.id}
                className="group relative overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--background)] transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="relative h-56 overflow-hidden md:h-64">
                  <LandingVisual
                    src={r.image}
                    alt={r.imageAlt}
                    className="h-full min-h-0 w-full"
                    position="center"
                  />
                </div>

                <div className="relative px-6 pb-7 pt-1">
                  <div className="mb-4 -mt-7 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm">
                    <Icon size={21} aria-hidden="true" />
                  </div>

                  <h3 className="text-2xl font-display font-semibold tracking-tight text-[var(--foreground)]">
                    {r.title}
                  </h3>

                  {r.subtitle ? (
                    <p className="mt-1 font-mono-ui text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                      {r.subtitle}
                    </p>
                  ) : null}

                  <p className="mt-3 min-h-[58px] max-w-sm leading-relaxed text-[var(--muted-foreground)]">
                    {r.body}
                  </p>

                  <Link
                    to={destination}
                    className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${r.accent} transition-transform duration-200 group-hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]`}
                  >
                    {r.cta}
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

export default AudienceGrid;
