import { useState } from "react";
import { Upload } from "lucide-react";
import { apiFetch } from "../../services/api";
import Button from "../ui/Button";

const ACCEPTED_EXTENSION = ".csv";

// Matches backend/services/cohortImportService.js's own row-level status
// vocabulary exactly (TPO-2 Step 6) — never inventing a new status name
// on the frontend, per this step's explicit instruction.
const STATUS_STYLES = {
  active: "bg-[var(--theme-primary,#2dd4bf)]/10 text-[var(--theme-primary,#2dd4bf)]",
  invited: "bg-orange-400/10 text-orange-400",
  already_member: "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]",
  duplicate: "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]",
  error: "bg-red-500/10 text-red-400",
};

/**
 * TpoCohortImportModal — "Import CSV" inside cohort roster (TPO-2 Step
 * 7, backed by TPO-2 Step 6's POST /api/tpo/cohorts/:cohortId/import).
 *
 * The frontend never parses the CSV itself — it only client-side checks
 * the file extension as a cheap, non-authoritative first gate (the
 * backend's own content-based sniffing in cohortImportService.js is the
 * real check; this is here purely so a person doesn't wait through a
 * whole upload just to get rejected for picking a .pdf). The file is
 * sent as-is to the backend via multipart/form-data, field name "file"
 * — apiFetch (services/api.js) was extended this step to omit
 * Content-Type for a FormData body so the browser can set its own
 * multipart boundary header correctly.
 *
 * No fake progress bar (explicit instruction — the API gives no
 * progress signal) — just a simple "Importing…" busy state via
 * Button's own `loading` prop, same convention as every other
 * long-running action in this codebase (TpoTeamPanel's invite/remove,
 * TpoCohortFormModal's save).
 */
export default function TpoCohortImportModal({ cohortId, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [result, setResult] = useState(null); // { importBatchId, summary, rows } from the backend

  function handleFileChange(e) {
    const selected = e.target.files?.[0] || null;
    setResult(null);
    setServerError(null);
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith(ACCEPTED_EXTENSION)) {
      setFile(null);
      setFileError("Please choose a .csv file.");
      return;
    }
    setFile(selected);
    setFileError(null);
  }

  async function handleImport() {
    if (!file) return;
    setUploading(true);
    setServerError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiFetch(`/api/tpo/cohorts/${cohortId}/import`, {
        method: "POST",
        body: formData,
      });
      setResult(data);
      onImported?.();
    } catch (err) {
      // err.message already comes from the backend's own clean { error }
      // body (cohortImportService.js never surfaces a raw stack trace or
      // DB error — see that file's own contract) — safe to show as-is,
      // same as every other apiFetch error surfaced via toast elsewhere
      // in this app. A network failure (no response at all) still lands
      // here with fetch's own generic message, which is also safe.
      setServerError(err.message || "Import failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function importAnother() {
    setFile(null);
    setFileError(null);
    setServerError(null);
    setResult(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
      onClick={uploading ? undefined : onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-title"
      >
        <h3 id="csv-import-title" className="text-lg font-bold text-[var(--foreground)] mb-1">
          Import CSV Roster
        </h3>
        <p className="text-xs text-[var(--muted-foreground)] mb-4">
          Upload a CSV with an "email" column. Each row is added to this cohort — no Code Club accounts are
          created; an email with no matching account is added as invited.
        </p>

        {!result ? (
          <>
            <label
              htmlFor="cohort-csv-file"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--border-strong)] rounded-xl px-4 py-8 cursor-pointer hover:border-[var(--theme-primary,#2dd4bf)]/50 transition text-center"
            >
              <Upload size={22} strokeWidth={2} className="text-[var(--muted-foreground)]" aria-hidden="true" />
              <span className="text-sm text-[var(--foreground)] font-medium">
                {file ? file.name : "Choose a CSV file"}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">.csv only</span>
              <input
                id="cohort-csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={uploading}
                className="sr-only"
              />
            </label>
            {fileError && <p className="text-red-400 text-xs mt-2">{fileError}</p>}
            {serverError && <p className="text-red-400 text-xs mt-2">{serverError}</p>}

            <div className="flex gap-2 mt-5">
              <Button variant="secondary" onClick={onClose} disabled={uploading} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleImport} loading={uploading} disabled={uploading || !file} className="flex-1">
                {uploading ? "Importing…" : "Import"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[var(--surface-elevated)] rounded-xl p-4 mb-4">
              <p className="font-semibold text-[var(--foreground)] mb-2">Import complete</p>
              <p className="text-sm text-[var(--muted-foreground)] mb-3">
                {result.summary.totalRows} row{result.summary.totalRows === 1 ? "" : "s"} processed
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-[var(--foreground)]">
                <span>{result.summary.active} active</span>
                <span>{result.summary.invited} invited</span>
                <span>{result.summary.alreadyMember} already members</span>
                <span>{result.summary.duplicates} duplicates</span>
                <span className={result.summary.errors > 0 ? "text-red-400 font-semibold" : ""}>
                  {result.summary.errors} error{result.summary.errors === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {result.rows?.length > 0 && (
              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
                  <span className="w-12">Row</span>
                  <span className="flex-1">Email</span>
                  <span>Result</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border)]">
                  {result.rows.map((r) => (
                    <div key={r.row} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <span className="w-12 text-[var(--muted-foreground)]">{r.row}</span>
                      <span className="flex-1 truncate text-[var(--foreground)]">{r.email || "—"}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                          STATUS_STYLES[r.status] || "bg-[var(--surface-elevated)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        {r.status}
                        {r.reason ? ` · ${r.reason}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <Button variant="secondary" onClick={importAnother} className="flex-1">
                Import Another
              </Button>
              <Button onClick={onClose} className="flex-1">
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
