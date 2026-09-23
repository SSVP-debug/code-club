import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useTheme } from "../hooks/useTheme";
import { useAppContext } from "../hooks/useAppContext";
import { DEFAULT_THEME } from "../themes";
import { apiFetch } from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";
import Button from "../components/ui/Button";
import ConnectLeetCodeSection from "../components/dashboard/ConnectLeetCodeSection";

// ── Integrations data ──────────────────────────────────────────────────────────
// Moved here verbatim from Profile.jsx (Phase 9A) — this is account
// management, it belongs next to the other "Account" controls, not mixed
// into the coding-identity page.

const INTEGRATIONS = [
  {
    id: "google",
    name: "Google Account",
    description: "Sign in and sync your identity across devices.",
    status: "connected",
    icon: "G",
    iconBg: "bg-white",
    iconColor: "text-zinc-900",
  },
  {
    id: "codeforces",
    name: "Codeforces",
    description: "Track competitive programming performance and ratings.",
    status: "planned",
    icon: "CF",
    iconBg: "bg-blue-600",
    iconColor: "text-[var(--foreground)]",
  },
  {
    id: "gfg",
    name: "GeeksforGeeks",
    description: "Import coding activity, streaks, and achievements.",
    status: "planned",
    icon: "G",
    iconBg: "bg-green-600",
    iconColor: "text-[var(--foreground)]",
  },
];

function StatusBadge({ status }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Connected
      </span>
    );
  }
  if (status === "coming-soon") {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--surface-elevated)] text-[var(--muted-foreground)] border border-[var(--border-strong)]">
        Coming Soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--surface-elevated)] text-[var(--muted-foreground)] border border-[var(--border-strong)]">
      Planned
    </span>
  );
}

function IntegrationRow({ integration }) {
  const { name, description, status, icon, iconBg, iconColor } = integration;
  return (
    <div className="flex items-center justify-between py-4 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center text-sm font-bold ${iconColor} flex-shrink-0`}
        >
          {icon}
        </div>
        <div>
          <p className="font-medium text-[var(--foreground)] text-sm">{name}</p>
          <p className="text-[var(--muted-foreground)] text-xs mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex-shrink-0 ml-4">
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

// Same switch markup as RecruiterSnapshot.jsx's toggle — kept visually
// consistent across the app rather than inventing a second toggle style.
function ToggleRow({ label, description, checked, saving, onToggle }) {
  return (
    <div className="flex items-center justify-between bg-[var(--surface-elevated)] rounded-xl p-4">
      <div className="pr-4">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-[var(--muted-foreground)] text-xs mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={saving}
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
          checked ? "bg-[var(--theme-primary,#2dd4bf)]" : "bg-[var(--border-strong)]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SettingsPage() {
    const { theme, themeId, setTheme } = useTheme();
    const isDefaultTheme = themeId === DEFAULT_THEME;

    // ── Account state ────────────────────────────────────────────────────
    // Phase 9E: username/leetcode now live in AppContext (hydrated once at
    // boot via /api/init) instead of this page fetching /api/users/me on
    // its own — same data, one source of truth, one fewer round trip.
    const {
        username: currentUsername,
        setUsername: setCurrentUsername,
        leetcodeUsername,
        leetcodeStats,
        visibleToTpo,
        updateTpoVisibility,
        preferences,
        updatePreferences,
    } = useAppContext();

    const [username, setUsernameDraft] = useState(currentUsername);
    const [savingUsername, setSavingUsername] = useState(false);
    const [savingBlankEditor, setSavingBlankEditor] = useState(false);
    const [savingHideDifficulty, setSavingHideDifficulty] = useState(false);
    const [savingTpoVisibility, setSavingTpoVisibility] = useState(false);
    // Tracks which currentUsername the draft was last seeded from — the
    // "adjusting state when a prop changes" pattern, so a fresh value
    // (e.g. once appContext finishes hydrating) re-seeds the input during
    // render rather than via a useEffect that calls setState synchronously.
    const [trackedUsername, setTrackedUsername] = useState(currentUsername);

    if (currentUsername !== trackedUsername) {
        setTrackedUsername(currentUsername);
        setUsernameDraft(currentUsername);
    }

    const leetcodeInitial = leetcodeUsername
        ? { username: leetcodeUsername, ...leetcodeStats }
        : null;

    async function handleSaveUsername() {
        try {
            setSavingUsername(true);
            const result = await apiFetch("/api/users/me", {
                method: "PATCH",
                body: JSON.stringify({ username }),
            });
            setCurrentUsername(result.username);
            toast.success("Username saved");
        } catch (err) {
            toast.error(err.message || "Failed to save username");
        } finally {
            setSavingUsername(false);
        }
    }

    function handleCopyProfileLink() {
        navigator.clipboard.writeText(`${window.location.origin}/u/${currentUsername}`);
        toast.success("Profile link copied!");
    }

    async function handleToggleBlankEditor() {
        const next = !preferences.blankEditorByDefault;
        setSavingBlankEditor(true);
        try {
            await updatePreferences({ blankEditorByDefault: next });
            toast.success(next ? "Editor will start blank" : "Editor will start with starter code");
        } catch (err) {
            toast.error(err.message || "Failed to save preference");
        } finally {
            setSavingBlankEditor(false);
        }
    }

    async function handleToggleHideDifficulty() {
        const next = !preferences.hideDifficultyLabels;
        setSavingHideDifficulty(true);
        try {
            await updatePreferences({ hideDifficultyLabels: next });
            toast.success(next ? "Difficulty labels hidden" : "Difficulty labels shown");
        } catch (err) {
            toast.error(err.message || "Failed to save preference");
        } finally {
            setSavingHideDifficulty(false);
        }
    }

    function downloadProfilePDF() {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
        import("../services/auth").then(({ getIdToken }) => {
            getIdToken().then(token => {
                fetch(`${API_URL}/api/profile/pdf`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                    .then(r => r.blob())
                    .then(blob => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${currentUsername || "profile"}_CodeClub_Profile.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                    })
                    .catch(() => toast.error("PDF generation failed. Try again."));
            });
        });
    }

    // ── Theme handler (unchanged) ────────────────────────────────────────────
    const handleResetTheme = () => {
        if (isDefaultTheme) return;

        setTheme(DEFAULT_THEME);
        toast.success("Universe reset to default.");
    };

    return (
        <DashboardLayout>
        <div className="max-w-4xl mx-auto text-[var(--foreground)]">
            <div className="flex items-start justify-between gap-4 mb-8">
                <h1 className="text-3xl font-bold">Settings</h1>
                <Link
                    to="/profile"
                    className="flex-shrink-0 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition whitespace-nowrap mt-1"
                >
                    ← Back to Profile
                </Link>
            </div>

            <div className="space-y-6">

                {/* ── Account: username + public URL + export ────────────────── */}
                <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
                    <h2 className="text-xl font-semibold mb-2">Account</h2>
                    <p className="text-[var(--muted-foreground)] text-sm mb-4">
                        Your username determines your public Code Club profile URL.
                    </p>

                    <div className="space-y-4">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsernameDraft(e.target.value)}
                            placeholder="Choose a username"
                            className="w-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-4 py-3"
                        />

                        <Button
                            disabled={savingUsername}
                            onClick={handleSaveUsername}
                        >
                            Save Username
                        </Button>

                        {currentUsername && (
                            <div className="bg-[var(--surface-elevated)] rounded-xl p-4">
                                <p className="text-sm text-[var(--muted-foreground)]">Public URL</p>
                                <p className="font-mono mt-1 break-all">
                                    {window.location.origin}/u/{currentUsername}
                                </p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleCopyProfileLink}
                                    className="mt-3"
                                >
                                    Copy Profile Link
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={downloadProfilePDF}
                                    className="mt-3 ml-3"
                                >
                                    Export Profile
                                </Button>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Integrations ────────────────────────────────────────────── */}
                <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-semibold">Integrations</h2>
                        <span className="text-xs text-[var(--muted-foreground)] bg-[var(--surface-elevated)] px-2 py-1 rounded-lg">
                            More platforms coming
                        </span>
                    </div>
                    <p className="text-[var(--muted-foreground)] text-sm mb-4">
                        Connect your coding profiles to unlock unified analytics and cross-platform insights.
                    </p>

                    <div className="pb-4 mb-4 border-b border-[var(--border)]">
                        <ConnectLeetCodeSection initial={leetcodeInitial} />
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                        {INTEGRATIONS.map((integration) => (
                            <IntegrationRow key={integration.id} integration={integration} />
                        ))}
                    </div>
                </section>

                <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
                    <h2 className="text-xl font-semibold mb-2">Appearance</h2>

                    <p className="text-[var(--muted-foreground)]">
                        Current Universe
                    </p>

                    <p className="font-semibold mt-2">
                        {theme.name}
                    </p>

                    <button
                        onClick={handleResetTheme}
                        disabled={isDefaultTheme}
                        className="mt-4 px-4 py-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-strong)] hover:bg-[var(--border-strong)] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--surface-elevated)]"
                    >
                        Reset to Default
                    </button>

                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                        {isDefaultTheme
                            ? "You're on the default experience no universe theming applied."
                            : "Clears your universe selection and switches to a clean, unthemed experience with plain labels (Dashboard, Problems, Profile)."}
                    </p>
                </section>

                <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
                    <h2 className="text-xl font-semibold mb-2">Placement privacy</h2>
                    <p className="text-[var(--muted-foreground)] text-sm mb-4">
                        Control whether verified placement officers from your college can see your Code Club progress.
                    </p>
                    <ToggleRow
                        label="Visible to my college TPO"
                        description="When enabled, verified TPOs from your college can see you in their student directory and placement dashboard. Turning this off does not change your public profile or recruiter visibility."
                        checked={visibleToTpo}
                        saving={savingTpoVisibility}
                        onToggle={async () => {
                            const next = !visibleToTpo;
                            setSavingTpoVisibility(true);
                            try {
                                await updateTpoVisibility(next);
                                toast.success(next ? "Visible to your college TPO" : "Hidden from your college TPO");
                            } catch (err) {
                                toast.error(err.message || "Failed to save placement privacy");
                            } finally {
                                setSavingTpoVisibility(false);
                            }
                        }}
                    />
                </section>

                <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
                    <h2 className="text-xl font-semibold mb-2">
                        Editor
                    </h2>
                    <p className="text-[var(--muted-foreground)] text-sm mb-4">
                        Preferences for how problems and the code editor behave.
                    </p>

                    <div className="space-y-3">
                        <ToggleRow
                            label="Start with blank editor"
                            description="Skip the starter code template and begin from an empty file on every new problem. Any code you've already saved for a problem is never discarded by this."
                            checked={preferences.blankEditorByDefault}
                            saving={savingBlankEditor}
                            onToggle={handleToggleBlankEditor}
                        />
                        <ToggleRow
                            label="Disable difficulty labels"
                            description="Hides the Easy / Medium / Hard badge in the question panel useful if the label biases how you approach a problem."
                            checked={preferences.hideDifficultyLabels}
                            saving={savingHideDifficulty}
                            onToggle={handleToggleHideDifficulty}
                        />
                    </div>
                </section>

                <section className="bg-red-950/30 border border-red-800 rounded-2xl p-6">
                    <h2 className="text-xl font-semibold text-red-400 mb-2">
                        Danger Zone
                    </h2>

                    <button
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 transition"
                        onClick={() => toast("Progress reset will be implemented in a future update.")}
                    >
                        Reset Progress
                    </button>

                    <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                        This action will permanently delete your progress, streaks, XP, and submissions.
                    </p>
                </section>

            </div>
        </div>
        </DashboardLayout>
    );
}

export default SettingsPage;