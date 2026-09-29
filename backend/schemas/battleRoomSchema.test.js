import { describe, expect, it } from "vitest";
import {
  battleRoomAssignTeamsSchema,
  battleRoomCreateSchema,
  battleRoomJoinSchema,
  battleRoomSolveSchema,
} from "./battleRoomSchema.js";

describe("Battle Room request schemas", () => {
  it("normalizes and validates create requests", () => {
    const result = battleRoomCreateSchema.safeParse({
      title: "  Friday Night Battle  ",
      description: "  Practice match  ",
      problemSlugs: [" two-sum ", "valid-parentheses"],
      durationMinutes: "60",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      title: "Friday Night Battle",
      description: "Practice match",
      problemSlugs: ["two-sum", "valid-parentheses"],
      durationMinutes: 60,
      maxTeamSize: 4,
    });
  });

  it("rejects malformed create values", () => {
    expect(
      battleRoomCreateSchema.safeParse({
        title: "",
        problemSlugs: ["two-sum", "two-sum"],
        durationMinutes: "not-a-number",
      }).success
    ).toBe(false);
  });

  it("rejects malformed invite codes", () => {
    expect(battleRoomJoinSchema.safeParse({ inviteCode: "short" }).success).toBe(false);
    expect(battleRoomJoinSchema.safeParse({ inviteCode: "ABC12!" }).success).toBe(false);
  });

  it("accepts both random and manual team assignment payloads", () => {
    expect(
      battleRoomAssignTeamsSchema.safeParse({ mode: "random" }).success
    ).toBe(true);

    expect(
      battleRoomAssignTeamsSchema.safeParse({
        mode: "manual",
        assignments: [{ userId: "507f1f77bcf86cd799439011", teamIndex: 0 }],
      }).success
    ).toBe(true);
  });

  it("rejects invalid manual assignments", () => {
    expect(
      battleRoomAssignTeamsSchema.safeParse({
        mode: "manual",
        assignments: [{ userId: "not-an-object-id", teamIndex: 2 }],
      }).success
    ).toBe(false);
  });

  it("requires a non-empty solve slug", () => {
    expect(battleRoomSolveSchema.safeParse({ slug: "two-sum" }).success).toBe(true);
    expect(battleRoomSolveSchema.safeParse({ slug: "" }).success).toBe(false);
  });
});
