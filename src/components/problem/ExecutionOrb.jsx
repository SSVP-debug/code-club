import "./ExecutionOrb.css";

/**
 * Small, accessible animated status indicator for code execution.
 * Kept inside the action button so the controls remain recognizable.
 */
export default function ExecutionOrb({ label }) {
  return (
    <span className="execution-status" role="status" aria-live="polite">
      <span className="execution-orb" aria-hidden="true">
        <span className="execution-orb__core" />
        <span className="execution-orb__ring execution-orb__ring--one" />
        <span className="execution-orb__ring execution-orb__ring--two" />
        <span className="execution-orb__spark execution-orb__spark--one" />
        <span className="execution-orb__spark execution-orb__spark--two" />
      </span>
      <span>{label}</span>
    </span>
  );
}
