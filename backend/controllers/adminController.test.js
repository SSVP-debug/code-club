import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/TpoVerificationReview.js", () => ({
    default: { create: vi.fn().mockResolvedValue({}) },
}));
vi.mock("../models/College.js", () => ({
    default: {
        find: vi.fn(),
        findById: vi.fn(),
        findByDomain: vi.fn(),
        deleteOne: vi.fn(),
        countDocuments: vi.fn(),
    },
}));
vi.mock("../models/User.js", () => ({
    default: {
        find: vi.fn(),
        findById: vi.fn(),
        updateMany: vi.fn(),
        countDocuments: vi.fn(),
        deleteOne: vi.fn(),
    },
}));
vi.mock("../services/tpoTeamService.js", () => ({
    claimPrimaryIfNone: vi.fn(),
    clearPrimaryIfCurrent: vi.fn(),
}));
vi.mock("../models/ImpersonationLog.js", () => ({
    default: { updateOne: vi.fn(), create: vi.fn() },
}));
vi.mock("../models/AdminAuditLog.js", () => ({
    default: { find: vi.fn(), countDocuments: vi.fn(), create: vi.fn() },
}));
vi.mock("../models/Submission.js", () => ({
    default: { deleteMany: vi.fn(), countDocuments: vi.fn() },
}));
vi.mock("../models/Notification.js", () => ({
    default: { deleteMany: vi.fn() },
}));
vi.mock("../models/Problem.js", () => ({
    default: { countDocuments: vi.fn() },
}));
vi.mock("../services/notificationService.js", () => ({
    createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/adminAuditLog.js", () => ({
    recordAdminAction: vi.fn(),
}));
vi.mock("../utils/userAuthCache.js", () => ({
    invalidateCachedUserByFirebaseUid: vi.fn(),
}));
vi.mock("../config/logger.js", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import TpoVerificationReview from "../models/TpoVerificationReview.js";
import College from "../models/College.js";
import User from "../models/User.js";
import ImpersonationLog from "../models/ImpersonationLog.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import Submission from "../models/Submission.js";
import Notification from "../models/Notification.js";
import Problem from "../models/Problem.js";
import { createNotification } from "../services/notificationService.js";
import { recordAdminAction } from "../services/adminAuditLog.js";
import { invalidateCachedUserByFirebaseUid } from "../utils/userAuthCache.js";
import { claimPrimaryIfNone, clearPrimaryIfCurrent } from "../services/tpoTeamService.js";
import {
    getPendingQueue,
    approveRecruiter,
    rejectRecruiter,
    approveTpo,
    rejectTpo,
    approveTpoUser,
    rejectTpoUser,
    approveStudentCollege,
    rejectStudentCollege,
    listUsers,
    getAuditLogs,
    getDashboardMetrics,
    suspendUser,
    activateUser,
    deleteUser,
    resetUserProgress,
    changeUserRole,
    startImpersonation,
    stopImpersonation,
} from "./adminController.js";

function mockRes() {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
}

// Minimal stand-in for a chainable Mongoose query (.sort().populate() etc.
// all return the same object; .lean() is the async terminal call).
function chainableQuery(result) {
    const q = {
        sort: vi.fn(() => q),
        populate: vi.fn(() => q),
        select: vi.fn(() => q),
        skip: vi.fn(() => q),
        limit: vi.fn(() => q),
        lean: vi.fn().mockResolvedValue(result),
    };
    return q;
}

function makeUser(overrides = {}) {
    return {
        _id: "u1",
        firebaseUid: "fb-1",
        email: "u1@b.com",
        role: "recruiter",
        roles: ["student", "recruiter"],
        recruiterProfile: { companyName: "Acme", verified: false, verifiedAt: null },
        save: vi.fn().mockResolvedValue(true),
        // Real behavior, not a bare vi.fn() stub — rejectRecruiter/rejectTpo
        // (adminController.js) call this and then assert on `role`/`roles`
        // afterward, same as the real User.js instance method (see
        // models/User.js). Mirrors it here rather than mocking it away so
        // these tests still catch a regression in the revoke call itself.
        revokeRole: vi.fn(function revokeRole(roleName) {
            if (roleName === "student") return;
            this.roles = (this.roles || []).filter((r) => r !== roleName);
            if (this.roles.length === 0) this.roles = ["student"];
        }),
        ...overrides,
    };
}

// The acting admin identity every mutating admin route reads via
// req.actingAdminDoc || req.userDoc (see startImpersonation/stopImpersonation,
// now also recordAdminAction call sites added by plan 002).
function makeAdmin(overrides = {}) {
    return makeUser({ _id: "admin1", role: "admin", email: "admin@codeclub.dev", ...overrides });
}

describe("adminController", () => {
    let res;

    beforeEach(() => {
        vi.clearAllMocks();
        res = mockRes();
    });

    describe("getPendingQueue", () => {
        it("returns pending recruiters, split into TPO and student college requests by submittedByRole", async () => {
            User.find.mockReturnValueOnce(
                chainableQuery([
                    { _id: "r1", email: "r@b.com", displayName: "R", recruiterProfile: { companyName: "Acme" }, createdAt: "t1" },
                ])
            );
            College.find.mockReturnValueOnce(
                chainableQuery([
                    {
                        _id: "c1", name: "MIT", domains: ["mit.edu"],
                        submittedBy: { email: "a@b.com", displayName: "A" },
                        submittedByRole: "tpo",
                        createdAt: "t2",
                    },
                    {
                        _id: "c2", name: "XYZ Institute", domains: ["xyz.ac.in"], website: "https://xyz.ac.in",
                        submittedBy: { email: "s@b.com", displayName: "S" },
                        submittedByRole: "student",
                        createdAt: "t3",
                    },
                ])
            );
            User.find.mockReturnValueOnce(chainableQuery([]));

            const req = {};
            await getPendingQueue(req, res);

            expect(College.find).toHaveBeenCalledWith({ status: "pending" });
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    recruiters: [expect.objectContaining({ id: "r1", companyName: "Acme" })],
                    tpos: [expect.objectContaining({ collegeId: "c1", collegeName: "MIT", domain: "mit.edu" })],
                    studentCollegeRequests: [
                        expect.objectContaining({ collegeId: "c2", collegeName: "XYZ Institute", domains: ["xyz.ac.in"] }),
                    ],
                })
            );
        });

        it("returns 500 if the query fails", async () => {
            User.find.mockImplementationOnce(() => {
                throw new Error("db down");
            });

            await getPendingQueue({}, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("approveRecruiter", () => {
        it("verifies the recruiter, invalidates their auth cache, notifies them, and audit-logs it", async () => {
            const user = makeUser();
            const admin = makeAdmin();
            User.findById.mockResolvedValueOnce(user);

            await approveRecruiter({ params: { id: "u1" }, userDoc: admin, actingAdminDoc: null }, res);

            expect(user.recruiterProfile.verified).toBe(true);
            expect(user.save).toHaveBeenCalledOnce();
            expect(invalidateCachedUserByFirebaseUid).toHaveBeenCalledWith("fb-1");
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({ adminDoc: admin, action: "recruiter.approve", targetType: "User", targetId: "u1" })
            );
            expect(createNotification).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "u1", type: "recruiter_verified" })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("404s when the target isn't a recruiter", async () => {
            User.findById.mockResolvedValueOnce(makeUser({ role: "student" }));

            await approveRecruiter({ params: { id: "u1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe("rejectRecruiter", () => {
        it("demotes the user back to student, invalidates their auth cache, and audit-logs it", async () => {
            const user = makeUser({ roles: ["student", "recruiter"] });
            const admin = makeAdmin();
            User.findById.mockResolvedValueOnce(user);

            await rejectRecruiter({ params: { id: "u1" }, userDoc: admin, actingAdminDoc: null }, res);

            expect(user.role).toBe("student");
            expect(user.roles).toEqual(["student"]);
            expect(user.recruiterProfile.verified).toBe(false);
            expect(invalidateCachedUserByFirebaseUid).toHaveBeenCalledWith("fb-1");
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({ adminDoc: admin, action: "recruiter.reject", targetType: "User", targetId: "u1" })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });
    });

    describe("approveTpo", () => {
        it("verifies the college without bulk-authorizing individual TPOs", async () => {
            const college = {
                _id: "c1",
                domains: ["mit.edu"],
                name: "MIT",
                submittedBy: "admin-user-1",
                status: "pending",
                save: vi.fn().mockResolvedValue(true),
            };
            const admin = makeAdmin();
            College.findById.mockResolvedValueOnce(college);

            await approveTpo({ params: { collegeId: "c1" }, userDoc: admin, actingAdminDoc: null }, res);

            expect(college.status).toBe("verified");
            expect(User.updateMany).not.toHaveBeenCalled();
            expect(User.find).not.toHaveBeenCalled();
            expect(claimPrimaryIfNone).not.toHaveBeenCalled();
            expect(TpoVerificationReview.create).not.toHaveBeenCalled();
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    adminDoc: admin,
                    action: "tpo.approve",
                    targetType: "College",
                    targetId: "c1",
                })
            );
            expect(createNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: "admin-user-1",
                    type: "college_verified",
                })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("404s when the college request doesn't exist", async () => {
            College.findById.mockResolvedValueOnce(null);

            await approveTpo({ params: { collegeId: "missing" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("does not authorize or claim primary for pending TPOs when a college is approved", async () => {
            const college = {
                _id: "c1",
                domains: ["mit.edu"],
                name: "MIT",
                submittedBy: "u1",
                status: "pending",
                save: vi.fn().mockResolvedValue(true),
            };
            College.findById.mockResolvedValueOnce(college);

            await approveTpo({ params: { collegeId: "c1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(User.updateMany).not.toHaveBeenCalled();
            expect(claimPrimaryIfNone).not.toHaveBeenCalled();
            expect(invalidateCachedUserByFirebaseUid).not.toHaveBeenCalled();
        });

        it("keeps the college approval successful even though notification delivery is asynchronous", async () => {
            const college = {
                _id: "c1",
                domains: ["mit.edu"],
                name: "MIT",
                submittedBy: "u1",
                status: "pending",
                save: vi.fn().mockResolvedValue(true),
            };
            College.findById.mockResolvedValueOnce(college);
            createNotification.mockImplementationOnce(() => Promise.reject(new Error("notification failed")));

            await approveTpo({ params: { collegeId: "c1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(college.status).toBe("verified");
            expect(res.status).not.toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });
    });

    describe("rejectTpo", () => {
        it("deletes the college, demotes the requester if still a TPO, and audit-logs it", async () => {
            const college = { _id: "c1", name: "MIT", submittedBy: "req1" };
            const requester = makeUser({ _id: "req1", role: "tpo", roles: ["student", "tpo"], firebaseUid: "fb-req1" });
            const admin = makeAdmin();

            College.findById.mockResolvedValueOnce(college);
            User.findById.mockResolvedValueOnce(requester);

            await rejectTpo({ params: { collegeId: "c1" }, userDoc: admin, actingAdminDoc: null }, res);

            expect(College.deleteOne).toHaveBeenCalledWith({ _id: "c1" });
            expect(requester.role).toBe("student");
            expect(requester.roles).toEqual(["student"]);
            expect(invalidateCachedUserByFirebaseUid).toHaveBeenCalledWith("fb-req1");
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({ adminDoc: admin, action: "tpo.reject", targetType: "College", targetId: "c1" })
            );
            expect(TpoVerificationReview.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: "req1",
                    collegeId: "c1",
                    decision: "rejected",
                    reviewedBy: "admin1",
                })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("does not demote a requester who is no longer a TPO", async () => {
            const college = { _id: "c1", name: "MIT", submittedBy: "req1" };
            const requester = makeUser({ _id: "req1", role: "student", roles: ["student"], firebaseUid: "fb-req1" });
            College.findById.mockResolvedValueOnce(college);
            User.findById.mockResolvedValueOnce(requester);

            await rejectTpo({ params: { collegeId: "c1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(College.deleteOne).toHaveBeenCalledWith({ _id: "c1" });
            expect(requester.save).not.toHaveBeenCalled();
            expect(invalidateCachedUserByFirebaseUid).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });
    });

    describe("approveStudentCollege", () => {
        it("verifies the college and pushes collegeStatus to every linked, email-verified user", async () => {
            const college = {
                _id: "c2",
                domains: ["xyz.ac.in"],
                name: "XYZ Institute",
                status: "pending",
                save: vi.fn().mockResolvedValue(true),
            };
            const linkedUser = makeUser({
                _id: "stu1",
                role: "student",
                firebaseUid: "fb-stu1",
                education: { collegeId: "c2", emailVerified: true, collegeStatus: "pending" },
            });
            College.findById.mockResolvedValueOnce(college);
            User.find.mockResolvedValueOnce([linkedUser]);

            const admin = makeAdmin();
            await approveStudentCollege({ params: { collegeId: "c2" }, userDoc: admin, actingAdminDoc: null }, res);

            expect(college.status).toBe("verified");
            expect(User.find).toHaveBeenCalledWith({
                "education.collegeId": "c2",
                "education.emailVerified": true,
            });
            expect(linkedUser.education.collegeStatus).toBe("verified");
            expect(linkedUser.save).toHaveBeenCalledOnce();
            expect(invalidateCachedUserByFirebaseUid).toHaveBeenCalledWith("fb-stu1");
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({ adminDoc: admin, action: "studentCollege.approve", targetType: "College", targetId: "c2" })
            );
            expect(createNotification).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "stu1", type: "college_verified" })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("404s when the college request doesn't exist", async () => {
            College.findById.mockResolvedValueOnce(null);

            await approveStudentCollege({ params: { collegeId: "missing" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe("rejectStudentCollege", () => {
        it("does NOT delete the college doc — marks it rejected, updates linked users, and audit-logs it", async () => {
            const college = {
                _id: "c2",
                domains: ["xyz.ac.in"],
                name: "XYZ Institute",
                status: "pending",
                save: vi.fn().mockResolvedValue(true),
            };
            const linkedUser = makeUser({
                _id: "stu1",
                role: "student",
                firebaseUid: "fb-stu1",
                education: { collegeId: "c2", emailVerified: true, collegeStatus: "pending" },
            });
            College.findById.mockResolvedValueOnce(college);
            User.find.mockResolvedValueOnce([linkedUser]);

            const admin = makeAdmin();
            await rejectStudentCollege({ params: { collegeId: "c2" }, userDoc: admin, actingAdminDoc: null }, res);

            expect(college.status).toBe("rejected");
            expect(College.deleteOne).not.toHaveBeenCalled();
            expect(linkedUser.education.collegeStatus).toBe("rejected");
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({ adminDoc: admin, action: "studentCollege.reject", targetType: "College", targetId: "c2" })
            );
            expect(createNotification).toHaveBeenCalledWith(
                expect.objectContaining({ userId: "stu1", type: "college_rejected" })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("404s when the college request doesn't exist", async () => {
            College.findById.mockResolvedValueOnce(null);

            await rejectStudentCollege({ params: { collegeId: "missing" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe("listUsers", () => {
        it("paginates and excludes admins by default", async () => {
            User.find.mockReturnValueOnce(
                chainableQuery([{ _id: "s1", displayName: "S", email: "s@b.com", username: "s1", role: "student", createdAt: "t" }])
            );
            User.countDocuments.mockResolvedValueOnce(1);

            await listUsers({ query: {} }, res);

            expect(User.find).toHaveBeenCalledWith(
                expect.objectContaining({ role: { $ne: "admin" } }),
                expect.any(String)
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ total: 1, page: 1, limit: 20 })
            );
        });

        it("filters by role", async () => {
            User.find.mockReturnValueOnce(chainableQuery([]));
            User.countDocuments.mockResolvedValueOnce(0);

            await listUsers({ query: { role: "recruiter" } }, res);

            expect(User.find).toHaveBeenCalledWith(
                { $and: [{ role: { $ne: "admin" } }, { role: "recruiter" }] },
                expect.any(String)
            );
        });

        it("ignores an unrecognized role value rather than erroring", async () => {
            User.find.mockReturnValueOnce(chainableQuery([]));
            User.countDocuments.mockResolvedValueOnce(0);

            await listUsers({ query: { role: "superuser" } }, res);

            expect(User.find).toHaveBeenCalledWith(
                expect.objectContaining({ role: { $ne: "admin" } }),
                expect.any(String)
            );
        });

        // Plan 005's "View students" deep-link.
        describe("college filter", () => {
            it("matches students via education.collegeId OR TPOs via tpoProfile.collegeDomain", async () => {
                College.findById.mockReturnValueOnce({
                    lean: vi.fn().mockResolvedValue({ _id: "c1", domains: ["mit.edu", "old-mit.edu"] }),
                });
                User.find.mockReturnValueOnce(chainableQuery([]));
                User.countDocuments.mockResolvedValueOnce(0);

                await listUsers({ query: { college: "c1" } }, res);

                expect(User.find).toHaveBeenCalledWith(
                    {
                        $and: [
                            { role: { $ne: "admin" } },
                            {
                                $or: [
                                    { "education.collegeId": "c1" },
                                    { "tpoProfile.collegeDomain": { $in: ["mit.edu", "old-mit.edu"] } },
                                ],
                            },
                        ],
                    },
                    expect.any(String)
                );
            });

            it("combines with role/search filters via $and rather than clobbering them", async () => {
                College.findById.mockReturnValueOnce({
                    lean: vi.fn().mockResolvedValue({ _id: "c1", domains: ["mit.edu"] }),
                });
                User.find.mockReturnValueOnce(chainableQuery([]));
                User.countDocuments.mockResolvedValueOnce(0);

                await listUsers({ query: { college: "c1", role: "student", search: "ann" } }, res);

                const [filter] = User.find.mock.calls[0];
                expect(filter.$and).toEqual(
                    expect.arrayContaining([
                        { role: { $ne: "admin" } },
                        { role: "student" },
                        expect.objectContaining({ $or: expect.any(Array) }), // search clause
                        expect.objectContaining({ $or: expect.any(Array) }), // college clause
                    ])
                );
            });

            it("404s when the college doesn't exist", async () => {
                College.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) });

                await listUsers({ query: { college: "missing" } }, res);

                expect(res.status).toHaveBeenCalledWith(404);
                expect(User.find).not.toHaveBeenCalled();
            });
        });
    });

    describe("getAuditLogs", () => {
        it("returns paginated logs sorted newest-first", async () => {
            const entries = [
                { _id: "l1", adminEmail: "admin@codeclub.dev", action: "recruiter.approve", targetType: "User", targetId: "u1", createdAt: "t2" },
            ];
            AdminAuditLog.find.mockReturnValueOnce(chainableQuery(entries));
            AdminAuditLog.countDocuments.mockResolvedValueOnce(1);

            await getAuditLogs({ query: {} }, res);

            expect(AdminAuditLog.find).toHaveBeenCalledWith({});
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ logs: entries, total: 1, page: 1, limit: 20 })
            );
        });

        it("filters by action, adminId, and date range", async () => {
            AdminAuditLog.find.mockReturnValueOnce(chainableQuery([]));
            AdminAuditLog.countDocuments.mockResolvedValueOnce(0);

            await getAuditLogs(
                {
                    query: {
                        action: "recruiter.approve",
                        adminId: "admin1",
                        startDate: "2026-01-01",
                        endDate: "2026-01-31",
                    },
                },
                res
            );

            expect(AdminAuditLog.find).toHaveBeenCalledWith({
                action: "recruiter.approve",
                adminId: "admin1",
                createdAt: { $gte: new Date("2026-01-01"), $lte: new Date("2026-01-31") },
            });
        });

        it("clamps page/limit the same way listUsers does", async () => {
            AdminAuditLog.find.mockReturnValueOnce(chainableQuery([]));
            AdminAuditLog.countDocuments.mockResolvedValueOnce(0);

            await getAuditLogs({ query: { page: "0", limit: "500" } }, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ page: 1, limit: 50 })
            );
        });

        it("returns 500 if the query fails", async () => {
            AdminAuditLog.find.mockImplementationOnce(() => {
                throw new Error("db down");
            });

            await getAuditLogs({ query: {} }, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("startImpersonation", () => {
        it("swaps the admin into impersonating the target and logs it", async () => {
            const admin = makeUser({ _id: "admin1", role: "admin" });
            const target = makeUser({ _id: "target1", role: "student", firebaseUid: "fb-target" });
            User.findById.mockResolvedValueOnce(target);

            const req = { userDoc: admin, actingAdminDoc: null, params: { userId: "target1" } };
            await startImpersonation(req, res);

            expect(admin.impersonating.targetUserId).toBe("target1");
            expect(ImpersonationLog.create).toHaveBeenCalledWith(
                expect.objectContaining({ adminId: "admin1", targetUserId: "target1" })
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, impersonating: expect.objectContaining({ id: "target1" }) })
            );
        });

        it("refuses to impersonate another admin", async () => {
            const admin = makeUser({ _id: "admin1", role: "admin" });
            User.findById.mockResolvedValueOnce(makeUser({ _id: "target1", role: "admin" }));

            await startImpersonation(
                { userDoc: admin, actingAdminDoc: null, params: { userId: "target1" } },
                res
            );

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("closes out the previous ImpersonationLog entry when switching targets", async () => {
            const admin = makeUser({
                _id: "admin1",
                role: "admin",
                impersonating: { targetUserId: "old-target", startedAt: new Date() },
            });
            const newTarget = makeUser({ _id: "target2", role: "student" });
            User.findById.mockResolvedValueOnce(newTarget);

            await startImpersonation(
                { userDoc: admin, actingAdminDoc: null, params: { userId: "target2" } },
                res
            );

            expect(ImpersonationLog.updateOne).toHaveBeenCalledWith(
                expect.objectContaining({ adminId: "admin1", targetUserId: "old-target" }),
                expect.objectContaining({ $set: { endedAt: expect.any(Date) } })
            );
        });
    });

    describe("stopImpersonation", () => {
        it("clears the impersonation pointer and closes the log entry", async () => {
            const admin = makeUser({
                _id: "admin1",
                role: "admin",
                impersonating: { targetUserId: "target1", startedAt: new Date() },
            });

            await stopImpersonation({ userDoc: admin, actingAdminDoc: null }, res);

            expect(ImpersonationLog.updateOne).toHaveBeenCalledOnce();
            expect(admin.impersonating).toEqual({ targetUserId: null, startedAt: null });
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });
    });

    describe("suspendUser", () => {
        it("sets status to suspended, invalidates the auth cache, and audit-logs it", async () => {
            const target = makeUser({ _id: "u1", role: "student", status: "active" });
            const admin = makeAdmin();
            User.findById.mockResolvedValueOnce(target);

            await suspendUser({ params: { id: "u1" }, userDoc: admin, actingAdminDoc: null }, res);

            expect(target.status).toBe("suspended");
            expect(target.save).toHaveBeenCalledOnce();
            expect(invalidateCachedUserByFirebaseUid).toHaveBeenCalledWith("fb-1");
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({ adminDoc: admin, action: "user.suspend", targetType: "User", targetId: "u1" })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("404s when the target doesn't exist", async () => {
            User.findById.mockResolvedValueOnce(null);

            await suspendUser({ params: { id: "missing" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("400s when the target is an admin", async () => {
            User.findById.mockResolvedValueOnce(makeUser({ role: "admin" }));

            await suspendUser({ params: { id: "u1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe("activateUser", () => {
        it("sets status to active, invalidates the auth cache, and audit-logs it", async () => {
            const target = makeUser({ _id: "u1", role: "student", status: "suspended" });
            const admin = makeAdmin();
            User.findById.mockResolvedValueOnce(target);

            await activateUser({ params: { id: "u1" }, userDoc: admin, actingAdminDoc: null }, res);

            expect(target.status).toBe("active");
            expect(target.save).toHaveBeenCalledOnce();
            expect(invalidateCachedUserByFirebaseUid).toHaveBeenCalledWith("fb-1");
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({ adminDoc: admin, action: "user.activate", targetType: "User", targetId: "u1" })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("404s when the target doesn't exist", async () => {
            User.findById.mockResolvedValueOnce(null);

            await activateUser({ params: { id: "missing" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("400s when the target is an admin", async () => {
            User.findById.mockResolvedValueOnce(makeUser({ role: "admin" }));

            await activateUser({ params: { id: "u1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe("deleteUser", () => {
        it("cascade-deletes Submissions/Notifications, deletes the user, invalidates cache, and audit-logs it", async () => {
            const target = makeUser({ _id: "u1", role: "student" });
            const admin = makeAdmin();
            User.findById.mockResolvedValueOnce(target);
            Submission.deleteMany.mockResolvedValueOnce({ deletedCount: 3 });
            Notification.deleteMany.mockResolvedValueOnce({ deletedCount: 5 });
            User.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

            await deleteUser({ params: { id: "u1" }, userDoc: admin, actingAdminDoc: null }, res);

            expect(Submission.deleteMany).toHaveBeenCalledWith({ userId: "u1" });
            expect(Notification.deleteMany).toHaveBeenCalledWith({ userId: "u1" });
            expect(User.deleteOne).toHaveBeenCalledWith({ _id: "u1" });
            expect(invalidateCachedUserByFirebaseUid).toHaveBeenCalledWith("fb-1");
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({ adminDoc: admin, action: "user.delete", targetType: "User", targetId: "u1" })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("404s when the target doesn't exist", async () => {
            User.findById.mockResolvedValueOnce(null);

            await deleteUser({ params: { id: "missing" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("400s when the target is an admin", async () => {
            User.findById.mockResolvedValueOnce(makeUser({ role: "admin" }));

            await deleteUser({ params: { id: "u1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(User.deleteOne).not.toHaveBeenCalled();
        });

        // ── Primary-TPO dangling-reference cleanup (Phase 3) ─────────────
        it("clears College.primaryTpo when the deleted account was the primary TPO", async () => {
            const target = makeUser({
                _id: "u1", role: "tpo",
                tpoProfile: { collegeDomain: "mit.edu", collegeName: "MIT", verified: true },
            });
            User.findById.mockResolvedValueOnce(target);
            College.findByDomain.mockResolvedValueOnce({ _id: "c1" });
            Submission.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
            Notification.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
            User.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

            await deleteUser({ params: { id: "u1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(College.findByDomain).toHaveBeenCalledWith("mit.edu");
            expect(clearPrimaryIfCurrent).toHaveBeenCalledWith("c1", "u1");
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("skips the College lookup entirely for a non-TPO account", async () => {
            const target = makeUser({ _id: "u1", role: "student" });
            User.findById.mockResolvedValueOnce(target);
            Submission.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
            Notification.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
            User.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

            await deleteUser({ params: { id: "u1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(College.findByDomain).not.toHaveBeenCalled();
            expect(clearPrimaryIfCurrent).not.toHaveBeenCalled();
        });

        // ── TPO-1 hardening: partial-failure handling ───────────────────────
        it("clears primaryTpo AFTER the account is actually deleted, not before", async () => {
            const target = makeUser({
                _id: "u1", role: "tpo",
                tpoProfile: { collegeDomain: "mit.edu", collegeName: "MIT", verified: true },
            });
            User.findById.mockResolvedValueOnce(target);
            College.findByDomain.mockResolvedValueOnce({ _id: "c1" });
            Submission.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
            Notification.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });

            const callOrder = [];
            User.deleteOne.mockImplementationOnce(async () => { callOrder.push("deleteOne"); return { deletedCount: 1 }; });
            clearPrimaryIfCurrent.mockImplementationOnce(async () => { callOrder.push("clearPrimaryIfCurrent"); return true; });

            await deleteUser({ params: { id: "u1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(callOrder).toEqual(["deleteOne", "clearPrimaryIfCurrent"]);
        });

        it("does NOT clear primaryTpo when the deletion itself fails — a still-existing primary must not be silently demoted", async () => {
            const target = makeUser({
                _id: "u1", role: "tpo",
                tpoProfile: { collegeDomain: "mit.edu", collegeName: "MIT", verified: true },
            });
            User.findById.mockResolvedValueOnce(target);
            Submission.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
            Notification.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
            User.deleteOne.mockRejectedValueOnce(new Error("delete boom"));

            await deleteUser({ params: { id: "u1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(College.findByDomain).not.toHaveBeenCalled();
            expect(clearPrimaryIfCurrent).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
        });

        it("still reports success when clearing the dangling primaryTpo reference fails after a successful deletion", async () => {
            const target = makeUser({
                _id: "u1", role: "tpo",
                tpoProfile: { collegeDomain: "mit.edu", collegeName: "MIT", verified: true },
            });
            User.findById.mockResolvedValueOnce(target);
            College.findByDomain.mockResolvedValueOnce({ _id: "c1" });
            Submission.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
            Notification.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
            User.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });
            clearPrimaryIfCurrent.mockRejectedValueOnce(new Error("CAS write boom"));

            await deleteUser({ params: { id: "u1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            // Deletion already succeeded by the time this fails — must still
            // report success, not a 500 the admin reads as "delete failed".
            expect(res.status).not.toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });
    });

    describe("resetUserProgress", () => {
        it("zeroes progress fields but leaves role/profile/verification state untouched", async () => {
            const target = makeUser({
                _id: "u1",
                role: "student",
                currentStreak: 10,
                longestStreak: 20,
                lastActivityDate: "2026-08-01",
                totalXP: 500,
                solvedSlugs: ["two-sum"],
                solvedDifficulty: { easy: 1, medium: 0, hard: 0 },
                topicStats: { arrays: 1 },
                activityDates: ["2026-08-01"],
                recentActivity: [{ title: "Two Sum" }],
                achievements: [{ key: "first-blood" }],
                dailyChallengeHistory: [{ date: "2026-08-01", slug: "two-sum" }],
                education: { collegeName: "MIT", emailVerified: true, collegeStatus: "verified" },
            });
            const admin = makeAdmin();
            User.findById.mockResolvedValueOnce(target);

            await resetUserProgress({ params: { id: "u1" }, userDoc: admin, actingAdminDoc: null }, res);

            expect(target.currentStreak).toBe(0);
            expect(target.longestStreak).toBe(0);
            expect(target.lastActivityDate).toBeNull();
            expect(target.totalXP).toBe(0);
            expect(target.solvedSlugs).toEqual([]);
            expect(target.solvedDifficulty).toEqual({ easy: 0, medium: 0, hard: 0 });
            expect(target.topicStats).toEqual({});
            expect(target.activityDates).toEqual([]);
            expect(target.recentActivity).toEqual([]);
            expect(target.achievements).toEqual([]);
            expect(target.dailyChallengeHistory).toEqual([]);
            // Untouched — plan 003 explicitly excludes role/profile/education state.
            expect(target.role).toBe("student");
            expect(target.education).toEqual({ collegeName: "MIT", emailVerified: true, collegeStatus: "verified" });
            expect(target.save).toHaveBeenCalledOnce();
            expect(invalidateCachedUserByFirebaseUid).toHaveBeenCalledWith("fb-1");
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({ adminDoc: admin, action: "user.reset_progress", targetType: "User", targetId: "u1" })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("404s when the target doesn't exist", async () => {
            User.findById.mockResolvedValueOnce(null);

            await resetUserProgress({ params: { id: "missing" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("400s when the target is an admin", async () => {
            User.findById.mockResolvedValueOnce(makeUser({ role: "admin" }));

            await resetUserProgress({ params: { id: "u1" }, userDoc: makeAdmin(), actingAdminDoc: null }, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe("changeUserRole", () => {
        it("changes the role, invalidates the auth cache, and audit-logs before/after state", async () => {
            const target = makeUser({ _id: "u1", role: "student" });
            const admin = makeAdmin();
            User.findById.mockResolvedValueOnce(target);

            await changeUserRole(
                { params: { id: "u1" }, body: { role: "recruiter" }, userDoc: admin, actingAdminDoc: null },
                res
            );

            expect(target.role).toBe("recruiter");
            expect(target.save).toHaveBeenCalledOnce();
            expect(invalidateCachedUserByFirebaseUid).toHaveBeenCalledWith("fb-1");
            expect(recordAdminAction).toHaveBeenCalledWith(
                expect.objectContaining({
                    adminDoc: admin,
                    action: "user.change_role",
                    targetType: "User",
                    targetId: "u1",
                    details: { previousRole: "student", newRole: "recruiter" },
                })
            );
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("400s when the requested role is admin — no path to mint a second admin", async () => {
            await changeUserRole(
                { params: { id: "u1" }, body: { role: "admin" }, userDoc: makeAdmin(), actingAdminDoc: null },
                res
            );

            expect(res.status).toHaveBeenCalledWith(400);
            expect(User.findById).not.toHaveBeenCalled();
        });

        it("400s on an unrecognized role value", async () => {
            await changeUserRole(
                { params: { id: "u1" }, body: { role: "superuser" }, userDoc: makeAdmin(), actingAdminDoc: null },
                res
            );

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("404s when the target doesn't exist", async () => {
            User.findById.mockResolvedValueOnce(null);

            await changeUserRole(
                { params: { id: "missing" }, body: { role: "tpo" }, userDoc: makeAdmin(), actingAdminDoc: null },
                res
            );

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("400s when the target is already an admin", async () => {
            User.findById.mockResolvedValueOnce(makeUser({ role: "admin" }));

            await changeUserRole(
                { params: { id: "u1" }, body: { role: "tpo" }, userDoc: makeAdmin(), actingAdminDoc: null },
                res
            );

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe("getDashboardMetrics", () => {
        it("returns every documented metric field, grouped, in one response", async () => {
            User.countDocuments
                .mockResolvedValueOnce(100) // totalStudents
                .mockResolvedValueOnce(20) // totalRecruiters
                .mockResolvedValueOnce(5) // totalTpos
                .mockResolvedValueOnce(80) // activeStudents
                .mockResolvedValueOnce(15) // activeRecruiters
                .mockResolvedValueOnce(4) // activeTpos
                .mockResolvedValueOnce(3) // newRegistrationsToday
                .mockResolvedValueOnce(2); // pendingRecruiterApprovals
            Problem.countDocuments.mockResolvedValueOnce(50);
            Submission.countDocuments
                .mockResolvedValueOnce(1000) // totalSubmissions
                .mockResolvedValueOnce(650); // acceptedSubmissions
            College.countDocuments.mockResolvedValueOnce(1); // pendingTpoApprovals

            await getDashboardMetrics({}, res);

            expect(res.json).toHaveBeenCalledWith({
                users: {
                    totalStudents: 100,
                    totalRecruiters: 20,
                    totalTpos: 5,
                    activeStudents: 80,
                    activeRecruiters: 15,
                    activeTpos: 4,
                    newRegistrationsToday: 3,
                },
                content: {
                    totalProblems: 50,
                    totalSubmissions: 1000,
                    acceptanceRate: 65,
                },
                approvals: {
                    pendingRecruiterApprovals: 2,
                    pendingTpoApprovals: 1,
                },
            });
        });

        it("matches getProblems' catalog visibility filter (excludes contest-only problems)", async () => {
            User.countDocuments.mockResolvedValue(0);
            Problem.countDocuments.mockResolvedValueOnce(0);
            Submission.countDocuments.mockResolvedValue(0);
            College.countDocuments.mockResolvedValueOnce(0);

            await getDashboardMetrics({}, res);

            expect(Problem.countDocuments).toHaveBeenCalledWith({ visibility: { $ne: "contest" } });
        });

        it("matches getPendingQueue's exact filter shape for pending recruiters/TPOs", async () => {
            User.countDocuments.mockResolvedValue(0);
            Problem.countDocuments.mockResolvedValueOnce(0);
            Submission.countDocuments.mockResolvedValue(0);
            College.countDocuments.mockResolvedValueOnce(0);

            await getDashboardMetrics({}, res);

            expect(User.countDocuments).toHaveBeenCalledWith({
                role: "recruiter",
                "recruiterProfile.verified": false,
            });
            expect(College.countDocuments).toHaveBeenCalledWith({
                status: "pending",
                submittedByRole: "tpo",
            });
        });

        it("uses the same Accepted-status semantics as getAcceptanceRates for the platform-wide rate", async () => {
            User.countDocuments.mockResolvedValue(0);
            Problem.countDocuments.mockResolvedValueOnce(0);
            Submission.countDocuments.mockResolvedValue(0);
            College.countDocuments.mockResolvedValueOnce(0);

            await getDashboardMetrics({}, res);

            expect(Submission.countDocuments).toHaveBeenCalledWith({ status: "Accepted" });
        });

        it("returns 0% acceptance rate (not NaN) when there are zero submissions", async () => {
            User.countDocuments.mockResolvedValue(0);
            Problem.countDocuments.mockResolvedValueOnce(0);
            Submission.countDocuments.mockResolvedValue(0);
            College.countDocuments.mockResolvedValueOnce(0);

            await getDashboardMetrics({}, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.objectContaining({ acceptanceRate: 0 }) })
            );
        });

        it("returns 500 if a query fails", async () => {
            User.countDocuments.mockImplementationOnce(() => {
                throw new Error("db down");
            });

            await getDashboardMetrics({}, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});

describe("individual TPO verification", () => {
    it("approves a pending TPO only when its college is already verified", async () => {
        const user = makeUser({
            _id: "t1",
            role: "tpo",
            roles: ["student", "tpo"],
            email: "prof@staff.mit.edu",
            firebaseUid: "fb-t1",
            tpoProfile: {
                collegeDomain: "staff.mit.edu",
                collegeName: "MIT",
                verified: false,
                requestedAt: new Date(),
                verifiedAt: null,
            },
            tpoVerification: {
                status: "pending",
                emailRoleSignal: "staff_candidate",
                submittedEmail: "prof@staff.mit.edu",
                evidence: [],
            },
        });
        const college = { _id: "c1", name: "MIT", status: "verified", domains: ["staff.mit.edu"], };
        User.findById.mockResolvedValueOnce(user);
        College.findByDomain.mockResolvedValueOnce(college);
        claimPrimaryIfNone.mockResolvedValueOnce(true);
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

        await approveTpoUser({ params: { userId: "t1" }, userDoc: makeAdmin() }, res);

        expect(user.tpoProfile.verified).toBe(true);
        expect(user.tpoVerification.status).toBe("approved");
        expect(user.save).toHaveBeenCalled();
        expect(TpoVerificationReview.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "t1", collegeId: "c1", decision: "approved" })
        );
    });

    it("rejects an individual pending TPO without deleting the college", async () => {
        const user = makeUser({
            _id: "t2",
            role: "tpo",
            roles: ["student", "tpo"],
            tpoProfile: {
                collegeDomain: "mit.edu",
                collegeName: "MIT",
                verified: false,
                requestedAt: new Date(),
                verifiedAt: null,
            },
            tpoVerification: { status: "pending", emailRoleSignal: "student_candidate", evidence: [] },
        });
        User.findById.mockResolvedValueOnce(user);
        College.findByDomain.mockResolvedValueOnce({ _id: "c1", name: "MIT", status: "verified", domains: ["mit.edu"] });
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

        await rejectTpoUser({ params: { userId: "t2" }, userDoc: makeAdmin() }, res);

        expect(user.roles).toEqual(["student"]);
        expect(user.role).toBe("student");
        expect(user.tpoVerification.status).toBe("rejected");
        expect(College.deleteOne).not.toHaveBeenCalled();
        expect(user.save).toHaveBeenCalled();
    });
});
