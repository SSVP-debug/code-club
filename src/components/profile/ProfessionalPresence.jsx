import { useState } from "react";
import toast from "react-hot-toast";
import SectionCard from "../ui/layout/SectionCard";
import Button from "../ui/Button";
import { useAppContext } from "../../hooks/useAppContext";
import { ArrowUpRight, X } from "lucide-react";
import { GithubMark, LinkedinMark } from "../icons/BrandIcons";

/**
 * ProfessionalPresence — GitHub + LinkedIn as developer-identity elements,
 * not raw URL fields. Each row edits independently (matches
 * RecruiterSnapshot/EducationSection's localized-edit pattern rather than
 * a whole-card "Edit Profile" mode).
 */
function ProfessionalPresence({ collapsible = true }) {
  const { developerProfile, updateDeveloperProfile } = useAppContext();

  return (
    <SectionCard
      title="Professional Presence"
      subtitle="Connect the profiles that represent your work."
      accented
      collapsible={collapsible}
      defaultOpen
      storageKey="profile-collapse-professional-presence"
    >
      <div className="space-y-3">
        <LinkRow
          icon={<GithubMark size={18} />}
          label="GitHub"
          value={developerProfile.githubUrl}
          displayValue={
            developerProfile.githubUrl
              ? `@${usernameFromUrl(developerProfile.githubUrl)}`
              : null
          }
          placeholder="github.com/yourname"
          fieldKey="githubUrl"
          onSave={updateDeveloperProfile}
        />
        <LinkRow
          icon={<LinkedinMark size={18} />}
          label="LinkedIn"
          value={developerProfile.linkedinUrl}
          displayValue={developerProfile.linkedinUrl ? "View LinkedIn" : null}
          placeholder="linkedin.com/in/yourname"
          fieldKey="linkedinUrl"
          onSave={updateDeveloperProfile}
        />
      </div>
    </SectionCard>
  );
}

function usernameFromUrl(url) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean)[0] || url;
  } catch {
    return url;
  }
}

function LinkRow({ icon, label, value, displayValue, placeholder, fieldKey, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(value || "");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ [fieldKey]: draft.trim() });
      toast.success(`${label} updated`);
      setEditing(false);
    } catch (err) {
      toast.error(err.message || `Failed to save ${label}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await onSave({ [fieldKey]: "" });
      toast.success(`${label} removed`);
      setEditing(false);
    } catch (err) {
      toast.error(err.message || `Failed to remove ${label}`);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="bg-[var(--surface-elevated)] rounded-xl p-3">
        <label className="text-[var(--muted-foreground)] text-xs flex items-center gap-1.5">
          {icon}
          {label}
        </label>
        <div className="flex items-center gap-2 mt-1.5">
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="flex-1 min-w-0 bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary,#2dd4bf)]"
          />
          <Button size="sm" variant="theme" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 bg-[var(--surface-elevated)] rounded-xl px-4 py-3">
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2.5 min-w-0 text-sm font-medium text-[var(--foreground)] hover:text-[var(--theme-primary,#2dd4bf)] transition"
        >
          <span className="text-[var(--muted-foreground)] group-hover:text-[var(--theme-primary,#2dd4bf)] transition flex-shrink-0">
            {icon}
          </span>
          <span className="truncate">{displayValue}</span>
          <ArrowUpRight size={14} strokeWidth={2} className="flex-shrink-0" aria-hidden="true" />
        </a>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={startEdit}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={saving}
            className="text-[var(--muted-foreground)] hover:text-red-400 transition"
            aria-label={`Remove ${label}`}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-[var(--surface-elevated)]/60 border border-dashed border-[var(--border-strong)] rounded-xl px-4 py-3">
      <span className="flex items-center gap-2.5 text-sm text-[var(--muted-foreground)]">
        <span className="flex-shrink-0">{icon}</span>
        {label}
      </span>
      <Button size="sm" variant="secondary" onClick={startEdit}>
        Add
      </Button>
    </div>
  );
}

export default ProfessionalPresence;