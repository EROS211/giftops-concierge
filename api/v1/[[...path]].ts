/**
 * Vercel serverless handler for /api/v1/* — forwards to the Express app with path /v1/*
 * so the app sees /v1/concierge/run, /v1/runs/:id, etc.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { default: app } = await import("../../apps/api/dist/server.js");
  const origUrl = req.url ?? "/";
  (req as NodeJS.IncomingMessage & { url: string }).url = origUrl.replace(/^\/api/, "") || "/";
  return new Promise<void>((resolve) => {
    app(req as any, res);
    res.on("finish", resolve);
  });
}
