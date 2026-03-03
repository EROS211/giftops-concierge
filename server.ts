/**
 * Vercel Express entry: re-exports the API app so Vercel runs it as a serverless function.
 * Requires apps/api to be built first (apps/api/dist/server.js).
 */
import app from "./apps/api/dist/server.js";
export default app;
