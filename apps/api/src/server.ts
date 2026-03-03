import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { conciergeRouter } from "./routes/concierge.js";
import { runsRouter } from "./routes/runs.js";
import { conversationsRouter } from "./routes/conversations.js";

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json());

app.use(conciergeRouter);
app.use(runsRouter);
app.use(conversationsRouter);

// Only listen when not on Vercel (serverless handles requests)
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3001;
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

export default app;
