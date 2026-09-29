import { z } from "zod";

const objectId = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Invalid userId");

export const battleRoomCreateSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(100),
  description: z.string().trim().max(300).optional().default(""),
  problemSlugs: z
    .array(z.string().trim().min(1, "problemSlugs cannot contain empty values").max(200))
    .min(1, "At least one problem is required")
    .refine((slugs) => new Set(slugs).size === slugs.length, {
      message: "problemSlugs must not contain duplicates",
      path: ["problemSlugs"],
    }),
  durationMinutes: z.coerce
    .number()
    .int("durationMinutes must be an integer")
    .positive("durationMinutes must be positive"),
  maxTeamSize: z.coerce
    .number()
    .int("maxTeamSize must be an integer")
    .min(2, "maxTeamSize must be at least 2")
    .max(6, "maxTeamSize must be at most 6")
    .optional()
    .default(4),
});

export const battleRoomJoinSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{6}$/i, "inviteCode must be a 6-character code"),
});

export const battleRoomAssignTeamsSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("random"),
  }),
  z.object({
    mode: z.literal("manual"),
    assignments: z.array(
      z.object({
        userId: objectId,
        teamIndex: z.union([z.literal(0), z.literal(1), z.null()]),
      })
    ),
  }),
]);

export const battleRoomSolveSchema = z.object({
  slug: z.string().trim().min(1, "slug is required").max(200),
});
