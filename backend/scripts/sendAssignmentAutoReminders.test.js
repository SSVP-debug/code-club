import { describe, expect, it, vi } from "vitest";
import { sendAssignmentAutoRemindersCore } from "./sendAssignmentAutoReminders.js";

const assignment = {
  _id: "assignment-1",
  title: "Week 3 — Arrays",
  dueDate: "2026-10-01",
  problemSlugs: ["two-sum", "valid-parentheses"],
};

describe("sendAssignmentAutoRemindersCore", () => {
  it("reminds only incomplete students, marks the assignment reminded, and counts correctly", async () => {
    const markReminded = vi.fn().mockResolvedValue(undefined);
    const sendReminders = vi.fn().mockResolvedValue(undefined);

    const counts = await sendAssignmentAutoRemindersCore({
      findDueAssignments: async () => [assignment],
      getAudience: async () => [
        { _id: "done", solvedSlugs: ["two-sum", "valid-parentheses"] },
        { _id: "partial", solvedSlugs: ["two-sum"] },
        { _id: "none", solvedSlugs: [] },
      ],
      markReminded,
      sendReminders,
    });

    expect(sendReminders).toHaveBeenCalledWith(
      assignment,
      expect.arrayContaining([
        expect.objectContaining({ _id: "partial" }),
        expect.objectContaining({ _id: "none" }),
      ])
    );
    expect(sendReminders.mock.calls[0][1]).toHaveLength(2);
    expect(markReminded).toHaveBeenCalledWith("assignment-1");
    expect(counts).toEqual({
      scanned: 1,
      remindedAssignments: 1,
      remindedStudents: 2,
      skippedEveryoneDone: 0,
      errors: 0,
    });
  });

  it("still marks reminded (so it isn't rescanned) but sends nothing when everyone is already done", async () => {
    const markReminded = vi.fn().mockResolvedValue(undefined);
    const sendReminders = vi.fn();

    const counts = await sendAssignmentAutoRemindersCore({
      findDueAssignments: async () => [assignment],
      getAudience: async () => [{ _id: "done", solvedSlugs: ["two-sum", "valid-parentheses"] }],
      markReminded,
      sendReminders,
    });

    expect(sendReminders).not.toHaveBeenCalled();
    expect(markReminded).toHaveBeenCalledWith("assignment-1");
    expect(counts.skippedEveryoneDone).toBe(1);
    expect(counts.remindedAssignments).toBe(0);
  });

  it("dry-run sends nothing AND marks nothing reminded, so a real run afterwards still sees the assignment", async () => {
    const markReminded = vi.fn();
    const sendReminders = vi.fn();

    const counts = await sendAssignmentAutoRemindersCore({
      findDueAssignments: async () => [assignment],
      getAudience: async () => [{ _id: "none", solvedSlugs: [] }],
      markReminded,
      sendReminders,
      dryRun: true,
    });

    expect(sendReminders).not.toHaveBeenCalled();
    expect(markReminded).not.toHaveBeenCalled();
    expect(counts.remindedAssignments).toBe(1);
    expect(counts.remindedStudents).toBe(1);
  });

  it("isolates a per-assignment failure — one bad assignment doesn't stop the rest, and isn't marked reminded", async () => {
    const markReminded = vi.fn().mockResolvedValue(undefined);
    const sendReminders = vi.fn().mockResolvedValue(undefined);
    const assignment2 = { ...assignment, _id: "assignment-2" };

    const counts = await sendAssignmentAutoRemindersCore({
      findDueAssignments: async () => [assignment, assignment2],
      getAudience: vi.fn(async (a) => {
        if (a._id === "assignment-1") throw new Error("Mongo blip");
        return [{ _id: "none", solvedSlugs: [] }];
      }),
      markReminded,
      sendReminders,
    });

    expect(counts.errors).toBe(1);
    expect(counts.remindedAssignments).toBe(1);
    expect(markReminded).toHaveBeenCalledTimes(1);
    expect(markReminded).toHaveBeenCalledWith("assignment-2");
  });

  it("does nothing when no assignments are due within the window", async () => {
    const counts = await sendAssignmentAutoRemindersCore({
      findDueAssignments: async () => [],
      getAudience: vi.fn(),
      markReminded: vi.fn(),
      sendReminders: vi.fn(),
    });

    expect(counts).toEqual({
      scanned: 0,
      remindedAssignments: 0,
      remindedStudents: 0,
      skippedEveryoneDone: 0,
      errors: 0,
    });
  });
});
