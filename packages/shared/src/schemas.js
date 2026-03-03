"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComposePlanOutputSchema = exports.ComposedCardSchema = exports.RankIdeasOutputSchema = exports.RankedIdeaSchema = exports.GenerateIdeasOutputSchema = exports.GeneratedIdeaSchema = exports.ClarifyOutputSchema = exports.ExtractedConstraintsSchema = exports.ConciergeRunResponseSchema = exports.TraceSummarySchema = exports.TraceStepSummarySchema = exports.GiftPlanSchema = exports.GiftCardSchema = exports.DecisionPanelSchema = exports.RankingSignalsSchema = exports.ConciergeRunRequestSchema = void 0;
const zod_1 = require("zod");
// --- Concierge API ---
exports.ConciergeRunRequestSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid().optional(),
    message: zod_1.z.string().min(1).max(2000),
});
exports.RankingSignalsSchema = zod_1.z.object({
    practicality: zod_1.z.number(),
    emotionalImpact: zod_1.z.number(),
    risk: zod_1.z.number(),
    speed: zod_1.z.number(),
});
exports.DecisionPanelSchema = zod_1.z.object({
    constraints: zod_1.z.record(zod_1.z.unknown()),
    assumptions: zod_1.z.array(zod_1.z.string()),
    mode: zod_1.z.enum(["last_minute", "normal"]),
    rankingSignals: exports.RankingSignalsSchema,
    safetyChecks: zod_1.z.array(zod_1.z.string()),
});
exports.GiftCardSchema = zod_1.z.object({
    rank: zod_1.z.number(),
    title: zod_1.z.string(),
    whyItFits: zod_1.z.string(),
    price: zod_1.z.string(),
    acquisitionPaths: zod_1.z.array(zod_1.z.string()),
    bundleAddOn: zod_1.z.string().optional(),
    cardMessage: zod_1.z.string(),
});
exports.GiftPlanSchema = zod_1.z.object({
    headline: zod_1.z.string(),
    cards: zod_1.z.array(exports.GiftCardSchema),
    combos: zod_1.z.array(zod_1.z.string()).optional(),
    checklist: zod_1.z.array(zod_1.z.string()),
    finalNote: zod_1.z.string(),
});
exports.TraceStepSummarySchema = zod_1.z.object({
    stepName: zod_1.z.string(),
    ms: zod_1.z.number(),
});
exports.TraceSummarySchema = zod_1.z.object({
    totalMs: zod_1.z.number(),
    steps: zod_1.z.array(exports.TraceStepSummarySchema),
});
exports.ConciergeRunResponseSchema = zod_1.z.object({
    conversationId: zod_1.z.string().uuid(),
    runId: zod_1.z.string().uuid(),
    nextAction: zod_1.z.enum(["ask_clarifying", "present_recommendations"]),
    clarifyingQuestion: zod_1.z
        .object({
        question: zod_1.z.string(),
        options: zod_1.z.array(zod_1.z.string()).optional(),
    })
        .optional(),
    decisionPanel: exports.DecisionPanelSchema,
    giftPlan: exports.GiftPlanSchema.optional(),
    traceSummary: exports.TraceSummarySchema,
});
// --- Pipeline step 1: extract_constraints output ---
// budgetMax: 0 means not specified; timingDeadline/logistics: "" means not specified
exports.ExtractedConstraintsSchema = zod_1.z.object({
    relationship: zod_1.z.string(),
    recipientContext: zod_1.z.string(),
    occasion: zod_1.z.string(),
    budgetMax: zod_1.z.number(), // 0 if not specified
    currency: zod_1.z.string(),
    timingDeadline: zod_1.z.string(), // "" if not specified
    giftStylePreference: zod_1.z.enum(["practical", "sentimental", "mixed", "unknown"]),
    logistics: zod_1.z.string(), // "" if not specified
    needFastOrAvailableTomorrow: zod_1.z.boolean(),
    missingInfo: zod_1.z.array(zod_1.z.string()),
});
// --- Pipeline step 2: clarify output ---
exports.ClarifyOutputSchema = zod_1.z.object({
    shouldClarify: zod_1.z.boolean(),
    question: zod_1.z.string().optional(),
    options: zod_1.z.array(zod_1.z.string()).optional(),
});
// --- Pipeline step 4: generate_ideas output ---
exports.GeneratedIdeaSchema = zod_1.z.object({
    title: zod_1.z.string(),
    whyItFits: zod_1.z.string(),
    priceDisplay: zod_1.z.string(),
    acquisitionPaths: zod_1.z.array(zod_1.z.string()),
    bundleAddOn: zod_1.z.string().optional(),
    catalogItemId: zod_1.z.string().optional(),
});
exports.GenerateIdeasOutputSchema = zod_1.z.object({
    ideas: zod_1.z.array(exports.GeneratedIdeaSchema),
});
// --- Pipeline step 5: rank_ideas output ---
exports.RankedIdeaSchema = zod_1.z.object({
    rank: zod_1.z.number(),
    title: zod_1.z.string(),
    whyItFits: zod_1.z.string(),
    priceDisplay: zod_1.z.string(),
    acquisitionPaths: zod_1.z.array(zod_1.z.string()),
    bundleAddOn: zod_1.z.string().optional(),
    score: zod_1.z.number(),
    rationale: zod_1.z.string(),
    practicality: zod_1.z.number(),
    emotionalImpact: zod_1.z.number(),
    risk: zod_1.z.number(),
    speed: zod_1.z.number(),
});
exports.RankIdeasOutputSchema = zod_1.z.object({
    rankedIdeas: zod_1.z.array(exports.RankedIdeaSchema),
    rankingSignals: exports.RankingSignalsSchema,
});
// --- Pipeline step 6: compose_plan output (final GiftPlan) ---
exports.ComposedCardSchema = zod_1.z.object({
    rank: zod_1.z.number(),
    title: zod_1.z.string(),
    whyItFits: zod_1.z.string(),
    price: zod_1.z.string(),
    acquisitionPaths: zod_1.z.array(zod_1.z.string()),
    bundleAddOn: zod_1.z.string().optional(),
    cardMessage: zod_1.z.string(),
});
exports.ComposePlanOutputSchema = zod_1.z.object({
    headline: zod_1.z.string(),
    cards: zod_1.z.array(exports.ComposedCardSchema),
    combos: zod_1.z.array(zod_1.z.string()).optional(),
    checklist: zod_1.z.array(zod_1.z.string()),
    finalNote: zod_1.z.string(),
});
