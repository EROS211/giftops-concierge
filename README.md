# GiftOps Concierge

Production-quality prototype of an AI agent pipeline for gift recommendations: **extract → clarify → generate → rank → compose**, with observability and a decision-quality UI.

## Features

- **Structured Gift Plan**: Ranked gift cards with acquisition paths, bundles, and copy-paste card messages.
- **Why these gifts**: Side panel with detected constraints, assumptions, mode (last-minute vs normal), ranking signals, and safety checks.
- **Run Trace**: Drawer showing each pipeline step's input/output and latency (stored in DB).

## Tech stack

- **Monorepo**: pnpm workspaces
- **apps/api**: Node + Express + TypeScript, zod, CORS, helmet, dotenv
- **apps/web**: React + TypeScript + Vite, Tailwind
- **packages/shared**: Shared TS types and zod schemas
- **Postgres**: docker-compose + Drizzle ORM (Postgres exposed on host port **5433** by default)
- **OpenAI**: Official Node SDK with structured outputs (json_schema)

## Approach

GiftOps Concierge is built as a **slot-filling, multi-step agent pipeline** instead of a single chat completion:

- **Extract**: an LLM with strict JSON Schema interprets the user’s natural-language request into structured constraints (relationship, occasion, budget, timing, style, missing info).
- **Clarify**: if crucial constraints are missing, a small LLM step asks **focused clarifying questions**, and the UI lets the user answer via buttons or free-text.
- **Retrieve**: a deterministic retrieval layer queries the local `gift_catalog_items` table using tags, budget, and urgency, and maps matches into normalized candidates.
- **Generate & Rank**: LLM steps transform candidates into tailored ideas and score them on practicality, emotional impact, risk, and speed; mode (last-minute vs normal) biases ranking.
- **Compose**: a final LLM step returns a structured Gift Plan (cards, combos, checklist, card messages) plus decision metadata that powers the **Why these gifts** panel.

Every run and sub-step is written to Postgres (`runs`, `run_steps`), and the web UI can display a **Run Trace** (inputs, outputs, latency) for debugging and product decisions.

### Why this is a good practice

- **Debuggability over magic**: breaking the flow into small, typed steps (extract/clarify/retrieve/generate/rank/compose) makes failures visible and traceable instead of hiding them inside one giant prompt.
- **Deterministic retrieval**: using Postgres + Drizzle for candidate retrieval keeps prices, tags, and availability under your control, while the LLM focuses on personalization and ranking.
- **Safer LLM use**: strict JSON schemas and Zod validation around each model call reduce malformed outputs and make it clear which fields are model- vs system-controlled.
- **Decision-quality UX**: the decision panel and Run Trace expose constraints, assumptions, ranking signals, and errors so product and ops teams can understand *why* a recommendation was made.
- **Extensibility**: the retrieval layer and pipeline steps are explicit, so adding new sources (e.g. external APIs) or new constraints (e.g. location, dietary needs) doesn’t require redesigning the system.

## Prerequisites

- Node 18+
- pnpm (`npm install -g pnpm`)
- Docker (for Postgres)

## Setup

1. **Clone and install**

   ```bash
   cd conciergeOS
   pnpm install
   ```

2. **Start Postgres**

   ```bash
   docker-compose up -d
   ```

3. **Environment**

Copy `apps/api/.env.example` to `apps/api/.env` and set:

- `DATABASE_URL=postgresql://giftops:giftops@localhost:5433/giftops` (matches `docker-compose.yml`)
- `OPENAI_API_KEY=sk-your-key`
- `OPENAI_MODEL=gpt-4o-mini` (or another model that supports structured outputs)
- `PORT=3001` (optional)

4. **Database**

   ```bash
   pnpm db:push
   pnpm db:seed
   ```

5. **Build shared package** (needed for api/web)

   ```bash
   pnpm build
   ```

6. **Run dev** (API + web concurrently)

   ```bash
   pnpm dev
   ```

   - API: http://localhost:3001  
   - Web: http://localhost:5173  

## 90-second demo script

1. **Start** (0:00): Open http://localhost:5173. Ensure API and Postgres are running.
2. **Sample prompt** (0:10): From the "Sample prompts" dropdown, choose:  
   *"My sister has a 3 month old baby and tomorrow is her birthday. Budget $50."*  
   Click **Run**.
3. **Gift Plan** (0:25): In the center, confirm 3–5 ranked cards with titles, why it fits, price, acquisition paths, and a copy-paste card message. Scroll to see checklist and final note.
4. **Why these gifts** (0:40): In the right panel, confirm **Constraints** (relationship, recipient, occasion, budget, mode), **Assumptions**, **Mode** (last_minute), **Ranking signals** (practicality, emotionalImpact, risk, speed), and **Safety checks**.
5. **Run Trace** (0:55): Click **Run Trace** in the header. In the drawer, confirm steps: extract → clarify → retrieve → generate → rank → compose, each with input JSON, output JSON, and latency (ms).
6. **Refine** (1:20): Click **More sentimental** (or **Cheaper** / **Available by tomorrow**). Run again and confirm a new plan and updated trace.

## API

- `POST /v1/concierge/run` — Body: `{ conversationId?: string, message: string }`. Returns full run response (conversationId, runId, nextAction, clarifyingQuestion?, decisionPanel, giftPlan?, traceSummary).
- `GET /v1/runs/:runId` — Returns run + run_steps.
- `GET /v1/conversations/:id` — Returns conversation + messages.

## Project layout

```
/
  apps/
    api/          # Express API, pipeline, Drizzle, OpenAI
    web/          # React + Vite + Tailwind
  packages/
    shared/       # Zod schemas and types
  docker-compose.yml
  pnpm-workspace.yaml
```

## Deploy (Vercel – web app)

To avoid **404 NOT_FOUND**, deploy from the **repository root** so the root `vercel.json` is used. It runs `pnpm --filter web build` and sets **Output Directory** to `apps/web/dist`. Do **not** set Vercel’s Root Directory to `apps/web` when using the root `vercel.json`; leave it at the repo root.

- **Root Directory**: leave empty (repo root).
- **Build Command** / **Output Directory**: overridden by root `vercel.json` (builds web, outputs `apps/web/dist`).

The API is not deployed by this config; host it elsewhere (e.g. Railway, Render) and point the web app at that API URL if needed.

## Pipeline steps (all logged to run_steps)

1. **extract** — From message → constraints (relationship, recipient, occasion, budget, timing, style, missingInfo).
2. **clarify** — If crucial info missing → one clarifying question; else continue.
3. **retrieve** — Deterministic: tag + urgency + budget filter → top 20 catalog candidates.
4. **generate** — LLM expands candidates into tailored ideas (acquisition paths, bundles).
5. **rank** — LLM scores by practicality, emotionalImpact, risk, speed; last-minute favors speed/pickup/digital.
6. **compose** — LLM produces final Gift Plan (headline, 3–5 cards, combos, checklist, card messages).

Errors in any step are logged to `run_steps.errorText`; the API returns a safe fallback response instead of crashing.
