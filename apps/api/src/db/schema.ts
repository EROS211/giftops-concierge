import {
  pgTable,
  uuid,
  timestamp,
  text,
  jsonb,
  boolean,
  integer,
  real,
} from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userMessageId: uuid("user_message_id").references(() => messages.id),
  mode: text("mode", { enum: ["last_minute", "normal"] }).notNull(),
  model: text("model").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  totalMs: integer("total_ms"),
  tokensApprox: integer("tokens_approx"),
  promptVersion: text("prompt_version").notNull(),
});

export const runSteps = pgTable("run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  stepName: text("step_name", {
    enum: ["extract", "clarify", "retrieve", "generate", "rank", "compose"],
  }).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  ms: integer("ms"),
  inputJson: jsonb("input_json"),
  outputJson: jsonb("output_json"),
  errorText: text("error_text"),
});

export const giftCatalogItems = pgTable("gift_catalog_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priceMin: real("price_min").notNull(),
  priceMax: real("price_max").notNull(),
  tags: text("tags").array().notNull(),
  urgencyCompatible: boolean("urgency_compatible").notNull().default(false),
  acquisitionTypes: text("acquisition_types").array().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunStep = typeof runSteps.$inferSelect;
export type GiftCatalogItem = typeof giftCatalogItems.$inferSelect;
export type NewGiftCatalogItem = typeof giftCatalogItems.$inferInsert;
