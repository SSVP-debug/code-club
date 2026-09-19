import College from "../models/College.js";
import User from "../models/User.js";

/**
 * tpoTeamService.js — TPO institutional identity & team management (Phase 3).
 *
 * Single home for the "which TPO is primary for this college" logic, so
 * routes/tpo.js (self-service team management) and controllers/
 * adminController.js (bulk approval, account deletion) can't drift out of
 * sync on how primary status is read, claimed, or transferred.
 *
 * Source of truth: College.primaryTpo (an ObjectId, or null). There is
 * deliberately no denormalized `isPrimary` flag anywhere on User — every
 * "is this user the primary TPO?" check compares against this one field
 * (isPrimaryTpo below), and every mutation of it goes through the atomic
 * compare-and-swap helpers below. This avoids a whole class of "which copy
 * is stale" bugs a cached flag would introduce, at the cost of one extra
 * College lookup per team-management request — an acceptable trade for a
 * collection this size (see plans doc, "Performance" section: TPO team
 * size is always small, a normal indexed query is enough).
 */

// ── Lookup ───────────────────────────────────────────────────────────────

/**
 * Resolves the College document for a TPO's own account, via their
 * tpoProfile.collegeDomain — the same domain-based lookup every other TPO
 * route in routes/tpo.js already relies on (no separate collegeId FK was
 * introduced on User.tpoProfile; College.findByDomain already exists and
 * this is a low-frequency lookup, not a hot path needing an extra index).
 * Returns null if the TPO has no domain set (shouldn't happen for a
 * verified TPO, but callers must still handle it) or no matching College
 * record exists.
 */
export async function getCollegeForTpo(userDoc) {
  const domain = userDoc?.tpoProfile?.collegeDomain;
  if (!domain) return null;
  return College.findByDomain(domain);
}

/**
 * Resolves which College a /team request should operate against.
 *
 * A TPO always acts on their own institution (getCollegeForTpo — ignores
 * `explicitCollegeId` entirely for a non-admin caller, so a TPO can never
 * widen their own scope by adding a `collegeId` query/body param; this is
 * what keeps cross-college isolation intact even under a hostile request
 * body — see routes/tpo.js's requirePrimaryTeamAction).
 *
 * An admin has no institution of their own, but the TPO-1 permission
 * matrix requires admins be able to view/manage ANY college's team
 * ("Modify another institution — Admin: YES") — so an admin request must
 * name which one via `explicitCollegeId`, the same collegeId-keyed
 * convention adminController.js's approveTpo/rejectTpo already use.
 *
 * Returns `{ college, isAdmin, missingCollegeId }` rather than throwing,
 * so callers can produce the right 400 vs 404 without a try/catch per
 * call site.
 */
export async function resolveTpoTeamContext(userDoc, explicitCollegeId) {
  if (userDoc?.role === "admin") {
    if (!explicitCollegeId) {
      return { college: null, isAdmin: true, missingCollegeId: true };
    }
    const college = await College.findById(explicitCollegeId).catch(() => null);
    return { college, isAdmin: true, missingCollegeId: false };
  }
  const college = await getCollegeForTpo(userDoc);
  return { college, isAdmin: false, missingCollegeId: false };
}

/**
 * The full set of domains a TPO's institution owns, lowercased — for
 * scoping student-roster queries (routes/tpo.js's /students, /dashboard,
 * /report/pdf) so a multi-domain college's TPO sees students who joined
 * via ANY of the college's domains, not just the one literal domain this
 * particular TPO happened to register under. Falls back to the TPO's own
 * single collegeDomain if no College record resolves (shouldn't happen
 * for a verified TPO, but keeps these routes working rather than
 * returning nothing if it does).
 */
export async function resolveCollegeDomains(userDoc) {
  const college = await getCollegeForTpo(userDoc);
  if (college?.domains?.length) {
    return college.domains.map((d) => d.toLowerCase());
  }
  const domain = userDoc?.tpoProfile?.collegeDomain;
  return domain ? [domain.toLowerCase()] : [];
}

/** True if `userId` is the current primary TPO on `college`. */
export function isPrimaryTpo(college, userId) {
  if (!college?.primaryTpo || !userId) return false;
  return college.primaryTpo.toString() === userId.toString();
}

/**
 * Every TPO (verified or still pending) whose tpoProfile.collegeDomain
 * falls under this college's domains — i.e. the full team roster, for the
 * "TPO Team" UI (item 14) to render status/actions per member. Matches the
 * `{ $in: college.domains }` scoping pattern adminController.js's
 * approveTpo/getPendingQueue already use, rather than a single-domain
 * equality check, since a college may legitimately have multiple domains.
 */
export async function listTeam(college) {
  return User.find({
    role: "tpo",
    "tpoProfile.collegeDomain": { $in: college.domains },
  })
    .select("_id displayName email tpoProfile joinedDate")
    .sort({ "tpoProfile.requestedAt": 1 })
    .lean();
}

// ── Primary-authority mutations (atomic, race-safe) ─────────────────────

/**
 * Atomically claims primary status for `userId` on `collegeId`, but only
 * if nobody already holds it — a findOneAndUpdate compare-and-swap on
 * `{ _id: collegeId, primaryTpo: null }`, not a read-then-write. Two
 * concurrent claims (e.g. two TPOs verified in the same admin bulk-approve
 * batch, or two near-simultaneous auto-verified registrations for a brand
 * new domain) can both attempt this; MongoDB guarantees only one
 * findOneAndUpdate matches the `primaryTpo: null` filter and actually
 * writes, so exactly one caller gets `true` back. This is what makes
 * invariant #3 ("a college has at most one primary TPO") hold under
 * concurrency without a multi-document transaction — same "CAS instead of
 * read-then-write" pattern this codebase already uses for the credits
 * balance guard (models/User.js's creditsBalance comment).
 *
 * Returns true if this call is the one that claimed primary, false if
 * someone else already holds it (including if that someone is `userId`
 * itself from an earlier call — this is not idempotent-successful on a
 * second call, by design, since a second true would be a lie about who
 * actually won the race).
 */
export async function claimPrimaryIfNone(collegeId, userId) {
  if (!collegeId || !userId) return false;
  const updated = await College.findOneAndUpdate(
    { _id: collegeId, primaryTpo: null },
    { $set: { primaryTpo: userId } }
  );
  return Boolean(updated);
}

/**
 * Atomically transfers primary status from `fromUserId` to `toUserId`, but
 * only if `fromUserId` is still the primary at the moment this runs — a
 * findOneAndUpdate CAS on `{ _id: collegeId, primaryTpo: fromUserId }`,
 * mirroring claimPrimaryIfNone above. Guards against two overlapping
 * transfer requests (e.g. a double-click, or the primary transferring away
 * while a stale page still shows them as primary) ever both succeeding —
 * the second one's filter no longer matches once the first has already
 * moved `primaryTpo` off `fromUserId`, so it correctly no-ops instead of
 * silently transferring from a state that's no longer current.
 *
 * Returns true on a successful transfer, false if `fromUserId` was not (or
 * no longer) the primary — callers should treat false as a 409 conflict,
 * not retry blindly.
 */
export async function transferPrimary(collegeId, fromUserId, toUserId) {
  if (!collegeId || !fromUserId || !toUserId) return false;
  const updated = await College.findOneAndUpdate(
    { _id: collegeId, primaryTpo: fromUserId },
    { $set: { primaryTpo: toUserId } }
  );
  return Boolean(updated);
}

/**
 * Clears primary status, but only if `userId` is the one currently holding
 * it — same CAS shape as the others. Used when the primary TPO's
 * authority is being revoked entirely (team removal, admin account
 * deletion) rather than handed to someone else: see routes/tpo.js's
 * DELETE /team/:tpoId (which refuses this for the primary and requires a
 * transfer first — see that handler's comment) and
 * adminController.js's deleteUser (which has no "transfer first" option
 * available, since the account is being deleted outright, so it clears
 * rather than leaving a dangling reference to a deleted user).
 */
export async function clearPrimaryIfCurrent(collegeId, userId) {
  if (!collegeId || !userId) return false;
  const updated = await College.findOneAndUpdate(
    { _id: collegeId, primaryTpo: userId },
    { $set: { primaryTpo: null } }
  );
  return Boolean(updated);
}
