import { useEffect, useState } from "react";
import { ArrowRight, Mail, Share2, ShieldCheck, Users } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { apiFetch } from "../services/api";
import { share } from "../utils/share";

export default function CollegeTpoDirectoryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verificationRequired, setVerificationRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/tpo/college-directory")
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setVerificationRequired(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const isCollegeEmailUnverified =
            err?.status === 403 && err?.body?.code === "COLLEGE_EMAIL_UNVERIFIED";
          setVerificationRequired(isCollegeEmailUnverified);
          if (!isCollegeEmailUnverified) {
            setError(err.message || "Failed to load your college TPOs.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleInviteFaculty = async () => {
    if (!data?.college?.name) return;

    try {
      await share({
        title: "Join Code Club as a TPO",
        text: `Join Code Club as a Training & Placement Officer for ${data.college.name} and help your students prepare for placements.`,
        url: `${window.location.origin}/tpo/signup`,
      });
    } catch {
      // Share/clipboard failures should not turn the directory into an error state.
    }
  };

  return (
    <DashboardLayout>
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            College support
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--foreground)] mt-2">
            Find your College TPOs
          </h1>
          <p className="text-[var(--muted-foreground)] mt-2 max-w-2xl leading-6">
            Connect with the verified Training & Placement Officers responsible for your institution.
          </p>
        </header>

        {loading ? (
          <div
            className="flex justify-center py-16"
            role="status"
            aria-live="polite"
            aria-label="Loading your college TPO directory"
          >
            <div
              className="w-7 h-7 border-2 border-[var(--theme-primary,#2dd4bf)] border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
          </div>
        ) : verificationRequired ? (
          <section
            aria-labelledby="college-email-verification-title"
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-10"
          >
            <div className="max-w-2xl">
              <div className="w-12 h-12 rounded-2xl bg-[var(--surface-elevated)] flex items-center justify-center" aria-hidden="true">
                <ShieldCheck size={22} />
              </div>
              <h2
                id="college-email-verification-title"
                className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mt-5"
              >
                Verify your college email
              </h2>
              <p className="text-[var(--muted-foreground)] mt-3 leading-6">
                If you are a college student, verify your college email from your Profile page.
              </p>
              <p className="text-[var(--muted-foreground)] mt-2 leading-6">
                Once your college email is verified, all verified TPOs from your college will be displayed here.
              </p>
              <a
                href="/profile"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-semibold text-[var(--background)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary,#2dd4bf)] focus-visible:ring-offset-2 transition"
              >
                Go to Profile
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </section>
        ) : data?.enabled === false ? (
          <section
            aria-labelledby="college-directory-disabled-title"
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-10"
          >
            <div className="max-w-2xl">
              <div className="w-12 h-12 rounded-2xl bg-[var(--surface-elevated)] flex items-center justify-center" aria-hidden="true">
                <Users size={22} />
              </div>
              <h2
                id="college-directory-disabled-title"
                className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mt-5"
              >
                College TPO directory is not live yet
              </h2>
              <p className="text-[var(--muted-foreground)] mt-3 leading-6">
                {data.message || "The college support directory is currently being prepared."}
              </p>
            </div>
          </section>
        ) : error ? (
          <section
            role="alert"
            aria-labelledby="college-directory-error-title"
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8"
          >
            <h2 id="college-directory-error-title" className="font-semibold text-[var(--foreground)]">
              TPO directory unavailable
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-2 leading-6">{error}</p>
          </section>
        ) : data?.college && Array.isArray(data.tpos) ? (
          <>
            <section
              aria-labelledby="college-directory-college-title"
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-[var(--surface-elevated)] flex items-center justify-center" aria-hidden="true">
                  <Users size={20} />
                </div>
                <div className="min-w-0">
                  <h2
                    id="college-directory-college-title"
                    className="font-semibold text-[var(--foreground)] truncate"
                  >
                    {data.college.name}
                  </h2>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {data.tpos.length} verified TPO{data.tpos.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </section>

            {data.tpos.length === 0 ? (
              <section
                aria-labelledby="no-tpos-title"
                className="rounded-2xl border border-dashed border-[var(--border)] p-6 sm:p-10 text-center"
              >
                <ShieldCheck
                  className="mx-auto mb-3 text-[var(--muted-foreground)]"
                  size={24}
                  aria-hidden="true"
                />
                <h2 id="no-tpos-title" className="font-semibold text-[var(--foreground)]">
                  No verified TPOs yet
                </h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-1 leading-6">
                  Your institution does not currently have a verified TPO on Code Club.
                </p>
                <p className="text-sm text-[var(--muted-foreground)] mt-3 leading-6 max-w-xl mx-auto">
                  Connect with your college placement authority and invite a faculty member to join Code Club as a Training & Placement Officer on behalf of your college.
                </p>
                <button
                  type="button"
                  onClick={handleInviteFaculty}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-semibold text-[var(--background)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary,#2dd4bf)] focus-visible:ring-offset-2 transition"
                >
                  <Share2 size={16} aria-hidden="true" />
                  Invite your college faculty
                </button>
              </section>
            ) : (
              <section aria-labelledby="verified-tpos-title">
                <h2 id="verified-tpos-title" className="sr-only">
                  Verified College TPOs
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.tpos.map((tpo) => (
                    <article
                      key={tpo.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 min-w-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-lg text-[var(--foreground)] break-words">
                            {tpo.name}
                          </h3>
                          <p className="text-sm text-[var(--muted-foreground)] mt-1 break-words">
                            {tpo.collegeName}
                          </p>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 bg-[var(--surface-elevated)] text-[var(--foreground)]">
                          <ShieldCheck size={13} aria-hidden="true" />
                          Verified
                        </span>
                      </div>
                      {tpo.isPrimary ? (
                        <p className="text-xs text-[var(--muted-foreground)] mt-4">Primary TPO</p>
                      ) : null}
                      <a
                        href={`mailto:${tpo.email}`}
                        aria-label={`Email ${tpo.name} at ${tpo.email}`}
                        className="mt-4 inline-flex max-w-full min-h-11 items-center gap-2 text-sm font-semibold text-[var(--foreground)] hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary,#2dd4bf)] focus-visible:ring-offset-2 transition"
                      >
                        <Mail size={15} aria-hidden="true" />
                        <span className="break-all">{tpo.email}</span>
                      </a>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <section
            role="alert"
            aria-labelledby="unexpected-response-title"
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8"
          >
            <h2 id="unexpected-response-title" className="font-semibold text-[var(--foreground)]">
              TPO directory unavailable
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-2 leading-6">
              We received an unexpected response. Please try again later.
            </p>
          </section>
        )}
      </main>
    </DashboardLayout>
  );
}
