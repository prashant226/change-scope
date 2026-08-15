/**
 * ShopKart-specific significance knowledge base (spec Part B). Scoped to the
 * fictional "ShopKart Nova X Pro 5G" demo page only — this is a controlled
 * demo fixture, not real market intelligence, and it never claims real
 * ShopKart business behavior.
 *
 * What this file is NOT responsible for: detecting changes (the deterministic
 * diff engine does that), classifying them (classifier/ does that), or
 * deciding what's meaningful (the AI still decides that, per group). This KB
 * only supplies contextual guidance + constraints that get attached to the
 * specific groups they're relevant to, so the AI's "why it might matter" is
 * more grounded — never a source of facts, never able to override actual
 * page evidence (see retrieveShopkartContext.ts's evidence-priority rule).
 */

export type KbAppliesTo = "pricing" | "discount" | "promotion" | "specification" | "description" | "availability" | "cta" | "cosmetic";

export interface KbEntry {
  key: string;
  appliesTo: KbAppliesTo[];
  significance: "high" | "medium" | "low";
  guidance: string[];
  constraints: string[];
}

export interface ShopkartKnowledgeBase {
  scope: "shopkart";
  monitorKey: string;
  version: number;
  entries: KbEntry[];
}

export const SHOPKART_KB: ShopkartKnowledgeBase = {
  scope: "shopkart",
  monitorKey: "shopkart-nova-x-pro-5g",
  version: 1,
  entries: [
    {
      key: "pricing_change",
      appliesTo: ["pricing", "discount"],
      significance: "high",
      guidance: [
        "A price decrease means the product is now offered at a lower selling price, which may materially affect its purchase attractiveness.",
        "A price increase means the higher selling price may materially change the purchase proposition presented to customers.",
        "A discount increase may strengthen the promotional value presented to customers; a discount decrease may reduce the promotional incentive presented to customers.",
      ],
      constraints: [
        "Never infer the business reason for a price or discount change.",
        "Never claim a sales or conversion impact without evidence on the page.",
      ],
    },
    {
      key: "promotional_dates",
      appliesTo: ["promotion"],
      significance: "medium",
      guidance: [
        "A shifted promotional date range changes when customers may expect the campaign to be active — describe it as a shift in the advertised window, nothing more.",
      ],
      constraints: [
        "Do not infer cancellation, inventory problems, sales problems, competitor activity, or internal business decisions from a date change unless the page explicitly says so.",
      ],
    },
    {
      key: "specification_change",
      appliesTo: ["specification"],
      significance: "medium",
      guidance: [
        "A changed advertised specification (e.g. a charging-speed label) may affect customer expectations and perceived product performance.",
      ],
      constraints: [
        "Describe only what the webpage communicates — never state or imply that physical hardware was upgraded unless the page explicitly supports that claim.",
      ],
    },
    {
      key: "description_change",
      appliesTo: ["description"],
      significance: "low",
      guidance: [
        "Changed product messaging alters how performance and capabilities are communicated to customers.",
      ],
      constraints: [
        "Do not turn marketing/descriptive language into a factual claim about actual hardware.",
      ],
    },
    {
      key: "availability_change",
      appliesTo: ["availability", "cta"],
      significance: "high",
      guidance: [
        "The product no longer being shown as directly available for purchase may materially affect customer purchase ability.",
        "A primary action changing from immediate purchase to an availability notification indicates a different customer interaction state.",
      ],
      constraints: [
        "Do not infer why the product went out of stock.",
        "When availability and the call-to-action change together, treat and describe them as one related event, not two unrelated changes.",
      ],
    },
    {
      key: "cosmetic_change",
      appliesTo: ["cosmetic"],
      significance: "low",
      guidance: [
        "Purely visual/formatting changes (color, font, spacing, border, alignment, background) are cosmetic and should never be presented as a meaningful business change.",
      ],
      constraints: [
        "Never let a cosmetic change inflate the meaningful-change count.",
      ],
    },
  ],
};
