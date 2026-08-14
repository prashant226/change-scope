import { z } from "zod";

/** Strict schema for the AI's response — never trust free-form output (§55). */
export const aiChangeSchema = z.object({
  groupKey: z.string(),
  /** A concise, human-meaningful business/content name for this event (e.g. "Pricing", "Availability") — not the raw DOM/container label it was given. */
  groupTitle: z.string(),
  meaningful: z.boolean(),
  significance: z.enum(["high", "medium", "low"]),
  /** One grounded, factual sentence describing what changed — no interpretation. */
  whatChanged: z.string(),
  /** One grounded, hedged sentence on why it might matter — interpretation, not invented causes. */
  whyItMatters: z.string(),
  confidence: z.number().min(0).max(1),
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
          whatChanged: { type: "string" },
          whyItMatters: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["groupKey", "groupTitle", "meaningful", "significance", "whatChanged", "whyItMatters", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["changes"],
  additionalProperties: false,
} as const;
