# TPO Visibility vs. `isProfilePublic` — Policy Decision Needed

**Status: recommendation only. No code has been changed for this. Wait for
explicit approval before implementing.**

## Current behavior (as-is, verified against `backend/routes/tpo.js`)

- A TPO account has a verified `collegeDomain` on their own profile
  (established at TPO signup/verification — out of scope for this doc).
- `GET /tpo/students` and `GET /tpo/dashboard` query
  `{ emailDomain: tpoDomain, role: "student" }` — scoped correctly by
  college, with no path found where a TPO could reach a different
  college's students.
- This query has **no filter on `isProfilePublic`**. A student who has
  set their profile to private (invisible to public visitors and to
  recruiter search) is still fully visible to their own college's TPO:
  name, email, `totalXP`, solved count, `currentStreak`,
  `solvedDifficulty`, `topicStats`, `joinedDate`.
- By contrast, `backend/routes/recruiter.js`'s search explicitly requires
  `isProfilePublic: true` — a private student never appears there, and no
  raw email/contact info is ever returned even for a public profile.

So today: **`isProfilePublic = false` means "private from the public and
from recruiters," but does *not* mean "private from my own TPO."** This
was never a deliberate policy decision in the code — it's just the
behavior that falls out of the TPO query never having had a privacy
filter added, one way or the other.

## Why this needs a decision, not just a fix

Both readings are legitimate products to build:

**Reading A — TPO sees all students in their college regardless of
`isProfilePublic`.** A Training & Placement Officer is not "the public" —
they're an institutional role responsible for placement outcomes for
every student at that college, similar to how a school counselor sees
every student's grades regardless of whether that student would want a
stranger to see them. Under this reading, current behavior is *already
correct* and the only gap is that it's undocumented — a student reading
"private profile" language elsewhere in the product might reasonably
assume it means private from everyone, including their TPO, which it
doesn't.

**Reading B — `isProfilePublic = false` should also hide a student from
their TPO.** A student may want to opt out of institutional placement
tracking entirely (e.g. they're not using Code Club for placement
purposes, or they don't want their college aware of their coding
activity/lack thereof) while still using the platform to practice. Under
this reading, current behavior is a real privacy gap: the one toggle a
student has for "who can see my coding activity" doesn't actually cover
one of the two institutional audiences that can see it.

## Privacy implications of each

- **Reading A** is simpler (no new field, no new UI) but means a student's
  only way to become invisible to their TPO is to never verify their
  college email in the first place — there's no partial opt-out once
  they're enrolled as a student at that college.
- **Reading B** gives students real control, but raises a secondary
  question TPOs would likely push back on: if a TPO is responsible for
  placement outcomes across their college and a meaningful fraction of
  students can opt out of being visible to them, does the TPO dashboard
  (aggregate stats, leaderboards, placement-readiness views) become
  misleading or incomplete without students realizing their opt-out has
  that side effect? This would need its own UX treatment (e.g., "X
  students at your college have opted out of TPO visibility" shown
  honestly on the TPO dashboard, not silently undercounted).

## Recommendation

Lean toward **Reading A as the documented default, with an explicit,
separate opt-out** — i.e., don't reuse `isProfilePublic` for this at all
(reusing it would silently couple two different audiences to one toggle,
which is exactly the kind of implicit coupling this audit is trying to
remove elsewhere). Concretely:

1. Document Reading A as the current, intended policy for
   `isProfilePublic` (it only ever governed public/recruiter visibility).
2. If Code Club wants to give students a TPO-specific opt-out, add it as
   a **new, separate field** (e.g. `visibleToTpo`, default `true`) rather
   than overloading `isProfilePublic` — this keeps "who can see me"
   legible as N independent decisions instead of one flag doing double
   duty, and doesn't retroactively change the meaning of a toggle
   students have already set.
3. Either way, add a short, explicit sentence to wherever `isProfilePublic`
   is explained in the product UI (profile settings) clarifying that it
   does not affect what your college's TPO can see — closing the
   documentation gap regardless of which policy direction is chosen.

This is a product/institutional-policy call, not an engineering one — the
engineering cost of either direction is small. Flagging it here rather
than picking for you because it changes what a real TPO account owner
would reasonably expect Code Club to have promised their students.

## If Reading B (new opt-out) is approved — scope of work

**Required database fields**
- `User.visibleToTpo: { type: Boolean, default: true }` (new, independent
  field — do not repurpose `isProfilePublic`).

**Required backend changes**
- `backend/routes/tpo.js`: add `visibleToTpo: true` (or `{ $ne: false }`,
  to treat existing users as opted-in by default without a backfill) to
  the `/students` and `/dashboard` query filters.
- Decide and implement the "N students opted out" honesty treatment on
  the TPO dashboard aggregate numbers, so opting out doesn't silently
  produce misleading placement-readiness stats for the TPO.
- A student-facing settings endpoint to toggle `visibleToTpo` (new, or
  extend the existing profile-settings endpoint if one already handles
  `isProfilePublic`).

**Required frontend changes**
- A distinct toggle in profile/privacy settings, clearly labeled and
  described separately from the public/recruiter-visibility toggle (e.g.
  "Visible to my college's placement officer" vs. "Public profile /
  visible to recruiters") — bundling them into one control would recreate
  the exact ambiguity this doc exists to resolve.
- Update any in-app copy that currently implies "private profile" means
  private from everyone.

**Required tests**
- TPO `/students` and `/dashboard` correctly exclude a student with
  `visibleToTpo: false`, while still correctly including a student with
  `isProfilePublic: false` but `visibleToTpo: true` (proving the two
  fields are independent, not accidentally coupled).
- A default (`visibleToTpo` unset / pre-migration) user is still visible
  to TPO — no silent mass opt-out from a schema change.
- Recruiter visibility is unaffected by `visibleToTpo` in either
  direction (proving no accidental cross-wiring between the two
  audiences).
- TPO dashboard aggregate counts correctly reflect (or explicitly
  disclose) excluded students rather than silently undercounting.

Awaiting your decision before touching any of the above.
