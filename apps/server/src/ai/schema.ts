import { z } from "zod";

/** Strict schema for the AI's response — never trust free-form output (§55). */
export const aiChangeSchema = z.object({
  groupKey: z.string(),
  groupTitle: z.string(),
  meaningful: z.boolean(),
  significance: z.enum(["high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
  whyItMatters: z.string(),
});

export const aiResponseSchema = z.object({
  changes: z.array(aiChangeSchema),
});

export type AiResponse = z.infer<typeof aiResponseSchema>;

/** JSON Schema mirror of the above, passed to the Responses API for structured output. */
export const aiJsonSchema = {
  type: "object",
  properties: {
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          groupKey: { type: "string" },
          groupTitle: { type: "string" },
          meaningful: { type: "boolean" },
          significance: { type: "string", enum: ["high", "medium", "low"] },
          confidence: { type: "number" },
          whyItMatters: { type: "string" },
        },
        required: ["groupKey", "groupTitle", "meaningful", "significance", "confidence", "whyItMatters"],
        additionalProperties: false,
      },
    },
  },
  required: ["changes"],
  additionalProperties: false,
} as const;
