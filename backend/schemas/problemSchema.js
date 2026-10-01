import { z } from "zod";
import {
    SUPPORTED_LANGUAGE_KEYS,
    STATICALLY_TYPED_LANGUAGE_KEYS,
    REQUIRED_STARTER_LANGUAGE_KEYS,
} from "../config/languages.js";

export const TestcaseSchema = z.object({
    input: z.record(z.any()),
    expectedOutput: z.any(),
});

function languageMapSchema({ allowedKeys, requiredKeys = [], valueSchema = z.string(), label }) {
    return z.record(z.string(), valueSchema).superRefine((obj, ctx) => {
        for (const key of Object.keys(obj)) {
            if (!allowedKeys.includes(key)) {
                ctx.addIssue({ code: "custom", message: `"${key}" is not a registered language for ${label} (see backend/config/languages.js)`, path: [key] });
            }
        }
        for (const key of requiredKeys) {
            if (!(key in obj)) {
                ctx.addIssue({ code: "custom", message: `missing required ${label} for "${key}"`, path: [key] });
            }
        }
    });
}

export const ReturnTypeSchema = languageMapSchema({
    allowedKeys: STATICALLY_TYPED_LANGUAGE_KEYS,
    label: "returnType",
}).default({});

export const ParamTypesSchema = languageMapSchema({
    allowedKeys: STATICALLY_TYPED_LANGUAGE_KEYS,
    valueSchema: z.record(z.string(), z.string()),
    label: "paramTypes",
}).default({});

export const StarterCodeSchema = languageMapSchema({
    allowedKeys: SUPPORTED_LANGUAGE_KEYS,
    requiredKeys: REQUIRED_STARTER_LANGUAGE_KEYS,
    label: "starterCode",
});

export const MetaSchema = z.object({
    id: z.number().int().positive(),
    slug: z.string().min(1),
    title: z.string().min(1),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    topic: z.string().min(1),
    pattern: z.string().default(""),
    sourceType: z.string().default("core"),
    functionName: z.string().min(1),
    estimatedTime: z.string().default(""),
    companies: z.array(z.string()).default([]),
    relatedProblems: z.array(z.string()).default([]),
    returnType: ReturnTypeSchema,
    paramTypes: ParamTypesSchema,
    comparisonMode: z.enum(["exact", "unordered"]).default("exact"),
    operationSequence: z.object({
        enabled: z.boolean().default(false),
        resultMode: z.enum(["all", "returningOnly"]).default("all"),
    }).default({}),
});

export const ProblemFolderSchema = z.object({
    meta: MetaSchema,
    description: z.string(),
    examples: z.array(z.object({
        input: z.string(),
        output: z.string(),
        explanation: z.string().optional(),
    })).default([]),
    constraints: z.array(z.string()).default([]),
    visibleTestcases: z.array(TestcaseSchema),
    hiddenTestcases: z.array(TestcaseSchema),
    starterCode: StarterCodeSchema,
    editorial: z.string().default(""),
    hints: z.array(z.object({
        level: z.number().int().positive(),
        text: z.string(),
    })).default([]),
});

export const AdminProblemCreateSchema = MetaSchema.extend({
    description: z.string().min(1),
    testcases: z.array(TestcaseSchema).default([]),
    hiddenTestcaseSet: z.object({
        enabled: z.boolean().default(true),
        testcases: z.array(TestcaseSchema).default([]),
    }).default({}),
    starterCode: StarterCodeSchema,
    editorial: z.string().default(""),
    hints: z.array(z.object({
        level: z.number().int().positive(),
        text: z.string(),
    })).default([]),
});
