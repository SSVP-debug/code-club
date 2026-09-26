import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/College.js", () => ({
    default: { find: vi.fn(), countDocuments: vi.fn(), findById: vi.fn() },
}));
vi.mock("../models/User.js", () => ({
    default: { countDocuments: vi.fn(), aggregate: vi.fn() },
}));
vi.mock("../services/tpoRoleSignalService.js", () => ({
    sanitizeRolePatternRules: vi.fn((rules) => rules.map((r) => ({ ...r }))),
}));
vi.mock("../services/adminAuditLog.js", () => ({
    recordAdminAction: vi.fn(),
}));
vi.mock("../config/logger.js", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import College from "../models/College.js";
import User from "../models/User.js";
import { getColleges, updateEmailRolePatterns } from "./collegeController.js";
import { sanitizeRolePatternRules } from "../services/tpoRoleSignalService.js";

function chainableQuery(result) {
    const q = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(result),
    };
    return q;
}

function makeCollege(overrides = {}) {
    return {
        _id: "c1",
        name: "MIT",
        domains: ["mit.edu"],
        website: "https://mit.edu",
        status: "verified",
        createdAt: "2026-01-01",
        ...overrides,
    };
}

describe("collegeController", () => {
    let res;

    beforeEach(() => {
        vi.clearAllMocks();
        res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    });

    describe("getColleges", () => {
        it("returns every college (not just pending) with per-college aggregate stats", async () => {
            const college = makeCollege();
            College.find.mockReturnValueOnce(chainableQuery([college]));
            College.countDocuments.mockResolvedValueOnce(1);
            User.countDocuments
                .mockResolvedValueOnce(25) // studentCount
                .mockResolvedValueOnce(20) // activeStudentCount
                .mockResolvedValueOnce(2); // tpoCount
            User.aggregate.mockResolvedValueOnce([{ _id: null, total: 340 }]);

            await getColleges({ query: {} }, res);

            expect(res.json).toHaveBeenCalledWith({
                colleges: [
                    expect.objectContaining({
                        id: "c1",
                        name: "MIT",
                        domains: ["mit.edu"],
                        status: "verified",
                        studentCount: 25,
                        activeStudentCount: 20,
                        tpoCount: 2,
                        totalSolvedProblems: 340,
                        recruiterCount: null,
                    }),
                ],
                total: 1,
                page: 1,
                limit: 20,
            });
        });

        it("queries students by education.collegeId and TPOs by tpoProfile.collegeDomain — the two distinct linkage mechanisms", async () => {
            const college = makeCollege({ domains: ["mit.edu", "old-mit.edu"] });
            College.find.mockReturnValueOnce(chainableQuery([college]));
            College.countDocuments.mockResolvedValueOnce(1);
            User.countDocuments.mockResolvedValue(0);
            User.aggregate.mockResolvedValueOnce([]);

            await getColleges({ query: {} }, res);

            expect(User.countDocuments).toHaveBeenCalledWith({ "education.collegeId": "c1", role: "student" });
            expect(User.countDocuments).toHaveBeenCalledWith({
                "education.collegeId": "c1",
                role: "student",
                status: "active",
            });
            expect(User.countDocuments).toHaveBeenCalledWith({
                "tpoProfile.collegeDomain": { $in: ["mit.edu", "old-mit.edu"] },
            });
        });

        it("sums totalSolvedProblems via solvedSlugs' live array size, not a possibly-stale profileSignature.solvedCount", async () => {
            const college = makeCollege();
            College.find.mockReturnValueOnce(chainableQuery([college]));
            College.countDocuments.mockResolvedValueOnce(1);
            User.countDocuments.mockResolvedValue(0);
            User.aggregate.mockResolvedValueOnce([{ _id: null, total: 99 }]);

            await getColleges({ query: {} }, res);

            expect(User.aggregate).toHaveBeenCalledWith([
                { $match: { "education.collegeId": "c1", role: "student" } },
                { $group: { _id: null, total: { $sum: { $size: { $ifNull: ["$solvedSlugs", []] } } } } },
            ]);
        });

        it("defaults totalSolvedProblems to 0 when a college has no students (empty aggregate result)", async () => {
            const college = makeCollege();
            College.find.mockReturnValueOnce(chainableQuery([college]));
            College.countDocuments.mockResolvedValueOnce(1);
            User.countDocuments.mockResolvedValue(0);
            User.aggregate.mockResolvedValueOnce([]); // no matching students → empty result

            await getColleges({ query: {} }, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    colleges: [expect.objectContaining({ totalSolvedProblems: 0 })],
                })
            );
        });

        it("never presents recruiterCount as 0 — explicit null + note, since 0 would misleadingly imply zero recruiter activity", async () => {
            const college = makeCollege();
            College.find.mockReturnValueOnce(chainableQuery([college]));
            College.countDocuments.mockResolvedValueOnce(1);
            User.countDocuments.mockResolvedValue(0);
            User.aggregate.mockResolvedValueOnce([]);

            await getColleges({ query: {} }, res);

            const [{ colleges }] = res.json.mock.calls[0];
            expect(colleges[0].recruiterCount).toBeNull();
            expect(typeof colleges[0].recruiterCountNote).toBe("string");
            expect(colleges[0].recruiterCountNote.length).toBeGreaterThan(0);
        });

        it("filters by status", async () => {
            College.find.mockReturnValueOnce(chainableQuery([]));
            College.countDocuments.mockResolvedValueOnce(0);

            await getColleges({ query: { status: "pending" } }, res);

            expect(College.find).toHaveBeenCalledWith({ status: "pending" });
        });

        it("searches by name/domain", async () => {
            College.find.mockReturnValueOnce(chainableQuery([]));
            College.countDocuments.mockResolvedValueOnce(0);

            await getColleges({ query: { search: "MIT" } }, res);

            expect(College.find).toHaveBeenCalledWith({
                $or: [
                    { name: { $regex: "MIT", $options: "i" } },
                    { domains: { $regex: "MIT", $options: "i" } },
                ],
            });
        });

        it("returns 500 if a query fails", async () => {
            College.find.mockImplementationOnce(() => {
                throw new Error("db down");
            });

            await getColleges({ query: {} }, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
describe("updateEmailRolePatterns", () => {
    it("sanitizes and persists staff/student rules separately", async () => {
        const college = {
            _id: "c1",
            name: "MIT",
            domains: ["mit.edu"],
            staffEmailPatterns: [],
            studentEmailPatterns: [],
            save: vi.fn().mockResolvedValue(undefined),
        };
        College.findById.mockResolvedValueOnce(college);
        sanitizeRolePatternRules
            .mockReturnValueOnce([{ type: "domain", value: "staff.mit.edu" }])
            .mockReturnValueOnce([{ type: "domain", value: "students.mit.edu" }]);

        await updateEmailRolePatterns(
            {
                params: { collegeId: "c1" },
                body: {
                    staffEmailPatterns: [{ type: "domain", value: "staff.mit.edu" }],
                    studentEmailPatterns: [{ type: "domain", value: "students.mit.edu" }],
                    },
                userDoc: { _id: "admin1" },
            },
            res
        );

        expect(college.staffEmailPatterns).toEqual([{ type: "domain", value: "staff.mit.edu" }]);
        expect(college.studentEmailPatterns).toEqual([{ type: "domain", value: "students.mit.edu" }]);
        expect(college.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("rejects missing rule arrays", async () => {
        await updateEmailRolePatterns(
            { params: { collegeId: "c1" }, body: { staffEmailPatterns: [] } },
            res
        );
        expect(res.status).toHaveBeenCalledWith(400);
    });
});
