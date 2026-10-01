/**
 * seedProblems.js
 *
 * Canonical problem seed entrypoint.
 *
 * Problem content is authored in backend/problems/<slug> and imported into
 * MongoDB by importProblems.js. This file intentionally contains no import
 * from src/data/problems.js, so the legacy frontend catalog can no longer
 * be the Mongo seed source.
 *
 * Usage:
 *   cd backend
 *   node scripts/seedProblems.js
 */

import "../config/env.js";
import "./importProblems.js";
