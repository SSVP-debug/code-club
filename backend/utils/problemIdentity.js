import { createHash, randomUUID } from "node:crypto";

const WHITESPACE_RE = /\s+/g;
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;

function normalizeText(value) {
  return String(value ?? "")
    .replace(CONTROL_RE, " ")
    .replace(WHITESPACE_RE, " ")
    .trim()
    .toLowerCase();
}

function stableNormalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return normalizeText(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableNormalize);

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableNormalize(value[key])])
  );
}

function getMapObject(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return value;
}

/**
 * Builds the stable, semantic identity material for a problem.
 *
 * Deliberately excludes presentation/catalog metadata (title, slug, topic,
 * companies, hints, editorial, starter code and examples). Those fields can
 * change without changing what problem is being authored.
 *
 * The description plus execution contract is intentionally deterministic but
 * not a fuzzy duplicate detector. P2 owns probable-duplicate detection.
 */
export function buildProblemIdentityPayload(problem) {
  const operationSequence = problem.operationSequence || {};
  return stableNormalize({
    description: problem.description,
    functionContract: {
      returnType: getMapObject(problem.returnType),
      paramTypes: getMapObject(problem.paramTypes),
      comparisonMode: problem.comparisonMode || "exact",
      operationSequence: {
        enabled: Boolean(operationSequence.enabled),
        resultMode: operationSequence.resultMode || "all",
      },
    },
  });
}

export function computeProblemIdentityFingerprint(problem) {
  const canonical = JSON.stringify(buildProblemIdentityPayload(problem));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function generateProblemKey() {
  return randomUUID();
}

export function defaultFamilyKey(problemKey) {
  return problemKey;
}

export function validateProblemIdentity({ problemKey, familyKey, variantOf, identityFingerprint }) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const fingerprintPattern = /^[a-f0-9]{64}$/;

  if (!uuidPattern.test(problemKey)) throw new Error("problemKey must be a UUID");
  if (!uuidPattern.test(familyKey)) throw new Error("familyKey must be a UUID");
  if (variantOf !== null && variantOf !== undefined && !uuidPattern.test(variantOf)) {
    throw new Error("variantOf must be null or a UUID");
  }
  if (variantOf === problemKey) throw new Error("variantOf cannot reference the same problemKey");
  if (!fingerprintPattern.test(identityFingerprint)) {
    throw new Error("identityFingerprint must be a SHA-256 hex digest");
  }
  return true;
}
