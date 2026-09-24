import { Link, useNavigate } from "react-router-dom";
import PageMeta from "../components/seo/PageMeta";
import { SITE_DOMAIN } from "../config/site.js";
import { useGuest } from "../hooks/useGuest";
import { GraduationCap, Briefcase, Building2 } from "lucide-react";
import LANDING_IMAGES from "../components/landing/landingImages";

// ── Role cards ───────────────────────────────────────────────────────────
// The portal deliberately reuses the same approved audience photography
// as the landing page. This keeps the journey visually continuous:
// landing persona → access persona → authenticated experience.
// `accessId` remains the real destination used by Guest Mode; the image
// fields are presentation-only.
const ROLES = [
  {
    id: "student",
    label: "Student",
    accent: "teal",
    Icon: GraduationCap,
    image: LANDING_IMAGES.ecosystem,
    imageAlt: "Students collaborating on a college campus",
    tagline: "Solve, climb, get interview-ready.",
    description:
      "Practice DSA across themed universes, track XP and streaks, and run live AI mock interviews before the real one.",
    accessId: "/dashboard",
  },
  {
    id: "recruiter",
    label: "Recruiter",
    accent: "sky",
    Icon: Briefcase,
    image: LANDING_IMAGES.recruiter,
    imageAlt: "Recruiter interviewing a candidate",
    tagline: "Find signal, not just resumes.",
    description:
      "Search verified candidates by real solve history, send skills tests, and check profile signatures before you reach out.",
    accessId: "/recruiter/dashboard",
  },
  {
    id: "tpo",
    label: "TPO",
    accent: "violet",
    Icon: Building2,
    image: LANDING_IMAGES.tpo,
    imageAlt: "Training and placement discussion",
    tagline: "See placement readiness at a glance.",
    description:
      "Track every student on your campus domain — solve velocity, streaks, and who's actually interview-ready this season.",
    accessId: "/tpo/dashboard",
  },
];

// Role accent classes reuse the same --color-role-student/recruiter/tpo
// tokens the landing page's Opportunities section uses (index.css),
// rather than hardcoded Tailwind teal/sky/violet — same accent, one
// source of truth, and it means these cards automatically pick up the
// Black/White Mode-appropriate shade instead of needing their own fix.
const ACCENT_CLASSES = {
  teal: {
    border: "hover:border-role-student/50 focus-visible:ring-role-student/60",
    badge: "text-role-student bg-role-student/10 border-role-student/20",
    shadow: "hover:shadow-[0_0_40px_-15px_rgba(45,212,191,0.35)]",
    button: "bg-role-student group-hover:brightness-110",
  },
  sky: {
    border: "hover:border-role-recruiter/50 focus-visible:ring-role-recruiter/60",
    badge: "text-role-recruiter bg-role-recruiter/10 border-role-recruiter/20",
    shadow: "hover:shadow-[0_0_40px_-15px_rgba(14,165,233,0.35)]",
    button: "bg-role-recruiter group-hover:brightness-110",
  },
  violet: {
    border: "hover:border-role-tpo/50 focus-visible:ring-role-tpo/60",
    badge: "text-role-tpo bg-role-tpo/10 border-role-tpo/20",
    shadow: "hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.35)]",
    button: "bg-role-tpo group-hover:brightness-110",
  },
};

export default function PortalPage() {
  const navigate = useNavigate();
  const { enterGuestMode } = useGuest();

  // Guest Mode: enters a portal-scoped guest session (see
  // context/GuestProvider.jsx) and navigates straight to that portal's
  // dashboard — same destination a real login for that role lands on
  // (role.accessId, already used for the badge above each card), just
  // without the /login step.
  function handleGuestEnter(roleId, accessId) {
    enterGuestMode(roleId);
    navigate(accessId);
  }

  return (
    <>
      <PageMeta
        title="Choose your access Code Club"
        description="Enter Code Club as a Student, Recruiter, or TPO."
        path="/portal"
      />
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-display flex flex-col">
        <header className="px-6 py-6 max-w-6xl mx-auto w-full flex items-center justify-between">
          <Link to="/" className="text-lg font-black tracking-tight">
            Code<span className="text-verdict-accept">Club</span>
          </Link>
          <span className="hidden sm:inline text-xs text-[var(--muted-foreground)] font-mono-ui">
            {SITE_DOMAIN}/portal
          </span>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="text-center mb-14 max-w-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted-foreground)] font-semibold mb-3">
              Choose your access
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
              Who's logging in?
            </h1>
            <p className="text-[var(--muted-foreground)] text-sm">
              Your dashboard, tools, and data are different depending on who
              you are. Pick the right one to continue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-6xl">
            {ROLES.map((role) => {
              const accent = ACCENT_CLASSES[role.accent];
              return (
                <article
                  key={role.id}
                  className={`group relative overflow-hidden bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl transition-all duration-300 hover:-translate-y-1 ${accent.border} ${accent.shadow}`}
                >
                  <div className="relative h-52 sm:h-56 overflow-hidden">
                    <img
                      src={role.image}
                      alt={role.imageAlt}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-[var(--surface)]/15 to-transparent"
                      aria-hidden="true"
                    />
                    <div
                      className={`absolute left-5 bottom-4 w-12 h-12 rounded-xl flex items-center justify-center border backdrop-blur-sm ${accent.badge}`}
                      aria-hidden="true"
                    >
                      <role.Icon size={22} strokeWidth={2} />
                    </div>
                  </div>

                  <div className="relative px-5 pb-5 pt-1">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h2 className="text-2xl font-bold tracking-tight">{role.label}</h2>
                      <span
                        className={`shrink-0 text-[10px] font-mono-ui px-2 py-1 rounded-md border ${accent.badge}`}
                      >
                        {role.id}
                      </span>
                    </div>

                    <p className="text-sm text-[var(--muted-foreground)] italic mb-3">
                      {role.tagline}
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed min-h-[72px]">
                      {role.description}
                    </p>

                    <div className="mt-5 flex flex-col gap-2">
                      <Link
                        to={`/login?role=${role.id}`}
                        className={`inline-flex items-center justify-center gap-2 font-semibold text-sm text-white rounded-xl px-4 py-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${accent.border} ${accent.button}`}
                      >
                        Enter as {role.label} →
                      </Link>
                      {/* Guest Mode: same behavior as before; only the
                          presentation of the role card has changed. */}
                      <button
                        type="button"
                        onClick={() => handleGuestEnter(role.id, role.accessId)}
                        className="inline-flex items-center justify-center gap-2 font-medium text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-xl px-4 py-2 border border-[var(--border-strong)] hover:border-[var(--muted-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] focus-visible:ring-[var(--muted-foreground)]"
                      >
                        Continue as Guest
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-10 text-xs text-[var(--muted-foreground)] text-center max-w-md">
            Already have an account? Signing in always takes you to the
            dashboard you already have — no matter which card you tap.
          </p>
        </main>
      </div>
    </>
  );
}