import { Router } from "express";
import { ConciergeRunRequestSchema } from "@giftops/shared";
import { runConciergePipeline } from "../services/pipeline.js";

export const conciergeRouter = Router();

conciergeRouter.post("/v1/concierge/run", async (req, res) => {
  try {
    const parsed = ConciergeRunRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { conversationId, message } = parsed.data;
    const result = await runConciergePipeline({
      conversationId: conversationId ?? null,
      userMessage: message,
    });
    return res.json(result);
  } catch (e) {
    console.error("Concierge run error:", e);
    return res.status(500).json({
      error: "Pipeline failed",
      message: e instanceof Error ? e.message : "Unknown error",
    });
  }
});
