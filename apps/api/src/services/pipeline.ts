import { db } from "../db/client.js";
import { conversations, messages, runs, runSteps } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { runStructured, PROMPT_VERSION } from "./llm.js";
import { retrieveCandidates } from "./retrieval.js";
import {
  ExtractedConstraintsSchema,
  ClarifyOutputSchema,
  GenerateIdeasOutputSchema,
  RankIdeasOutputSchema,
  ComposePlanOutputSchema,
  type ExtractedConstraints,
  type ClarifyOutput,
  type GenerateIdeasOutput,
  type RankIdeasOutput,
  type ComposePlanOutput,
  type ConciergeRunResponse,
  type DecisionPanel,
  type GiftPlan,
  type RankingSignals,
} from "@giftops/shared";
import { nowMs, elapsedMs } from "../utils/time.js";
import type { GiftCatalogItem } from "../db/schema.js";

const FAST_MODEL = process.env.OPENAI_FAST_MODEL ?? "gpt-4o-mini";

const EXTRACT_SYSTEM = `You are a gift-constraint extractor. From the user's message, extract structured fields. Output valid JSON only.
- relationship: who is the recipient (e.g. sister, friend, mom)
- recipientContext: short description (e.g. "3 month old baby", "loves coffee")
- occasion: e.g. birthday, anniversary, baby shower
- budgetMax: number in the main currency; use 0 if not mentioned
- currency: e.g. USD
- timingDeadline: e.g. "tomorrow", "this weekend", or "" if not urgent
- giftStylePreference: practical | sentimental | mixed | unknown
- logistics: any delivery/pickup/same-day requirement or ""
- needFastOrAvailableTomorrow: true if user said today/tomorrow/this weekend/urgent/last minute
- missingInfo: list of crucial missing facts (e.g. "budget" if budgetMax is 0, "recipient" if unclear)`;

const CLARIFY_SYSTEM = `You decide if we must ask one clarifying question before recommending gifts. Only ask if crucial info is missing.
- shouldClarify: true only if we cannot make good recommendations (e.g. no budget at all, or recipient unknown).
- question: one short question.
- options: optional array of 2-4 quick choices if applicable.
Output valid JSON only.`;

const GENERATE_SYSTEM = `You expand catalog items into tailored gift ideas for the recipient. Stay within budget. For each idea provide:
- title: short gift name
- whyItFits: one sentence why it fits the recipient/occasion
- priceDisplay: e.g. "$25" or "$20-35"
- acquisitionPaths: how to get it (e.g. "Amazon same-day", "Target pickup", "Etsy digital")
- bundleAddOn: optional one-line bundle suggestion
- catalogItemId: optional, from the candidate if provided
Output JSON: { "ideas": [ ... ] }. Include 8-12 ideas.`;

const RANK_SYSTEM = `You rank up to 10 gift ideas by fit for the recipient.
For each idea, score 0-10 on: practicality, emotionalImpact, risk (lower = safer), and speed (how fast it can be obtained).
Return JSON: { "rankedIdeas": [ { rank, title, whyItFits, priceDisplay, acquisitionPaths, bundleAddOn?, score, rationale, practicality, emotionalImpact, risk, speed } ], "rankingSignals": { practicality, emotionalImpact, risk, speed } }.
Keep each rationale brief (1-2 sentences). For last-minute mode, prefer pickup/digital options and higher speed.`;

const COMPOSE_SYSTEM = `You turn ranked ideas into a final Gift Plan. Output JSON:
- headline: one short headline for the plan
- cards: 3-5 items, each with rank, title, whyItFits, price, acquisitionPaths, bundleAddOn?, cardMessage (short copy-paste message for the card)
- combos: optional array of 3 "ready-to-buy" combo suggestions (e.g. "Card 1 + Card 2 for under $60")
- checklist: 3-5 action items (time-based if last-minute)
- finalNote: one sentence closing
cardMessage must be a complete, warm sentence the giver can paste.`;

export async function runConciergePipeline(params: {
  conversationId: string | null;
  userMessage: string;
}): Promise<ConciergeRunResponse> {
  const { conversationId: existingId, userMessage } = params;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const convId = existingId
    ? existingId
    : (await db.insert(conversations).values({}).returning({ id: conversations.id }))[0].id;
  const [userMsg] = await db
    .insert(messages)
    .values({
      conversationId: convId,
      role: "user",
      content: userMessage,
    })
    .returning();

  const runStarted = nowMs();
  const [run] = await db
    .insert(runs)
    .values({
      conversationId: convId,
      userMessageId: userMsg.id,
      mode: "normal",
      model,
      promptVersion: PROMPT_VERSION,
    })
    .returning();

  const stepSummaries: { stepName: string; ms: number }[] = [];
  let constraints: ExtractedConstraints | null = null;
  let clarifyResult: ClarifyOutput | null = null;
  let candidates: GiftCatalogItem[] = [];
  let generated: GenerateIdeasOutput | null = null;
  let ranked: RankIdeasOutput | null = null;
  let composed: ComposePlanOutput | null = null;
  let nextAction: "ask_clarifying" | "present_recommendations" = "present_recommendations";
  let clarifyingQuestion: { question: string; options?: string[] } | undefined;
  let decisionPanel: DecisionPanel = {
    constraints: {},
    assumptions: [],
    mode: "normal",
    rankingSignals: { practicality: 5, emotionalImpact: 5, risk: 5, speed: 5 },
    safetyChecks: [],
  };

  try {
    // Step 1: extract
    const step1Start = nowMs();
    let extractOutput: unknown = null;
    try {
      const { data } = await runStructured({
        schemaName: "extract_constraints",
        schema: ExtractedConstraintsSchema,
        system: EXTRACT_SYSTEM,
        user: userMessage,
        modelOverride: FAST_MODEL,
      });
      constraints = data;
      extractOutput = data;
      const mode: "last_minute" | "normal" = data.needFastOrAvailableTomorrow ? "last_minute" : "normal";
      await db.update(runs).set({ mode }).where(eq(runs.id, run.id));
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await logStep(run.id, "extract", step1Start, { message: userMessage }, null, err);
      return await buildFallbackResponse(convId, run.id, runStarted, stepSummaries, err);
    }
    const step1Ms = elapsedMs(step1Start);
    stepSummaries.push({ stepName: "extract", ms: step1Ms });
    await logStep(run.id, "extract", step1Start, { message: userMessage }, extractOutput, null);

    if (!constraints) {
      return await buildFallbackResponse(convId, run.id, runStarted, stepSummaries, "No constraints");
    }

    decisionPanel.constraints = {
      relationship: constraints.relationship,
      recipientContext: constraints.recipientContext,
      occasion: constraints.occasion,
      budgetMax: constraints.budgetMax || "not specified",
      currency: constraints.currency,
      timingDeadline: constraints.timingDeadline || "none",
      giftStylePreference: constraints.giftStylePreference,
      needFastOrAvailableTomorrow: constraints.needFastOrAvailableTomorrow,
    };
    decisionPanel.mode = constraints.needFastOrAvailableTomorrow ? "last_minute" : "normal";
    decisionPanel.assumptions = [
      constraints.budgetMax ? `Budget up to ${constraints.currency} ${constraints.budgetMax}` : "No budget given; showing varied prices",
      constraints.recipientContext ? `Recipient: ${constraints.recipientContext}` : "Recipient context inferred",
    ];
    decisionPanel.safetyChecks = ["Budget respected", "Recipient-appropriate"];

    // Step 2: clarify (LLM only if crucial info truly missing)
    const step2Start = nowMs();
    const hasBudget = constraints.budgetMax > 0;
    const hasRelationship = constraints.relationship.trim().length > 0;
    const hasOccasion = constraints.occasion.trim().length > 0;

    if (hasBudget && hasRelationship && hasOccasion) {
      // We clearly have enough info; skip LLM clarify.
      clarifyResult = { shouldClarify: false };
      const step2Ms = elapsedMs(step2Start);
      stepSummaries.push({ stepName: "clarify", ms: step2Ms });
      await logStep(
        run.id,
        "clarify",
        step2Start,
        { constraints: decisionPanel.constraints, skipped: true },
        clarifyResult,
        null
      );
    } else {
      try {
        const { data } = await runStructured({
          schemaName: "clarify",
          schema: ClarifyOutputSchema,
          system: CLARIFY_SYSTEM,
          user: JSON.stringify({
            constraints: decisionPanel.constraints,
            missingInfo: constraints.missingInfo,
          }),
          modelOverride: FAST_MODEL,
        });
        clarifyResult = data;
        if (data.shouldClarify && data.question) {
          nextAction = "ask_clarifying";
          clarifyingQuestion = { question: data.question, options: data.options };
        }
      } catch {
        clarifyResult = { shouldClarify: false };
      }
      const step2Ms = elapsedMs(step2Start);
      stepSummaries.push({ stepName: "clarify", ms: step2Ms });
      await logStep(
        run.id,
        "clarify",
        step2Start,
        { constraints: decisionPanel.constraints },
        clarifyResult,
        null
      );
    }

    if (nextAction === "ask_clarifying") {
      await db.update(runs).set({ endedAt: new Date(), totalMs: elapsedMs(runStarted) }).where(eq(runs.id, run.id));
      return {
        conversationId: convId,
        runId: run.id,
        nextAction: "ask_clarifying",
        clarifyingQuestion,
        decisionPanel,
        traceSummary: { totalMs: elapsedMs(runStarted), steps: stepSummaries },
      };
    }

    // Step 3: retrieve
    const step3Start = nowMs();
    candidates = await retrieveCandidates(constraints);
    const step3Ms = elapsedMs(step3Start);
    stepSummaries.push({ stepName: "retrieve", ms: step3Ms });
    await logStep(
      run.id,
      "retrieve",
      step3Start,
      { constraints: decisionPanel.constraints },
      { count: candidates.length, ids: candidates.map((c) => c.id) },
      null
    );

    if (candidates.length === 0) {
      decisionPanel.assumptions.push("No catalog match; using general suggestions.");
    }

    // Step 4: generate
    const step4Start = nowMs();
    const candidatesForLlm = candidates.slice(0, 20).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      priceMin: c.priceMin,
      priceMax: c.priceMax,
      tags: c.tags,
      acquisitionTypes: c.acquisitionTypes,
    }));
    try {
      const { data } = await runStructured({
        schemaName: "generate_ideas",
        schema: GenerateIdeasOutputSchema,
        system: GENERATE_SYSTEM,
        user: JSON.stringify({
          constraints: decisionPanel.constraints,
          candidates: candidatesForLlm,
          budgetMax: constraints.budgetMax || 100,
          currency: constraints.currency,
        }),
      });
      generated = data;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await logStep(run.id, "generate", step4Start, { candidates: candidatesForLlm.length }, null, err);
      return await buildFallbackResponse(convId, run.id, runStarted, stepSummaries, err);
    }
    const step4Ms = elapsedMs(step4Start);
    stepSummaries.push({ stepName: "generate", ms: step4Ms });
    await logStep(run.id, "generate", step4Start, { candidates: candidatesForLlm.length }, generated, null);

    if (!generated || generated.ideas.length === 0) {
      return await buildFallbackResponse(convId, run.id, runStarted, stepSummaries, "No ideas generated");
    }

    // Step 5: rank
    const step5Start = nowMs();
    try {
      const { data } = await runStructured({
        schemaName: "rank_ideas",
        schema: RankIdeasOutputSchema,
        system: RANK_SYSTEM,
        user: JSON.stringify({
          constraints: decisionPanel.constraints,
          ideas: generated.ideas,
          lastMinute: constraints.needFastOrAvailableTomorrow,
        }),
        modelOverride: FAST_MODEL,
      });
      ranked = data;
      decisionPanel.rankingSignals = data.rankingSignals;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await logStep(run.id, "rank", step5Start, { ideaCount: generated.ideas.length }, null, err);
      return await buildFallbackResponse(convId, run.id, runStarted, stepSummaries, err);
    }
    const step5Ms = elapsedMs(step5Start);
    stepSummaries.push({ stepName: "rank", ms: step5Ms });
    await logStep(run.id, "rank", step5Start, { ideaCount: generated.ideas.length }, ranked, null);

    // Step 6: compose
    const step6Start = nowMs();
    const rankedIdeas = ranked?.rankedIdeas ?? [];
    try {
      const { data } = await runStructured({
        schemaName: "compose_plan",
        schema: ComposePlanOutputSchema,
        system: COMPOSE_SYSTEM,
        user: JSON.stringify({
          constraints: decisionPanel.constraints,
          rankedIdeas: rankedIdeas.slice(0, 10),
          lastMinute: constraints.needFastOrAvailableTomorrow,
        }),
      });
      composed = data;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await logStep(run.id, "compose", step6Start, { rankedCount: rankedIdeas.length }, null, err);
      return await buildFallbackResponse(convId, run.id, runStarted, stepSummaries, err);
    }
    const step6Ms = elapsedMs(step6Start);
    stepSummaries.push({ stepName: "compose", ms: step6Ms });
    await logStep(run.id, "compose", step6Start, { rankedCount: rankedIdeas.length }, composed, null);

    const totalMs = elapsedMs(runStarted);
    await db
      .update(runs)
      .set({ endedAt: new Date(), totalMs })
      .where(eq(runs.id, run.id));

    const giftPlan: GiftPlan = composed
      ? {
          headline: composed.headline,
          cards: composed.cards.map((c) => ({
            rank: c.rank,
            title: c.title,
            whyItFits: c.whyItFits,
            price: c.price,
            acquisitionPaths: c.acquisitionPaths,
            bundleAddOn: c.bundleAddOn,
            cardMessage: c.cardMessage,
          })),
          combos: composed.combos,
          checklist: composed.checklist,
          finalNote: composed.finalNote,
        }
      : undefined!;

    await db.insert(messages).values({
      conversationId: convId,
      role: "assistant",
      content: giftPlan?.headline ?? "Here are your gift recommendations.",
    });

    return {
      conversationId: convId,
      runId: run.id,
      nextAction: "present_recommendations",
      decisionPanel,
      giftPlan,
      traceSummary: { totalMs, steps: stepSummaries },
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return await buildFallbackResponse(convId, run.id, runStarted, stepSummaries, err);
  }
}

async function logStep(
  runId: string,
  stepName: "extract" | "clarify" | "retrieve" | "generate" | "rank" | "compose",
  startedAt: number,
  inputJson: unknown,
  outputJson: unknown,
  errorText: string | null
): Promise<void> {
  const endedAt = Date.now();
  const ms = endedAt - startedAt;
  await db.insert(runSteps).values({
    runId,
    stepName,
    startedAt: new Date(startedAt),
    endedAt: new Date(endedAt),
    ms,
    inputJson: inputJson as Record<string, unknown>,
    outputJson: outputJson as Record<string, unknown> | null,
    errorText,
  });
}

async function buildFallbackResponse(
  conversationId: string,
  runId: string,
  runStarted: number,
  stepSummaries: { stepName: string; ms: number }[],
  errorMessage: string
): Promise<ConciergeRunResponse> {
  await db.update(runs).set({ endedAt: new Date(), totalMs: Date.now() - runStarted }).where(eq(runs.id, runId));
  return {
    conversationId,
    runId,
    nextAction: "present_recommendations",
    decisionPanel: {
      constraints: {},
      assumptions: ["Pipeline encountered an issue; showing fallback."],
      mode: "normal",
      rankingSignals: { practicality: 5, emotionalImpact: 5, risk: 5, speed: 5 },
      safetyChecks: ["Error fallback", errorMessage],
    },
    giftPlan: {
      headline: "We hit a snag",
      cards: [
        {
          rank: 1,
          title: "Try again or refine your request",
          whyItFits: "The recommendation pipeline encountered an error.",
          price: "—",
          acquisitionPaths: ["Use a sample prompt or rephrase your message."],
          cardMessage: "Sorry we couldn't load recommendations this time. Please try again.",
        },
      ],
      combos: [],
      checklist: ["Check your message", "Try a sample prompt", "Refine budget or recipient"],
      finalNote: "If the problem persists, try a simpler request.",
    },
    traceSummary: { totalMs: Date.now() - runStarted, steps: stepSummaries },
  };
}
