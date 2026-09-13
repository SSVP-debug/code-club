import { getJudge0Health } from "../services/judge0Health.js";
import { getJudge0ConfigStatus } from "../config/judge0.js";

/**
 * GET /api/health/compiler
 *
 * Reports both the *runtime* health (request/success/failure counters —
 * see judge0Health.js) and the *configuration* health (is this instance
 * even safely configured for production? — see config/judge0.js). A
 * production deploy pointed at the shared public ce.judge0.com endpoint
 * now fails this health check (503) instead of only logging a warning at
 * startup that's easy to miss — see backend/config/judge0.js for why.
 * This never blocks server startup itself; it only makes the existing
 * "unsafe configuration" condition something a load balancer, uptime
 * monitor, or deploy pipeline can actually alert on.
 */
export function getCompilerHealth(req, res) {
  const configuration = getJudge0ConfigStatus();
  const body = {
    ...getJudge0Health(),
    configuration,
  };

  res.status(configuration.healthy ? 200 : 503).json(body);
}