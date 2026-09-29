import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../services/api";
import PageMeta from "../components/seo/PageMeta";
import Button from "../components/ui/Button";

export default function TpoSignupPage() {
  const navigate = useNavigate();
  const [collegeName, setCollegeName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!collegeName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/tpo/register", {
        method: "POST",
        body: JSON.stringify({ collegeName: collegeName.trim() }),
      });
      if (data.error) {
        setError(data.error);
      } else if (data.enabled === false) {
        setError(data.message);
      } else {
        navigate("/tpo/dashboard");
      }
    } catch {
      setError("Something went wrong. Try again.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
      <PageMeta title="College Admin Signup · Code Club" path="/tpo/signup" />
      <div className="max-w-md w-full">
        <Link to="/dashboard" className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition mb-6 inline-block">
          ← Back to dashboard
        </Link>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[var(--foreground)] mb-2">College Admin Access</h1>
          <p className="text-[var(--muted-foreground)] text-sm">
            For Training & Placement Officers. Track your students' DSA progress,
            assign problems, and get placement readiness reports.
          </p>
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-xs text-[var(--muted-foreground)]">
            <span className="font-semibold text-[var(--foreground)]">How approval works:</span>{" "}
            submit your institutional details, then an administrator reviews your TPO request before access is enabled.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
              College Name
            </label>
            <input
              value={collegeName}
              onChange={e => setCollegeName(e.target.value)}
              placeholder="e.g. Marwadi University"
              className="w-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-[var(--foreground)] outline-none focus:border-[var(--theme-primary,#2dd4bf)]/50"
            />
          </div>

          <p className="text-xs text-[var(--muted-foreground)]">
            We'll use your sign-in email's domain (e.g. @marwadiuniversity.ac.in) to
            automatically link your students. Please sign in with your institutional
            email, not a personal Gmail account.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !collegeName.trim()}
            loading={loading}
            className="w-full"
          >
            {loading ? "Submitting…" : "Submit for verification"}
          </Button>
        </form>
      </div>
    </div>
  );
}