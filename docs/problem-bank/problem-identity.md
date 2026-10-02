# Problem Identity Contract — Phase P1

## Purpose

Every Code Club problem needs an identity that survives title and slug changes and can later support duplicate detection, variants, migrations, and catalog tooling.

## Fields

| Field | Meaning | Mutability |
| --- | --- | --- |
| `problemKey` | Immutable internal identity for one problem record. UUID v4. | Immutable |
| `familyKey` | Stable family identifier grouping variants of the same underlying problem family. | Controlled metadata |
| `variantOf` | Optional `problemKey` of the canonical parent problem. Never a slug. | Controlled metadata |
| `identityFingerprint` | Deterministic SHA-256 fingerprint of the canonical problem objective + execution contract. | Recomputed from canonical content |

## Fingerprint rules

The fingerprint uses:

- normalized problem description;
- return-type contract;
- parameter-type contract;
- comparison mode;
- operation-sequence enabled/result mode.

It intentionally excludes presentation and catalog metadata such as title, slug, topic, companies, hints, editorial, starter code, and examples.

Text normalization lowercases, removes control characters, collapses whitespace, and trims. Object keys are sorted recursively before hashing, so equivalent object ordering produces the same fingerprint.

The fingerprint is a deterministic identity signal, **not** a fuzzy duplicate detector. Exact fingerprint collisions become P2 CI failures; probable semantic duplicates remain a P2 review concern.

## Legacy rollout

The P1 schema accepts legacy folders without identity metadata so the existing 250-problem bank is not broken mid-rollout. Run:

```bash
npm run problems:identity:backfill:dry-run
npm run problems:identity:backfill
npm run validate:problem-identity
```

The backfill is idempotent. Existing `problemKey` values are preserved. Problems without explicit family/variant metadata start as their own family (`familyKey === problemKey`, `variantOf === null`). P2 is responsible for identifying and resolving real cross-problem families/variants; P1 does not guess them.

## Backward compatibility

`slug` remains the public/catalog identifier for existing APIs and references. P1 does not repurpose or remove it. `problemKey` is the internal identity that future migrations should use when a relationship must survive a slug rename.
