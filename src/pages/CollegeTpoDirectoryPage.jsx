import { useEffect, useState } from "react";
import { Mail, ShieldCheck, Users } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { apiFetch } from "../services/api";

export default function CollegeTpoDirectoryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/tpo/college-directory")
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load your college TPOs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">College support</p>
          <h1 className="text-3xl font-black text-[var(--foreground)] mt-2">Find your College TPOs</h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            Connect with the verified Training & Placement Officers responsible for your institution.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-[var(--theme-primary,#2dd4bf)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="font-semibold text-[var(--foreground)]">TPO directory unavailable</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">{error}</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[var(--surface-elevated)] flex items-center justify-center">
                <Users size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{data.college.name}</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {data.tpos.length} verified TPO{data.tpos.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {data.tpos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
                <ShieldCheck className="mx-auto mb-3 text-[var(--muted-foreground)]" size={24} aria-hidden="true" />
                <p className="font-semibold text-[var(--foreground)]">No verified TPOs yet</p>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  Your institution does not currently have a verified TPO on Code Club.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.tpos.map((tpo) => (
                  <article key={tpo.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-bold text-lg text-[var(--foreground)]">{tpo.name}</h2>
                        <p className="text-sm text-[var(--muted-foreground)] mt-1">{tpo.collegeName}</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 bg-[var(--surface-elevated)] text-[var(--foreground)]">
                        <ShieldCheck size={13} aria-hidden="true" />
                        Verified
                      </span>
                    </div>
                    {tpo.isPrimary ? <p className="text-xs text-[var(--muted-foreground)] mt-4">Primary TPO</p> : null}
                    <a href={`mailto:${tpo.email}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] hover:opacity-70 transition">
                      <Mail size={15} aria-hidden="true" />
                      {tpo.email}
                    </a>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
