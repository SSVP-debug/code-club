/**
 * seedProblems.js
 *
 * Canonical problem seed entrypoint.
 *
 * Problem content is authored in backend/problems/<slug> and imported into
 * MongoDB by importProblems.js. The canonical folder bank is the only
 * standard problem authoring source.
 *
 * Usage:
 *   cd backend
 *   npm run seed
 */

import "../config/env.js";
import "./importProblems.js";
