import multer from "multer";
import { IMPORT_MAX_FILE_SIZE_BYTES } from "../services/cohortImportService.js";

/**
 * csvUpload.js — multer configuration for TPO-2 Step 6's CSV roster
 * import route.
 *
 * memoryStorage, not diskStorage: the file never needs to touch disk —
 * cohortImportService.js reads it straight out of `req.file.buffer` —
 * and IMPORT_MAX_FILE_SIZE_BYTES already bounds this to a small,
 * fully-buffered upload (see that file's own comment). No new upload
 * infrastructure/pattern was already present in this repo to reuse
 * (Section 1's audit); this is the first multipart/file-upload route.
 *
 * fileFilter here is the EXTENSION half of Section 3's "do not trust
 * only the filename extension" file-type check — it's a cheap first
 * gate, not the whole check. The content-based half
 * (detectDisallowedBinarySignature) runs in cohortImportService.js
 * against the actual buffer, after upload, since that's real content a
 * filename alone can't fake.
 */
const ALLOWED_EXTENSIONS = [".csv"];

export function csvFileFilter(req, file, cb) {
  const name = typeof file?.originalname === "string" ? file.originalname.toLowerCase() : "";
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!hasAllowedExtension) {
    const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file");
    err.message = "Only .csv files are accepted.";
    return cb(err);
  }
  return cb(null, true);
}

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: IMPORT_MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: csvFileFilter,
});
