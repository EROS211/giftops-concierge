import type { ConciergeRunResponse } from "@giftops/shared";

type Props = { response: ConciergeRunResponse | null };

export function DecisionPanel({ response }: Props) {
  if (!response) {
    return (
      <div className="p-4 text-stone-500 text-sm">
        <h3 className="font-semibold text-stone-700 mb-2">Why these gifts</h3>
        Run a request to see constraints, assumptions, and ranking signals.
      </div>
    );
  }

  const { decisionPanel } = response;
  const constraints = decisionPanel.constraints as Record<string, unknown>;
  const signals = decisionPanel.rankingSignals;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <h3 className="font-display font-semibold text-stone-800 p-4 border-b border-stone-200">
        Why these gifts
      </h3>
      <div className="flex-1 overflow-auto p-4 space-y-4 text-sm">
        <section>
          <h4 className="font-medium text-stone-600 uppercase text-xs mb-2">Constraints</h4>
          <dl className="space-y-1">
            {Object.entries(constraints).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="text-stone-500 shrink-0">{key}:</dt>
                <dd className="text-stone-800">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h4 className="font-medium text-stone-600 uppercase text-xs mb-2">Assumptions</h4>
          <ul className="list-disc list-inside text-stone-700 space-y-0.5">
            {decisionPanel.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="font-medium text-stone-600 uppercase text-xs mb-2">Mode</h4>
          <p className="text-stone-800">
            {decisionPanel.mode === "last_minute" ? "Last minute" : "Normal"}
          </p>
        </section>
        <section>
          <h4 className="font-medium text-stone-600 uppercase text-xs mb-2">Ranking signals</h4>
          <ul className="space-y-1">
            <li>Practicality: {signals.practicality}</li>
            <li>Emotional impact: {signals.emotionalImpact}</li>
            <li>Risk: {signals.risk}</li>
            <li>Speed: {signals.speed}</li>
          </ul>
        </section>
        <section>
          <h4 className="font-medium text-stone-600 uppercase text-xs mb-2">Safety checks</h4>
          <ul className="list-disc list-inside text-stone-700 space-y-0.5">
            {decisionPanel.safetyChecks.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
