import { db } from "../db/client.js";
import { giftCatalogItems } from "../db/schema.js";
import { and, lte, gte, eq } from "drizzle-orm";
import type { ExtractedConstraints } from "@giftops/shared";

const DEFAULT_BUDGET_CAP = 200;

/**
 * Deterministic retrieval: tag matching + urgencyCompatible + budget range.
 * Returns up to 20 candidates.
 */
export async function retrieveCandidates(
  constraints: ExtractedConstraints
): Promise<typeof giftCatalogItems.$inferSelect[]> {
  const budgetMax = constraints.budgetMax > 0 ? constraints.budgetMax : DEFAULT_BUDGET_CAP;
  const isLastMinute = constraints.needFastOrAvailableTomorrow;

  // Map gift style and context to tags we have in the catalog
  const preferredTags = constraintsToTags(constraints);

  const conditions = [
    lte(giftCatalogItems.priceMin, budgetMax),
    gte(giftCatalogItems.priceMax, 1),
  ];

  if (isLastMinute) {
    conditions.push(eq(giftCatalogItems.urgencyCompatible, true));
  }

  const rows = await db
    .select()
    .from(giftCatalogItems)
    .where(and(...conditions))
    .limit(80);

  // Score by tag overlap and optionally urgency; take top 20
  const scored = rows.map((row) => {
    const overlap = row.tags.filter((t) => preferredTags.includes(t)).length;
    const urgencyBonus = isLastMinute && row.urgencyCompatible ? 2 : 0;
    const score = overlap + urgencyBonus;
    return { row, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 20).map((s) => s.row);
  return top;
}

function constraintsToTags(constraints: ExtractedConstraints): string[] {
  const tags: string[] = [];
  const c = constraints.recipientContext.toLowerCase();
  const r = constraints.relationship.toLowerCase();
  const o = constraints.occasion.toLowerCase();

  if (
    c.includes("baby") ||
    c.includes("newborn") ||
    c.includes("parent") ||
    r.includes("sister") ||
    r.includes("brother")
  ) {
    if (c.includes("baby") || c.includes("newborn") || c.includes("parent")) tags.push("new_parent", "baby");
  }
  if (c.includes("coffee") || c.includes("tea") || c.includes("drink")) {
    tags.push("coffee", "tea");
  }
  if (
    constraints.giftStylePreference === "sentimental" ||
    c.includes("sentimental") ||
    o.includes("anniversary")
  ) {
    tags.push("sentimental", "keepsake");
  }
  if (
    constraints.giftStylePreference === "practical" ||
    c.includes("practical") ||
    c.includes("need")
  ) {
    tags.push("practical");
  }
  if (c.includes("self-care") || c.includes("relax") || c.includes("stress")) {
    tags.push("self_care", "wellness");
  }
  if (constraints.needFastOrAvailableTomorrow) {
    tags.push("digital", "last_minute", "flexible");
  }
  if (tags.length === 0) {
    tags.push("practical", "sentimental", "food", "self_care");
  }
  return tags;
}
