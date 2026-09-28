import { useState } from "react";
import toast from "react-hot-toast";
import SectionCard from "../ui/layout/SectionCard";
import Button from "../ui/Button";
import { useAppContext } from "../../hooks/useAppContext";
import { FileText, ArrowUpRight, Lock, Globe, X } from "lucide-react";

/**
 * ResumeCard — resume as a professional asset, not a settings field.
 * Defaults to private: saving a link never implicitly exposes it on the
 * public profile. Visibility is an explicit, visible choice at save time.
 */
function ResumeCard({ collapsible = true }) {
  const { developerProfile, updateDeveloperProfile } = useAppContext();
  const { resumeUrl, resumeVisibility } = developerProfile;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(resumeUrl || "");
  const [visibility, setVisibility] = useState(resumeVisibility || "private");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(resumeUrl || "");
    setVisibility(resumeVisibility || "private");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateDeveloperProfile({
        resumeUrl: draft.trim(),
        resumeVisibility: visibility,
      });
      toast.success("Resume updated");
      setEditing(false);
    } catch (err) {
      toast.error(err.message || "Failed to save resume");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await updateDeveloperProfile({ resumeUrl: "", resumeVisibility: "private" });
      toast.success("Resume removed");
      setEditing(false);
    } catch (err) {
      toast.error(err.message || "Failed to remove resume");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Resume"
      subtitle="Your resume, shared on your terms."
      accented
      collapsible={collapsible}
      defaultOpen
      storageKey="profile-collapse-resume"
    >
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[var(--muted-foreground)] text-xs">Resume link</label>
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="drive.google.com/... or your site"
              className="w-full mt-1.5 bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#2dd4bf)]"
            />
          </div>

          <div>
            <label className="text-[var(--muted-foreground)] text-xs">Visibility</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg py-2 border transition ${
                  visibility === "private"
                    ? "bg-[var(--border-strong)] border-[var(--border-strong)] text-[var(--foreground)]"
                    : "bg-[var(--surface-elevated)] border-[var(--border-strong)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Lock size={12} strokeWidth={2} aria-hidden="true" />
                Private
              </button>
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg py-2 border transition ${
                  visibility === "public"
                    ? "bg-[var(--border-strong)] border-[var(--border-strong)] text-[var(--foreground)]"
                    : "bg-[var(--surface-elevated)] border-[var(--border-strong)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Globe size={12} strokeWidth={2} aria-hidden="true" />
                Public
              </button>
            </div>
            <p className="text-[var(--muted-foreground)] text-xs mt-1.5">
              {visibility === "public"
                ? "Visible to anyone who views your public profile."
                : "Only visible to you — hidden from your public profile."}
            </p>
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
      ) : resumeUrl ? (
        <div className="flex items-center justify-between gap-3 bg-[var(--surface-elevated)] rounded-xl px-4 py-3">
          <a
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 min-w-0 text-sm font-medium text-[var(--foreground)] hover:text-[var(--theme-primary,#2dd4bf)] transition"
          >
            <FileText size={18} strokeWidth={2} className="text-[var(--muted-foreground)] group-hover:text-[var(--theme-primary,#2dd4bf)] transition flex-shrink-0" aria-hidden="true" />
            <span className="truncate">View Resume</span>
            <ArrowUpRight size={14} strokeWidth={2} className="flex-shrink-0" aria-hidden="true" />
          </a>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                resumeVisibility === "public"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]"
              }`}
            >
              {resumeVisibility === "public" ? (
                <Globe size={10} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Lock size={10} strokeWidth={2} aria-hidden="true" />
              )}
              {resumeVisibility === "public" ? "Public" : "Private"}
            </span>
            <button type="button" onClick={startEdit} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition">
              Edit
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
              className="text-[var(--muted-foreground)] hover:text-red-400 transition"
              aria-label="Remove resume"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 bg-[var(--surface-elevated)]/60 border border-dashed border-[var(--border-strong)] rounded-xl px-4 py-3">
          <span className="flex items-center gap-2.5 text-sm text-[var(--muted-foreground)]">
            <FileText size={18} strokeWidth={2} className="flex-shrink-0" aria-hidden="true" />
            Add your resume link.
          </span>
          <Button size="sm" variant="secondary" onClick={startEdit}>
            Add
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

export default ResumeCard;