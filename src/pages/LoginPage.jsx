import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { signInWithGoogle } from "../services/auth";
import { apiFetch } from "../services/api";
import { getPostLoginDestination, VALID_PORTAL_ROLES } from "../utils/roleRedirect";
import { getSafeNextPath } from "../utils/authRedirect";
import { AUTH_GATE_MESSAGES } from "../utils/authGateMessages";
import { GraduationCap, Briefcase, Building2, ShieldCheck } from "lucide-react";
import LANDING_IMAGES from "../components/landing/landingImages";

// JARVIS pass, spec §1: "LOGIN → AUTHENTICATING → ... should feel like one
// continuous experience... the user should never wait just to watch an
// animation." STATUS_COPY below is display-only and strictly follows real
// promise state — nothing here introduces an artificial delay. "idle" is
// the only interactive state; "authenticating" covers the real Google
// popup round-trip; "redirecting" covers the real (already-in-flight)
// referral-apply/role-lookup work redirectAfterAuth was doing anyway.
// Deliberately no per-role copy ("Verifying admin access" etc.) — the
// account's real role isn't known until /api/init resolves, and stalling
// navigation just to show a role-specific label would be exactly the fake
// delay this pass explicitly rules out.
const STATUS_COPY = {
  authenticating: "Authenticating…",
  redirecting: "Access granted entering Code Club…",
};

// Copy tailored per portal intent — same Google sign-in either way, just a
// headline that matches the card the person tapped on /portal.
const ROLE_COPY = {
  student: {
    heading: "Sign in as a Student",
    sub: "Continue your DSA journey",
  },
  recruiter: {
    heading: "Sign in as a Recruiter",
    sub: "Search verified candidates and send skills tests",
  },
  tpo: {
    heading: "Sign in as a TPO",
    sub: "Track placement readiness across your campus",
  },
};

// Authentication is the bridge between the persona chosen on /portal and
// the real product. Keep the role-specific message concise; the detailed
// product promise belongs on the landing/portal surfaces, not inside the
// sign-in form.
const ROLE_AUTH = {
  student: {
    Icon: GraduationCap,
    accent: "teal",
    image: LANDING_IMAGES.ecosystem,
    eyebrow: "Student access",
    heading: "Turn practice into proof.",
    description:
      "Your verified solve history, progress, and interview practice continue from here.",
  },
  recruiter: {
    Icon: Briefcase,
    accent: "sky",
    image: LANDING_IMAGES.recruiter,
    eyebrow: "Recruiter access",
    heading: "Find signal, not just resumes.",
    description:
      "Continue to verified candidate search, skills tests, and recruiter tools.",
  },
  tpo: {
    Icon: Building2,
    accent: "violet",
    image: LANDING_IMAGES.tpo,
    eyebrow: "TPO access",
    heading: "See readiness, not guesses.",
    description:
      "Continue to campus placement insights, student readiness, and TPO tools.",
  },
};

const DEFAULT_AUTH = {
  Icon: GraduationCap,
  accent: "teal",
  image: LANDING_IMAGES.ecosystem,
  eyebrow: "Code Club access",
  heading: "Practice that becomes proof.",
  description:
    "Sign in to continue to your Code Club workspace.",
};

const ACCENT_PANEL = {
  teal: {
    text: "text-teal-300",
    soft: "bg-teal-400/10 border-teal-400/20 text-teal-300",
    button: "hover:border-teal-400/40",
  },
  sky: {
    text: "text-sky-300",
    soft: "bg-sky-400/10 border-sky-400/20 text-sky-300",
    button: "hover:border-sky-400/40",
  },
  violet: {
    text: "text-violet-300",
    soft: "bg-violet-400/10 border-violet-400/20 text-violet-300",
    button: "hover:border-violet-400/40",
  },
};

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  // idle | authenticating | redirecting | error — see STATUS_COPY above.
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState(null);

  const roleParamRaw = searchParams.get("role");
  const roleIntent = VALID_PORTAL_ROLES.includes(roleParamRaw) ? roleParamRaw : null;
  const copy = ROLE_COPY[roleIntent] || {
    heading: "Welcome to Code Club",
    sub: "Continue your DSA journey",
  };
  const authVisual = ROLE_AUTH[roleIntent] || DEFAULT_AUTH;
  const panelAccent = ACCENT_PANEL[authVisual.accent];

  // Apply referral code after login if present in URL
  async function applyReferralIfPresent() {
    if (!refCode) return;
    try {
      await apiFetch("/api/referral/apply", {
        method: "POST",
        body: JSON.stringify({ code: refCode }),
      });
    } catch {
      // Best-effort only — a failed referral apply shouldn't block login.
    }
  }

  // Gate 3 audit, P0-1: if ProtectedRoute (or the api.js 401 handler) sent
  // this person here with ?next=, that's a page they were actively trying
  // to reach — e.g. a shared contest link — and takes priority over the
  // role-based default below. Validated by getSafeNextPath so this can
  // never become an open redirect via a crafted ?next= value.
  const nextPath = getSafeNextPath(searchParams);

  // Figures out where this account actually belongs (real role, not the
  // card that was clicked) and navigates there.
  //
  // Audit fix (Plan 002 key finding): this used to always await /api/init
  // here just to read `role` before navigating anywhere — on a cold Render
  // backend (15-30s) that stalled every plain student login on this static
  // login card the whole time, even though AppContext
  // (src/context/appContext.jsx) already fires its own independent
  // /api/init the instant `user` is set, so the backend was already
  // loading in the background regardless. For the plain-login path (no
  // ?role= intent) we now navigate straight to /dashboard without waiting;
  // if this turns out to be a returning recruiter/TPO, DashboardRoleRedirect
  // (src/routes/DashboardRoleRedirect.jsx) bounces them to their real
  // dashboard once AppContext's role has hydrated.
  //
  // The portal-intent path (?role=recruiter|tpo) still waits: unlike the
  // plain path, getPostLoginDestination() there must distinguish "already
  // has this role, go to their dashboard" from "doesn't have it yet, go to
  // the signup form" — guessing wrong would send an existing recruiter to
  // the signup flow instead of their dashboard, a correctness bug, not
  // just a slow redirect. DashboardRoleRedirect can't fix that after the
  // fact because it only wraps /dashboard, not /recruiter/signup or
  // /tpo/signup.
  async function redirectAfterAuth() {
    setStatus("redirecting");
    await applyReferralIfPresent();
    if (nextPath) {
      navigate(nextPath);
      return;
    }

    if (!roleIntent) {
      navigate("/dashboard");
      return;
    }

    try {
      const { user: bootUser } = await apiFetch("/api/init");
      navigate(getPostLoginDestination(bootUser?.role, roleIntent));
    } catch {
      // If /api/init fails (e.g. DB blip), fall back to the plain
      // dashboard rather than stranding the person mid-login.
      navigate("/dashboard");
    }
  }

  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    // Same pre-existing pattern as useAdminDashboardMetrics.js/
    // useSystemHealth.js's effects — react-hooks/set-state-in-effect flags
    // this because redirectAfterAuth() now calls setStatus("redirecting")
    // (JARVIS pass §1's real-state status line). Kept consistent with that
    // established convention rather than a one-off fix.
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern: the called function is a useCallback-wrapped async fetcher that sets loading/data state after its own await, not synchronously; see src/hooks/useAdminSettings.js for the fullest write-up of this decision.
      redirectAfterAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setStatus("authenticating");
    const loggedInUser = await signInWithGoogle();
    if (loggedInUser) {
      redirectAfterAuth();
    } else {
      // signInWithGoogle() swallows the real error (services/auth.js) and
      // just returns undefined on cancel/failure — this is the honest
      // reflection of that, not a fabricated diagnostic.
      setStatus("idle");
      setErrorMsg("Sign-in didn't complete. Please try again.");
    }
  };

  // Set by api.js when a 401 is received — triggers a redirect here
  const sessionExpired =
    new URLSearchParams(window.location.search).get("reason") === "session_expired";

  // Set by Navbar's handleLogout after logoutUser() actually completes
  // (JARVIS pass, spec §19) — an honest "you're signed out" confirmation,
  // not a cinematic shutdown sequence.
  const justLoggedOut = searchParams.get("loggedOut") === "1";

  // Guest Mode: set by AuthGate/handleSubmitCode (see
  // hooks/useProblemSolver.js) when a guest action needs an account —
  // ?reason=<key into AUTH_GATE_MESSAGES>, e.g. reason=submit. Falls back
  // to no banner for an unrecognized/absent key rather than guessing.
  const guestGateReason = searchParams.get("reason");
  const guestGateMessage =
    guestGateReason && guestGateReason !== "session_expired"
      ? AUTH_GATE_MESSAGES[guestGateReason]
      : null;

  const busy = status !== "idle";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] md:grid md:grid-cols-[1.08fr_0.92fr]">
      {/* Persona panel: the same approved image family used by /portal.
          The image is atmospheric, while the copy explains what continues
          after authentication. */}
      <aside className="relative hidden min-h-screen overflow-hidden border-r border-[var(--border)] md:block">
        <img
          src={authVisual.image}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080b0e]/95 via-[#080b0e]/72 to-[#080b0e]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080b0e]/95 via-transparent to-[#080b0e]/35" />

        <div className="relative z-10 flex min-h-screen flex-col justify-between p-10 lg:p-14">
          <Link to="/" className="flex items-center gap-2 w-fit">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-verdict-accept" />
            <span className="text-[11px] font-mono-ui uppercase tracking-[0.25em] text-white/70">
              Code Club
            </span>
          </Link>

          <div className="max-w-xl pb-4">
            <div className={`mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono-ui uppercase tracking-[0.18em] ${panelAccent.soft}`}>
              <authVisual.Icon size={13} strokeWidth={2.2} aria-hidden="true" />
              {authVisual.eyebrow}
            </div>
            <h2 className="max-w-lg text-4xl font-black tracking-tight leading-[1.04] lg:text-5xl">
              {authVisual.heading}
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/70 lg:text-base">
              {authVisual.description}
            </p>
            <div className="mt-7 flex items-center gap-2 text-xs font-mono-ui text-white/55">
              <ShieldCheck size={14} className={panelAccent.text} aria-hidden="true" />
              Secure sign-in · Your role is preserved
            </div>
          </div>
        </div>
      </aside>

      {/* Authentication surface: intentionally quieter than the portal.
          One clear action, no fake metrics, and the selected role remains
          visible so the user always knows which access path they chose. */}
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[430px] animate-fadeIn" style={{ animationDuration: "0.35s" }}>
          <div className="mb-8 flex items-center justify-between md:hidden">
            <Link to="/" className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-verdict-accept" />
              <span className="text-[11px] font-mono-ui uppercase tracking-[0.25em] text-[var(--muted-foreground)]">
                Code Club
              </span>
            </Link>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-mono-ui uppercase tracking-[0.16em] ${panelAccent.soft}`}>
              {authVisual.eyebrow}
            </span>
          </div>

          <div className="mb-8">
            <p className="text-xs font-mono-ui uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              Authentication
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{copy.heading}</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{copy.sub}</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-[var(--border-strong)] bg-[var(--background)]/40 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${panelAccent.soft}`}>
                  <authVisual.Icon size={17} strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--foreground)]">
                    {authVisual.eyebrow}
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Access selected
                  </p>
                </div>
              </div>
              <a
                href="/portal"
                className="text-[11px] font-medium text-[var(--muted-foreground)] underline underline-offset-2 hover:text-[var(--foreground)]"
              >
                Change
              </a>
            </div>

            {/* Session expired banner — shown when api.js redirects here after 401 */}
            {sessionExpired && (
              <div className="bg-verdict-pending/10 border border-verdict-pending/30 text-verdict-pending text-sm px-4 py-3 rounded-xl mb-6">
                Your session expired. Please sign in again.
              </div>
            )}

            {/* Honest sign-out confirmation — only shown after a real, completed
                logout (see Navbar's handleLogout), never sessionExpired's twin. */}
            {justLoggedOut && !sessionExpired && (
              <div className="bg-verdict-accept/10 border border-verdict-accept/30 text-verdict-accept text-sm px-4 py-3 rounded-xl mb-6">
                You've been signed out.
              </div>
            )}

            {/* Guest Mode contextual gate — why login is required for the
                action the guest just attempted (see AuthGate.jsx's
                AUTH_GATE_MESSAGES). Never shown alongside the two banners
                above; those already explain a different reason for being
                here. */}
            {guestGateMessage && !sessionExpired && !justLoggedOut && (
              <div className="bg-verdict-pending/10 border border-verdict-pending/30 text-verdict-pending text-sm px-4 py-3 rounded-xl mb-6">
                {guestGateMessage}
              </div>
            )}

            {errorMsg && (
              <div className="bg-verdict-reject/10 border border-verdict-reject/30 text-verdict-reject text-sm px-4 py-3 rounded-xl mb-6">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={busy}
              className="group w-full flex items-center justify-center gap-3 rounded-xl bg-[var(--foreground)] px-4 py-3.5 font-semibold text-[var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {!busy && (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.33 2.98-7.51Z"/>
                  <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.13H3.06v2.58A10 10 0 0 0 12 22Z"/>
                  <path fill="#FBBC05" d="M6.41 13.89A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.89V7.53H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.47l3.35-2.58Z"/>
                  <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.49l2.87-2.87C16.96 2.94 14.7 2 12 2a10 10 0 0 0-8.94 5.53l3.35 2.58C7.2 7.74 9.4 5.98 12 5.98Z"/>
                </svg>
              )}
              {busy && (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border-2 border-[var(--background)]/30 border-t-[var(--background)] animate-spin"
                />
              )}
              {busy ? STATUS_COPY[status] : "Continue with Google"}
            </button>

            {busy && (
              <p
                className="mt-3 text-center text-[11px] font-mono-ui uppercase tracking-widest text-[var(--muted-foreground)]"
                role="status"
                aria-live="polite"
              >
                {status === "authenticating" ? "Verifying with Google" : "Preparing your workspace"}
              </p>
            )}

            <p className="mt-5 text-center text-[11px] leading-5 text-[var(--muted-foreground)]">
              By continuing, you use your Google account to authenticate with Code Club.
            </p>

            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <p className="text-center text-xs text-[var(--muted-foreground)]">
                Not the right account type?{" "}
                <a
                  href="/portal"
                  className="font-medium text-[var(--foreground)] underline underline-offset-2"
                >
                  Choose your access
                </a>
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-[var(--muted-foreground)]">
            <ShieldCheck size={13} aria-hidden="true" />
            Secure Google authentication
          </div>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;