import { Router } from "express";
import { db } from "../db/client.js";
import { conversations, messages } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";

export const conversationsRouter = Router();

conversationsRouter.get("/v1/conversations/:id", async (req, res) => {
  const { id } = req.params;
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (!conv) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  return res.json({ conversation: conv, messages: msgs });
});
