const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export function parseJsonContent(content) {
  try {
    return { parsed: JSON.parse(content), error: null };
  } catch (error) {
    return { parsed: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function inspectContent(name, content) {
  const trimmed = content.trim();
  const isJson = name.endsWith(".json");
  const { parsed, error } = isJson
    ? (trimmed ? parseJsonContent(content) : { parsed: null, error: null })
    : { parsed: null, error: null };
  const todoCount = (content.match(/\b(?:TODO|TBD)\b/gi) || []).length;
  const empty = trimmed.length === 0 || (Array.isArray(parsed) && parsed.length === 0);

  return {
    name,
    exists: true,
    empty,
    todoCount,
    bytes: Buffer.byteLength(content, "utf8"),
    ...(isJson ? { jsonValid: error === null, jsonError: error } : {}),
  };
}

export function validateExamples(parsed) {
  const errors = [];
  if (!Array.isArray(parsed)) return ["examples.json must contain a JSON array"];
  if (parsed.length === 0) return ["examples.json must contain at least one example"];

  parsed.forEach((example, index) => {
    const prefix = `examples.json example ${index + 1}`;
    if (!example || typeof example !== "object" || Array.isArray(example)) {
      errors.push(`${prefix} must be an object`);
      return;
    }
    for (const field of ["input", "output"]) {
      if (!hasOwn(example, field) || typeof example[field] !== "string" || !example[field].trim()) {
        errors.push(`${prefix} must include a non-empty string ${field}`);
      }
    }
    if (hasOwn(example, "explanation") && typeof example.explanation !== "string") {
      errors.push(`${prefix} explanation must be a string when provided`);
    }
  });

  return errors;
}

export function validateConstraints(parsed) {
  if (!Array.isArray(parsed)) return ["constraints.json must contain a JSON array"];
  if (parsed.length === 0) return ["constraints.json must contain at least one constraint"];
  const errors = [];
  parsed.forEach((constraint, index) => {
    if (typeof constraint !== "string" || !constraint.trim()) {
      errors.push(`constraints.json constraint ${index + 1} must be a non-empty string`);
    }
  });
  return errors;
}
