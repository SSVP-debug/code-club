import { useState } from "react";
import toast from "react-hot-toast";
import SectionCard from "../ui/layout/SectionCard";
import Button from "../ui/Button";
import { useAppContext } from "../../hooks/useAppContext";
import { Sparkles, ArrowUpRight, X } from "lucide-react";
import { GithubMark } from "../icons/BrandIcons";

/**
 * FeaturedProject — one pinned repository shown as a portfolio highlight,
 * not a URL field. Data model (developerProfile.featuredProjects) is an
 * array so this can grow into multiple showcased projects later without a
 * migration; the UI only ever surfaces the first one for now.
 *
 * No fabricated stars/forks/language/description — this app has no GitHub
 * API integration, so only owner/repo (safely parsed from the URL) is
 * shown. If that integration is added later, this component's read state
 * is the only place that needs to grow.
 */
function FeaturedProject({ collapsible = true }) {
  const { developerProfile, updateDeveloperProfile } = useAppContext();
  const project = developerProfile.featuredProjects?.[0] || null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project?.url || "");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(project?.url || "");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateDeveloperProfile({ featuredProjectUrl: draft.trim() });
      toast.success("Featured project updated");
      setEditing(false);
    } catch (err) {
      toast.error(err.message || "Failed to save featured project");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await updateDeveloperProfile({ featuredProjectUrl: "" });
      toast.success("Featured project removed");
      setEditing(false);
    } catch (err) {
      toast.error(err.message || "Failed to remove featured project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Featured Project"
      subtitle="Showcase the project you're most proud of."
      icon={<Sparkles size={18} strokeWidth={2} />}
      accented
      collapsible={collapsible}
      defaultOpen
      storageKey="profile-collapse-featured-project"
      action={
        !editing && project ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={startEdit} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition">
              Edit
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
              className="text-[var(--muted-foreground)] hover:text-red-400 transition"
              aria-label="Remove featured project"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ) : undefined
      }
    >
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[var(--muted-foreground)] text-xs">GitHub repository URL</label>
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="github.com/yourname/project"
              className="w-full mt-1.5 bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#2dd4bf)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="theme" disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : project ? (
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-4 bg-[var(--surface-elevated)] rounded-xl px-5 py-4 hover:bg-[var(--surface-elevated)]/80 transition"
        >
          <div className="min-w-0">
            <p className="font-semibold text-[var(--foreground)] truncate">{project.repo}</p>
            <p className="text-[var(--muted-foreground)] text-sm mt-0.5 flex items-center gap-1.5">
              <GithubMark size={13} />
              {project.owner}/{project.repo}
            </p>
          </div>
          <span className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] group-hover:text-[var(--theme-primary,#2dd4bf)] transition flex-shrink-0">
            View Repository
            <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
          </span>
        </a>
      ) : (
        <div className="flex items-center justify-between gap-4 flex-wrap bg-[var(--surface-elevated)]/60 border border-dashed border-[var(--border-strong)] rounded-xl px-5 py-4">
          <p className="text-[var(--muted-foreground)] text-sm">
            Pin the repository you'd want a recruiter to see first.
          </p>
          <Button size="sm" variant="theme" onClick={startEdit}>
            Add project
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

export default FeaturedProject;