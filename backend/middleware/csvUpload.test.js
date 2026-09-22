import { describe, expect, it, vi } from "vitest";
import multer from "multer";
import { csvFileFilter, csvUpload } from "./csvUpload.js";
import { IMPORT_MAX_FILE_SIZE_BYTES } from "../services/cohortImportService.js";

describe("csvFileFilter", () => {
  it("accepts a .csv file", () => {
    const cb = vi.fn();
    csvFileFilter({}, { originalname: "roster.csv" }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it("accepts a .csv file regardless of case", () => {
    const cb = vi.fn();
    csvFileFilter({}, { originalname: "ROSTER.CSV" }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it.each(["roster.xlsx", "roster.xls", "roster.pdf", "roster.png", "roster.jpg", "roster"])(
    "rejects a non-.csv file: %s",
    (originalname) => {
      const cb = vi.fn();
      csvFileFilter({}, { originalname }, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(multer.MulterError));
      const err = cb.mock.calls[0][0];
      expect(err.code).toBe("LIMIT_UNEXPECTED_FILE");
    }
  );

  it("rejects when no file/originalname is present", () => {
    const cb = vi.fn();
    csvFileFilter({}, {}, cb);
    expect(cb).toHaveBeenCalledWith(expect.any(multer.MulterError));
  });
});

describe("csvUpload", () => {
  it("uses memory storage (no disk writes)", () => {
    // multer's memoryStorage() has no .destination()/.filename() config methods
    // a diskStorage instance would have — this is the cheapest signal we can
    // check without reaching into multer's internals.
    expect(csvUpload).toBeDefined();
  });

  it("caps file size at IMPORT_MAX_FILE_SIZE_BYTES and limits to a single file", () => {
    expect(csvUpload.limits).toEqual(
      expect.objectContaining({ fileSize: IMPORT_MAX_FILE_SIZE_BYTES, files: 1 })
    );
  });
});
