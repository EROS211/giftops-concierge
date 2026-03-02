import { useState, useEffect } from "react";

type RunStep = {
  id: string;
  stepName: string;
  startedAt: string;
  endedAt: string | null;
  ms: number | null;
  inputJson: unknown;
  outputJson: unknown;
  errorText: string | null;
};

type Run = {
  id: string;
  mode: string;
  model: string;
  totalMs: number | null;
  promptVersion: string;
};

type RunTrace = { run: Run; steps: RunStep[] };

type Props = {
  open: boolean;
  runTrace: RunTrace | null;
  onClose: () => void;
  runId: string | null;
  onLoad: (runId: string) => Promise<RunTrace>;
};

export function TraceDrawer({ open, runTrace, onClose, runId, onLoad }: Props) {
  const [data, setData] = useState<RunTrace | null>(runTrace ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !runId) return;
    setLoading(true);
    onLoad(runId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, runId, onLoad]);

  const trace = data ?? runTrace;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl ml-auto bg-white shadow-xl flex flex-col max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="font-display font-semibold text-lg">Run Trace</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-500 hover:text-stone-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading && <p className="text-sm text-stone-500">Loading trace...</p>}
          {!loading && trace && (
            <div className="space-y-4">
              <div className="text-sm">
                <p><strong>Run ID</strong> {trace.run.id}</p>
                <p><strong>Mode</strong> {trace.run.mode}</p>
                <p><strong>Model</strong> {trace.run.model}</p>
                <p><strong>Total ms</strong> {trace.run.totalMs ?? "—"}</p>
              </div>
              {trace.steps.map((step) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-stone-200 overflow-hidden"
                >
                  <div className="bg-stone-100 px-3 py-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{step.stepName}</span>
                    <span className="text-stone-500">{step.ms ?? "—"} ms</span>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div>
                      <p className="font-medium text-stone-500 uppercase mb-1">Input</p>
                      <pre className="bg-stone-50 p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(step.inputJson, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="font-medium text-stone-500 uppercase mb-1">Output</p>
                      <pre className="bg-stone-50 p-2 rounded overflow-auto max-h-40">
                        {step.outputJson != null
                          ? JSON.stringify(step.outputJson, null, 2)
                          : step.errorText ?? "—"}
                      </pre>
                    </div>
                    {step.errorText && (
                      <p className="text-red-600">Error: {step.errorText}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && !trace && <p className="text-sm text-stone-500">No trace data.</p>}
        </div>
      </div>
    </div>
  );
}
