import { invalidateCachePrefix } from "../utils/cache.js";
import College from "../models/College.js";

const TPO_CACHE_PREFIX = "tpo:";

/**
 * Invalidate a college's cached TPO views.
 * Called whenever a student's XP, solved count, or streak changes.
 *
 * `domain` is the CHANGED STUDENT's own single emailDomain — but
 * routes/tpo.js's /students and /dashboard cache their results per the
 * *TPO's own* literal collegeDomain (which, for a multi-domain college,
 * can be a different domain string than the student's). Resolving the
 * College and looping every domain it owns (TPO-1 closure fix) means a
 * student joining via domain B still invalidates the cache entry a TPO
 * registered under domain A is reading — without that, a multi-domain
 * college's dashboard could serve stale student counts indefinitely,
 * since nothing else would ever invalidate that particular cache key.
 * Falls back to invalidating just `domain` itself if no College record
 * resolves, so this never does less than the old single-domain behavior.
 */
export async function invalidateTpoCache(domain) {
  if (!domain) return;

  const college = await College.findByDomain(domain).catch(() => null);
  const domains = college?.domains?.length ? college.domains : [domain];

  await Promise.all(
    domains.flatMap((d) => [
      invalidateCachePrefix(`${TPO_CACHE_PREFIX}students:${d}`),
      invalidateCachePrefix(`${TPO_CACHE_PREFIX}dashboard:${d}`),
    ])
  );
}