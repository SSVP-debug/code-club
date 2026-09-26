import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Button from "../ui/Button";

const EMPTY_RULE = { type: "domain", value: "" };

function normalizeRule(rule) {
  if (rule.type === "local_prefix") {
    return { type: "local_prefix", values: Array.isArray(rule.values) ? rule.values : [] };
  }
  return { type: rule.type || "domain", value: rule.value || "" };
}

export default function CollegeEmailRoleRules({ staffRules, studentRules, onSave }) {
  const [activeRole, setActiveRole] = useState("staff");
  const [rules, setRules] = useState({ staff: [], student: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRules({
      staff: (staffRules || []).map(normalizeRule),
      student: (studentRules || []).map(normalizeRule),
    });
  }, [staffRules, studentRules]);

  const activeRules = rules[activeRole];
  const summary = useMemo(
    () => ({ staff: rules.staff.length, student: rules.student.length }),
    [rules]
  );

  function updateRule(index, patch) {
    setRules((current) => ({
      ...current,
      [activeRole]: current[activeRole].map((rule, i) =>
        i === index ? { ...rule, ...patch } : rule
      ),
    }));
  }

  function updatePrefixValues(index, value) {
    updateRule(index, {
      values: value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
    });
  }

  function addRule() {
    setRules((current) => ({
      ...current,
      [activeRole]: [...current[activeRole], { ...EMPTY_RULE }],
    }));
  }

  function removeRule(index) {
    setRules((current) => ({
      ...current,
      [activeRole]: current[activeRole].filter((_, i) => i !== index),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(rules.staff, rules.student);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--muted-foreground)] leading-relaxed">
        These patterns are advisory evidence. They help Code Club distinguish likely
        staff/TPO mailboxes from student mailboxes, but they never grant TPO access.
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-[var(--surface-elevated)]">
        {[
          ["staff", "Staff / TPO"],
          ["student", "Students"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveRole(id)}
            className={
              "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition " +
              (activeRole === id
                ? "bg-[var(--surface)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)]")
            }
          >
            {label} ({summary[id]})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {activeRules.map((rule, index) => (
          <div key={index} className="rounded-lg border border-[var(--border)] p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={rule.type}
                onChange={(e) => {
                  const type = e.target.value;
                  updateRule(
                    index,
                    type === "local_prefix"
                      ? { type, values: [], value: undefined }
                      : { type, value: "", values: undefined }
                  );
                }}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[var(--foreground)]"
              >
                <option value="domain">Domain</option>
                <option value="local_prefix">Local prefix</option>
                <option value="local_regex">Local regex</option>
              </select>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {rule.type === "domain" ? "Exact email domain" :
                 rule.type === "local_prefix" ? "Before @" : "Before @ regex"}
              </span>
              <button
                type="button"
                onClick={() => removeRule(index)}
                aria-label="Remove rule"
                className="ml-auto p-1 text-[var(--muted-foreground)] hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {rule.type === "local_prefix" ? (
              <input
                value={(rule.values || []).join(", ")}
                onChange={(e) => updatePrefixValues(index, e.target.value)}
                placeholder="student., 22, ug."
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              />
            ) : (
              <input
                value={rule.value || ""}
                onChange={(e) => updateRule(index, { value: e.target.value })}
                placeholder={rule.type === "domain" ? "students.example.edu" : "^(dr\\.|prof)"}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={addRule}>
          <Plus size={13} />
          Add {activeRole === "staff" ? "staff" : "student"} rule
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save patterns"}
        </Button>
      </div>
    </div>
  );
}
