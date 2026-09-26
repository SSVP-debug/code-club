import { logger } from "../config/logger.js";

/**
 * Advisory classification for an institutional email.
 *
 * IMPORTANT: these rules are per-college configuration and are never an
 * authorization decision. The result only helps the reviewer understand why
 * a request was routed the way it was.
 *
 * Supported rule shapes:
 *   { type: "domain", value: "staff.example.edu" }
 *   { type: "local_prefix", values: ["faculty", "staff"] }
 *   { type: "local_regex", value: "^(dr\\.|prof)" }
 *
 * Rules are intentionally constrained instead of accepting arbitrary regex
 * strings for every purpose. The local_regex path is bounded and only applied
 * to the local-part before the @.
 */
const MAX_RULES = 20;
const MAX_REGEX_LENGTH = 120;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function splitEmail(email) {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    return { email: normalized, local: "", domain: "" };
  }
  return {
    email: normalized,
    local: normalized.slice(0, at),
    domain: normalized.slice(at + 1),
  };
}

function matchesRule(local, domain, rule) {
  if (!rule || typeof rule !== "object") return false;
  const type = String(rule.type || "").toLowerCase().trim();

  if (type === "domain") {
    return domain === String(rule.value || "").toLowerCase().trim();
  }

  if (type === "local_prefix") {
    const values = Array.isArray(rule.values) ? rule.values : [];
    return values
      .slice(0, MAX_RULES)
      .some((value) => local.startsWith(String(value || "").toLowerCase().trim()));
  }

  if (type === "local_regex") {
    const pattern = String(rule.value || "");
    if (!pattern || pattern.length > MAX_REGEX_LENGTH) return false;
    try {
      return new RegExp(pattern, "i").test(local);
    } catch (err) {
      logger.warn({ err }, "[TpoRoleSignal] invalid local regex skipped");
      return false;
    }
  }

  return false;
}

function anyRuleMatches(local, domain, rules) {
  return (Array.isArray(rules) ? rules : [])
    .slice(0, MAX_RULES)
    .some((rule) => matchesRule(local, domain, rule));
}

export function classifyInstitutionalEmailRole(email, college = {}) {
  const { email: normalizedEmail, local, domain } = splitEmail(email);
  if (!domain) return "unknown";

  const staffMatch = anyRuleMatches(local, domain, college.staffEmailPatterns);
  const studentMatch = anyRuleMatches(local, domain, college.studentEmailPatterns);

  if (staffMatch && !studentMatch) return "staff_candidate";
  if (studentMatch && !staffMatch) return "student_candidate";
  if (staffMatch && studentMatch) return "ambiguous";
  return "unknown";
}

export function buildTpoVerificationSignal(email, college) {
  const classification = classifyInstitutionalEmailRole(email, college);

  return {
    type: "EMAIL_PATTERN",
    result: classification,
    capturedAt: new Date(),
  };
}

export function isValidRolePatternRule(rule) {
  if (!rule || typeof rule !== "object") return false;
  const type = String(rule.type || "").toLowerCase().trim();

  if (type === "domain") {
    return (
      typeof rule.value === "string" &&
      /^[a-z0-9.-]+$/.test(rule.value.toLowerCase().trim()) &&
      rule.value.length <= 253
    );
  }

  if (type === "local_prefix") {
    return (
      Array.isArray(rule.values) &&
      rule.values.length > 0 &&
      rule.values.length <= MAX_RULES &&
      rule.values.every(
        (value) =>
          typeof value === "string" &&
          value.trim().length > 0 &&
          value.trim().length <= 60
      )
    );
  }

  if (type === "local_regex") {
    if (typeof rule.value !== "string" || rule.value.length === 0 || rule.value.length > MAX_REGEX_LENGTH) {
      return false;
    }
    try {
      // Compile during validation so malformed expressions never become
      // active configuration.
      new RegExp(rule.value, "i");
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function sanitizeRolePatternRules(rules) {
  if (!Array.isArray(rules)) return [];

  const sanitized = [];

  for (const rule of rules.slice(0, MAX_RULES)) {
    if (!isValidRolePatternRule(rule)) continue;

    const type = String(rule.type || "").toLowerCase().trim();

    if (type === "domain") {
      sanitized.push({
        type,
        value: rule.value.toLowerCase().trim(),
      });
      continue;
    }

    if (type === "local_prefix") {
      // Empty prefix entries are harmless configuration noise and should be
      // removed during sanitization rather than invalidating the entire rule.
      // Validation stays strict for callers that validate an unsanitized rule.
      const values = rule.values
        .filter((value) => typeof value === "string")
        .map((value) => value.toLowerCase().trim())
        .filter(Boolean)
        .slice(0, MAX_RULES);

      if (values.length === 0) continue;

      sanitized.push({ type, values });
      continue;
    }

    if (type === "local_regex") {
      sanitized.push({
        type,
        value: rule.value,
      });
    }
  }

  return sanitized;
}
