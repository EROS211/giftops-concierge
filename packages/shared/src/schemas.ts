import { z } from "zod";

// --- Concierge API ---
export const ConciergeRunRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});
export type ConciergeRunRequest = z.infer<typeof ConciergeRunRequestSchema>;

export const RankingSignalsSchema = z.object({
  practicality: z.number(),
  emotionalImpact: z.number(),
  risk: z.number(),
  speed: z.number(),
});

export const DecisionPanelSchema = z.object({
  constraints: z.record(z.unknown()),
  assumptions: z.array(z.string()),
  mode: z.enum(["last_minute", "normal"]),
  rankingSignals: RankingSignalsSchema,
  safetyChecks: z.array(z.string()),
});
export type DecisionPanel = z.infer<typeof DecisionPanelSchema>;
export type GiftPlan = z.infer<typeof GiftPlanSchema>;
export type RankingSignals = z.infer<typeof RankingSignalsSchema>;

export const GiftCardSchema = z.object({
  rank: z.number(),
  title: z.string(),
  whyItFits: z.string(),
  price: z.string(),
  acquisitionPaths: z.array(z.string()),
  bundleAddOn: z.string().optional(),
  cardMessage: z.string(),
});

export const GiftPlanSchema = z.object({
  headline: z.string(),
  cards: z.array(GiftCardSchema),
  combos: z.array(z.string()).optional(),
  checklist: z.array(z.string()),
  finalNote: z.string(),
});

export const TraceStepSummarySchema = z.object({
  stepName: z.string(),
  ms: z.number(),
});

export const TraceSummarySchema = z.object({
  totalMs: z.number(),
  steps: z.array(TraceStepSummarySchema),
});

export const ConciergeRunResponseSchema = z.object({
  conversationId: z.string().uuid(),
  runId: z.string().uuid(),
  nextAction: z.enum(["ask_clarifying", "present_recommendations"]),
  clarifyingQuestion: z
    .object({
      question: z.string(),
      options: z.array(z.string()).optional(),
    })
    .optional(),
  decisionPanel: DecisionPanelSchema,
  giftPlan: GiftPlanSchema.optional(),
  traceSummary: TraceSummarySchema,
});
export type ConciergeRunResponse = z.infer<typeof ConciergeRunResponseSchema>;

// --- Pipeline step 1: extract_constraints output ---
// budgetMax: 0 means not specified; timingDeadline/logistics: "" means not specified
export const ExtractedConstraintsSchema = z.object({
  relationship: z.string(),
  recipientContext: z.string(),
  occasion: z.string(),
  budgetMax: z.number(), // 0 if not specified
  currency: z.string(),
  timingDeadline: z.string(), // "" if not specified
  giftStylePreference: z.enum(["practical", "sentimental", "mixed", "unknown"]),
  logistics: z.string(), // "" if not specified
  needFastOrAvailableTomorrow: z.boolean(),
  missingInfo: z.array(z.string()),
});
export type ExtractedConstraints = z.infer<typeof ExtractedConstraintsSchema>;

// --- Pipeline step 2: clarify output ---
export const ClarifyOutputSchema = z.object({
  shouldClarify: z.boolean(),
  question: z.string().optional(),
  options: z.array(z.string()).optional(),
});
export type ClarifyOutput = z.infer<typeof ClarifyOutputSchema>;

// --- Pipeline step 4: generate_ideas output ---
export const GeneratedIdeaSchema = z.object({
  title: z.string(),
  whyItFits: z.string(),
  priceDisplay: z.string(),
  acquisitionPaths: z.array(z.string()),
  bundleAddOn: z.string().optional(),
  catalogItemId: z.string().optional(),
});
export const GenerateIdeasOutputSchema = z.object({
  ideas: z.array(GeneratedIdeaSchema),
});
export type GeneratedIdea = z.infer<typeof GeneratedIdeaSchema>;
export type GenerateIdeasOutput = z.infer<typeof GenerateIdeasOutputSchema>;

// --- Pipeline step 5: rank_ideas output ---
export const RankedIdeaSchema = z.object({
  rank: z.number(),
  title: z.string(),
  whyItFits: z.string(),
  priceDisplay: z.string(),
  acquisitionPaths: z.array(z.string()),
  bundleAddOn: z.string().optional(),
  score: z.number(),
  rationale: z.string(),
  practicality: z.number(),
  emotionalImpact: z.number(),
  risk: z.number(),
  speed: z.number(),
});
export const RankIdeasOutputSchema = z.object({
  rankedIdeas: z.array(RankedIdeaSchema),
  rankingSignals: RankingSignalsSchema,
});
export type RankedIdea = z.infer<typeof RankedIdeaSchema>;
export type RankIdeasOutput = z.infer<typeof RankIdeasOutputSchema>;

// --- Pipeline step 6: compose_plan output (final GiftPlan) ---
export const ComposedCardSchema = z.object({
  rank: z.number(),
  title: z.string(),
  whyItFits: z.string(),
  price: z.string(),
  acquisitionPaths: z.array(z.string()),
  bundleAddOn: z.string().optional(),
  cardMessage: z.string(),
});
export const ComposePlanOutputSchema = z.object({
  headline: z.string(),
  cards: z.array(ComposedCardSchema),
  combos: z.array(z.string()).optional(),
  checklist: z.array(z.string()),
  finalNote: z.string(),
});
export type ComposePlanOutput = z.infer<typeof ComposePlanOutputSchema>;
