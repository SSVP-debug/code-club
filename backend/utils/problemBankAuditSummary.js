export function summarizeProblemBankWarnings(findings) {
  const counts = new Map();

  for (const finding of Array.isArray(findings) ? findings : []) {
    if (!finding || finding.level !== "WARN" || typeof finding.check !== "string") continue;
    counts.set(finding.check, (counts.get(finding.check) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([check, count]) => ({ check, count }))
    .sort((a, b) => b.count - a.count || a.check.localeCompare(b.check));
}
