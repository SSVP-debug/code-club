import { useState } from "react";
import toast from "react-hot-toast";
import { apiFetch } from "../../services/api";
import Button from "../ui/Button";

/**
 * TpoCohortFormModal — Create Cohort / Edit Cohort (TPO-2 Step 7).
 *
 * Shared by both flows: pass `cohort` (the full cohort object from GET
 * /api/tpo/cohorts/:id) to edit it, or omit it to create a new one.
 * Fields match services/cohortService.js's own EDITABLE_FIELDS allowlist
 * exactly — collegeId/createdBy/status/archivedAt/archivedBy are never
 * rendered as inputs, so there's no client code path that could even
 * attempt to send them (the backend also never reads them off the body
 * for these fields, per that file's own comment — this is belt-and-
 * suspenders, not the actual security boundary).
 *
 * Client-side validation mirrors backend/models/Cohort.js's own
 * validators (maxlength/range checks) so an obviously-invalid submission
 * never round-trips to the server — but the backend's own validation
 * (via isCohortValidationError/formatCohortValidationError) remains
 * authoritative; a validation error surfaced from the server still shows
 * via toast, same as any other apiFetch failure.
 *
 * Modal chrome (backdrop, panel, click-outside-to-close) matches
 * TpoDashboardPage.jsx's own CreateAssignmentModal — the existing inline
 * modal pattern in this exact part of the app — rather than introducing
 * a new one.
 */
export default function TpoCohortFormModal({ cohort, onClose, onSaved }) {
  const isEdit = Boolean(cohort);

  const [name, setName] = useState(cohort?.name || "");
  const [academicYear, setAcademicYear] = useState(cohort?.academicYear || "");
  const [graduatingYear, setGraduatingYear] = useState(
    cohort?.graduatingYear != null ? String(cohort.graduatingYear) : ""
  );
  const [branch, setBranch] = useState(cohort?.branch || "");
  const [section, setSection] = useState(cohort?.section || "");
  const [expectedHeadcount, setExpectedHeadcount] = useState(
    cohort?.expectedHeadcount != null ? String(cohort.expectedHeadcount) : ""
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const errors = {};
    if (!name.trim()) errors.name = "Name is required.";
    else if (name.trim().length > 120) errors.name = "Must be 120 characters or fewer.";

    if (!academicYear.trim()) errors.academicYear = "Academic year is required.";
    else if (academicYear.trim().length > 20) errors.academicYear = "Must be 20 characters or fewer.";

    const gradYearNum = parseInt(graduatingYear, 10);
    if (
      !graduatingYear.trim() ||
      !Number.isInteger(gradYearNum) ||
      String(gradYearNum) !== graduatingYear.trim() ||
      gradYearNum < 1900 ||
      gradYearNum > 2999
    ) {
      errors.graduatingYear = "Enter a valid four-digit year.";
    }

    if (!branch.trim()) errors.branch = "Branch is required.";
    else if (branch.trim().length > 120) errors.branch = "Must be 120 characters or fewer.";

    if (section.trim().length > 60) errors.section = "Must be 60 characters or fewer.";

    if (expectedHeadcount.trim()) {
      const n = parseInt(expectedHeadcount, 10);
      if (!Number.isInteger(n) || n < 0 || String(n) !== expectedHeadcount.trim()) {
        errors.expectedHeadcount = "Enter a non-negative whole number.";
      }
    }

    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        academicYear: academicYear.trim(),
        graduatingYear: parseInt(graduatingYear, 10),
        branch: branch.trim(),
        section: section.trim(),
        expectedHeadcount: expectedHeadcount.trim() ? parseInt(expectedHeadcount, 10) : null,
      };
      const saved = isEdit
        ? await apiFetch(`/api/tpo/cohorts/${cohort.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/api/tpo/cohorts", { method: "POST", body: JSON.stringify(body) });
      toast.success(isEdit ? "Cohort updated." : "Cohort created.");
      onSaved(saved);
    } catch (err) {
      toast.error(err.message || `Failed to ${isEdit ? "update" : "create"} cohort.`);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--theme-primary,#2dd4bf)]/50";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cohort-form-title"
      >
        <h3 id="cohort-form-title" className="text-lg font-bold text-[var(--foreground)] mb-4">
          {isEdit ? "Edit Cohort" : "Create Cohort"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="cohort-name" className="sr-only">Name</label>
            <input
              id="cohort-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. CSE 2027)"
              className={inputClass}
              disabled={saving}
            />
            {fieldErrors.name && <p className="text-red-400 text-xs mt-1">{fieldErrors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cohort-academic-year" className="sr-only">Academic Year</label>
              <input
                id="cohort-academic-year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="Academic Year (e.g. 2024-2025)"
                className={inputClass}
                disabled={saving}
              />
              {fieldErrors.academicYear && <p className="text-red-400 text-xs mt-1">{fieldErrors.academicYear}</p>}
            </div>
            <div>
              <label htmlFor="cohort-grad-year" className="sr-only">Graduating Year</label>
              <input
                id="cohort-grad-year"
                value={graduatingYear}
                onChange={(e) => setGraduatingYear(e.target.value)}
                placeholder="Graduating Year"
                inputMode="numeric"
                className={inputClass}
                disabled={saving}
              />
              {fieldErrors.graduatingYear && <p className="text-red-400 text-xs mt-1">{fieldErrors.graduatingYear}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="cohort-branch" className="sr-only">Branch</label>
            <input
              id="cohort-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Branch (e.g. Computer Science)"
              className={inputClass}
              disabled={saving}
            />
            {fieldErrors.branch && <p className="text-red-400 text-xs mt-1">{fieldErrors.branch}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cohort-section" className="sr-only">Section (optional)</label>
              <input
                id="cohort-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="Section (optional)"
                className={inputClass}
                disabled={saving}
              />
              {fieldErrors.section && <p className="text-red-400 text-xs mt-1">{fieldErrors.section}</p>}
            </div>
            <div>
              <label htmlFor="cohort-headcount" className="sr-only">Expected Headcount (optional)</label>
              <input
                id="cohort-headcount"
                value={expectedHeadcount}
                onChange={(e) => setExpectedHeadcount(e.target.value)}
                placeholder="Expected Headcount"
                inputMode="numeric"
                className={inputClass}
                disabled={saving}
              />
              {fieldErrors.expectedHeadcount && (
                <p className="text-red-400 text-xs mt-1">{fieldErrors.expectedHeadcount}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={saving} className="flex-1">
              {isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
