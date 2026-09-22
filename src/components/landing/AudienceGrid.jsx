import { Link } from "react-router-dom";
import { GraduationCap, Briefcase, Building2, ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import LandingVisual from "./LandingVisual";
import LANDING_IMAGES from "./landingImages";

const ACCENT_CLASSES = {
  "role-student": {
    text: "text-role-student",
    ring: "focus-visible:ring-role-student",
    badge: "bg-role-student/10",
    card: "border-role-student/30 bg-role-student/[0.06]",
  },
  "role-recruiter": {
    text: "text-role-recruiter",
    ring: "focus-visible:ring-role-recruiter",
    badge: "bg-role-recruiter/10",
    card: "border-role-recruiter/30 bg-role-recruiter/[0.06]",
  },
  "role-tpo": {
    text: "text-role-tpo",
    ring: "focus-visible:ring-role-tpo",
    badge: "bg-role-tpo/10",
    card: "border-role-tpo/30 bg-role-tpo/[0.06]",
  },
};

const ROLES = [
  {
    id: "student",
    index: "01",
    Icon: GraduationCap,
    title: "Students",
    body: "Practice across themed universes, build streaks, and run AI mock interviews before the real one.",
    cta: "Start solving",
    accent: "role-student",
  },
  {
    id: "recruiter",
    index: "02",
    Icon: Briefcase,
    title: "Recruiters",
    body: "Search candidates by real, server-verified solve history and send skills tests directly - no resume guesswork.",
    cta: "Recruiter access",
    accent: "role-recruiter",
    image: LANDING_IMAGES.recruiter,
    alt: "Recruiter interviewing a software candidate",
  },
  {
    id: "tpo",
    index: "03",
    Icon: Building2,
    title: "TPOs",
    body: "Track your batch's placement readiness -solve counts, streaks, topic coverage - in one dashboard instead of a spreadsheet.",
    cta: "TPO dashboard",
    accent: "role-tpo",
    image: LANDING_IMAGES.tpo,
    alt: "Placement officer speaking with college students",
  },
];

function AudienceGrid({ user }) {
  const destination = user ? "/dashboard" : "/portal";

  return (
    <Reveal as="section" className="bg-[var(--surface)] px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-4 font-mono-ui text-lp-label uppercase tracking-lp-label text-[var(--muted-foreground)]">
            Ecosystem
          </p>
          <h2 className="text-lp-h2-spine font-display font-bold tracking-tight text-[var(--foreground)]">
            One coding journey. A wider ecosystem around it.
          </h2>
          <p className="mt-4 max-w-xl text-[var(--muted-foreground)]">
            Students build proof, while colleges, TPOs, and recruiters can
            use that proof in the parts of the placement journey that matter.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <LandingVisual
            src={LANDING_IMAGES.ecosystem}
            alt="College students on campus"
            className="min-h-[300px] md:min-h-[380px] lg:min-h-[460px]"
          />

          <div className="flex flex-col gap-4">
            {ROLES.map((r) => {
              const a = ACCENT_CLASSES[r.accent];
              return (
                <div key={r.id} className="grid gap-5 rounded-2xl border border-[var(--border)] bg-[var(--background)]/45 p-5 md:grid-cols-[auto_1fr] md:items-start">
                  <span
                    className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${a.badge} ${a.text}`}
                    aria-hidden="true"
                  >
                    <r.Icon size={20} strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-ui text-xs text-[var(--muted-foreground)]">
                        {r.index}
                      </span>
                      <p className="font-display font-semibold text-[var(--foreground)]">
                        {r.title}
                      </p>
                    </div>
                    <p className="mt-1.5 text-[var(--muted-foreground)]">{r.body}</p>
                    <Link
                      to={destination}
                      className={`mt-3 inline-flex items-center gap-1.5 text-sm font-semibold ${a.text} transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 ${a.ring} focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] rounded-sm`}
                    >
                      {r.cta}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                  {r.image ? (
                    <LandingVisual
                      src={r.image}
                      alt={r.alt}
                      className="min-h-[180px] md:col-span-2 md:min-h-[220px]"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default AudienceGrid;
