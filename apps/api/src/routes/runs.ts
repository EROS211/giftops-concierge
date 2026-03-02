import { Router } from "express";
import { db } from "../db/client.js";
import { runs, runSteps } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

export const runsRouter = Router();

runsRouter.get("/v1/runs/:runId", async (req, res) => {
  const { runId } = req.params;
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) {
    return res.status(404).json({ error: "Run not found" });
  }
  const steps = await db
    .select()
    .from(runSteps)
    .where(eq(runSteps.runId, runId))
    .orderBy(runSteps.startedAt);
  return res.json({ run, steps });
});
