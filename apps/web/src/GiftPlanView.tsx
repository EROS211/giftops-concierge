import type { ConciergeRunResponse } from "@giftops/shared";

type Props = {
  response: ConciergeRunResponse | null;
  onRefine: (message: string, isRefine?: boolean) => void;
};

const REFINE_OPTIONS = [
  { label: "Cheaper", message: "Suggest cheaper options within the same style." },
  { label: "More sentimental", message: "I want something more sentimental and personal." },
  { label: "Available by tomorrow", message: "I need options I can get by tomorrow." },
  { label: "Regenerate", message: "Regenerate different gift ideas for the same request." },
];

export function GiftPlanView({ response, onRefine }: Props) {
  const plan = response?.giftPlan;
  if (!response) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-500 text-sm">
        Run a request to see your Gift Plan here.
      </div>
    );
  }
  if (response.nextAction === "ask_clarifying") {
    return (
      <div className="flex items-center justify-center h-64 text-stone-600 text-sm">
        Answer the clarification above to get recommendations.
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-500 text-sm">
        No gift plan in this response.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display font-semibold text-xl text-stone-800">{plan.headline}</h2>
      <div className="grid gap-4">
        {plan.cards.map((card) => (
          <div
            key={card.rank}
            className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-amber-600">#{card.rank}</span>
                <h3 className="font-semibold text-stone-800 mt-0.5">{card.title}</h3>
                <p className="text-sm text-stone-600 mt-1">{card.whyItFits}</p>
                <p className="text-sm font-medium text-stone-700 mt-1">{card.price}</p>
                <ul className="text-xs text-stone-500 mt-1 space-y-0.5">
                  {card.acquisitionPaths.map((path, i) => (
                    <li key={i}>• {path}</li>
                  ))}
                </ul>
                {card.bundleAddOn && (
                  <p className="text-xs text-amber-700 mt-1">+ {card.bundleAddOn}</p>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-stone-100">
              <p className="text-xs text-stone-500 uppercase font-medium">Card message</p>
              <p className="text-sm text-stone-700 mt-0.5 italic">&ldquo;{card.cardMessage}&rdquo;</p>
            </div>
          </div>
        ))}
      </div>
      {plan.combos && plan.combos.length > 0 && (
        <div className="bg-stone-100 rounded-xl border border-stone-200 p-4">
          <h3 className="font-medium text-stone-800 text-sm">Ready-to-buy combos</h3>
          <ul className="mt-2 space-y-1 text-sm text-stone-700">
            {plan.combos.map((combo, i) => (
              <li key={i}>• {combo}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.checklist.length > 0 && (
        <div className="bg-amber-50/50 rounded-xl border border-amber-100 p-4">
          <h3 className="font-medium text-amber-900 text-sm">Checklist</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {plan.checklist.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-amber-600">◦</span> {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.finalNote && (
        <p className="text-sm text-stone-600 italic">{plan.finalNote}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {REFINE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onRefine(opt.message, true)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
