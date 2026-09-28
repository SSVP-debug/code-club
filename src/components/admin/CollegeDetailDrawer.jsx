import { useEffect, useState } from "react";
import { Users2, ExternalLink, Pencil, Check, X as XIcon, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../ui/Button";
import SideDrawer, { DrawerSection, DrawerField } from "./command/SideDrawer";
import CollegeEmailRoleRules from "./CollegeEmailRoleRules";

const STATUS_STYLES = {
  pending: "bg-amber-500/10 text-amber-400",
  verified: "bg-green-500/10 text-green-400",
  rejected: "bg-red-500/10 text-red-400",
};

/**
 * CollegeDetailDrawer — Command Center Phase 5 "College Intelligence."
 * Deliberately a light touch: same fields the card grid already renders
 * (collegeController.js's getColleges response), just given room to show
 * the two caveat notes in full instead of truncated inline italics, plus
 * "View students" promoted to the drawer's primary action.
 *
 * Rename action added alongside signup-time college auto-detection
 * (services/collegeAutoProvision.js): an auto-detected college's `name`
 * is only ever a best-effort guess from its domain (e.g. "NITS" for
 * cse.nits.ac.in) — this is the correction UI for that guess, and for any
 * other college whose name just needs fixing.
 */
export default function CollegeDetailDrawer({ college, open, onClose, onViewStudents, onRename, onSaveEmailRolePatterns }) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset the edit form whenever a different college is opened, or the
  // drawer closes — otherwise a half-typed edit from one college could
  // leak into the next one opened.
  useEffect(() => {
    setEditing(false);
    setNameInput(college?.name || "");
  }, [college?.id, open]);

  if (!college) return <SideDrawer open={open} onClose={onClose} title="" />;

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === college.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(college.id, trimmed);
      setEditing(false);
    } catch (err) {
      toast.error(err.message || "Failed to rename college.");
    }
    setSaving(false);
  }

  return (
    <SideDrawer open={open} onClose={onClose} eyebrow="College" title={college.name}>
      <DrawerSection label="Name">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setEditing(false);
              }}
              className="flex-1 bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--muted-foreground)]"
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={saving}
              aria-label="Save name"
              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="Cancel"
              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition"
            >
              <XIcon size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[var(--foreground)] text-sm font-medium">{college.name}</p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
            >
              <Pencil size={12} />
              Rename
            </button>
          </div>
        )}
        {college.autoDetected && (
          <p className="mt-2 flex items-center gap-1 text-amber-400/90 text-xs">
            <Sparkles size={12} />
            Auto-detected from a student signup — this name is a guess based on the domain, not
            reviewed. Rename it if it's wrong.
          </p>
        )}
      </DrawerSection>

      <DrawerSection label="Status">
        <span
          className={`text-xs px-2 py-1 rounded-full uppercase tracking-wide font-semibold ${
            STATUS_STYLES[college.status] || "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]"
          }`}
        >
          {college.status}
        </span>
      </DrawerSection>

      <DrawerSection label="Reach">
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div>
            <p className="text-[var(--foreground)] text-2xl font-black">{college.studentCount}</p>
            <p className="text-[var(--muted-foreground)] text-[10px] uppercase tracking-wide">Students</p>
          </div>
          <div>
            <p className="text-[var(--foreground)] text-2xl font-black">{college.activeStudentCount}</p>
            <p className="text-[var(--muted-foreground)] text-[10px] uppercase tracking-wide">Active</p>
          </div>
          <div>
            <p className="text-[var(--foreground)] text-2xl font-black">{college.tpoCount}</p>
            <p className="text-[var(--muted-foreground)] text-[10px] uppercase tracking-wide">TPOs</p>
          </div>
        </div>
        <DrawerField label="Domains" value={college.domains?.join(", ")} copyable />
      </DrawerSection>

      <DrawerSection label="Email role patterns">
        <CollegeEmailRoleRules
          staffRules={college.staffEmailPatterns}
          studentRules={college.studentEmailPatterns}
          onSave={(staffRules, studentRules) =>
            onSaveEmailRolePatterns(college.id, staffRules, studentRules)
          }
        />
      </DrawerSection>

      <DrawerSection label="Activity">
        <DrawerField label="Problems solved" value={college.totalSolvedProblems} />
      </DrawerSection>

      <DrawerSection label="Notes">
        <p className="text-[var(--muted-foreground)] text-xs leading-relaxed mb-2">{college.studentCountCaveat}</p>
        <p className="text-[var(--muted-foreground)] text-xs leading-relaxed">{college.recruiterCountNote}</p>
      </DrawerSection>

      <DrawerSection label="Actions">
        <Button
          size="sm"
          variant="secondary"
          className="w-full justify-center"
          onClick={() => onViewStudents(college)}
        >
          <Users2 size={14} />
          View students
          <ExternalLink size={11} />
        </Button>
      </DrawerSection>
    </SideDrawer>
  );
}