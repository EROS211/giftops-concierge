import type { ConciergeRunRequest, ConciergeRunResponse } from "@giftops/shared";

const API = "/v1";

export type RunStep = {
  id: string;
  stepName: string;
  startedAt: string;
  endedAt: string | null;
  ms: number | null;
  inputJson: unknown;
  outputJson: unknown;
  errorText: string | null;
};

export type Run = {
  id: string;
  mode: string;
  model: string;
  totalMs: number | null;
  promptVersion: string;
};

export type RunTrace = { run: Run; steps: RunStep[] };

export async function runConcierge(body: ConciergeRunRequest): Promise<ConciergeRunResponse> {
  const res = await fetch(`${API}/concierge/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getRun(runId: string): Promise<RunTrace> {
  const res = await fetch(`${API}/runs/${runId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<RunTrace>;
}

export async function getConversation(id: string): Promise<{ conversation: unknown; messages: unknown[] }> {
  const res = await fetch(`${API}/conversations/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
