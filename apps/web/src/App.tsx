import { useState, useCallback } from "react";
import { runConcierge, getRun } from "./api";
import type { ConciergeRunResponse } from "@giftops/shared";
import { ConversationPanel } from "./ConversationPanel";
import { GiftPlanView } from "./GiftPlanView";
import { DecisionPanel } from "./DecisionPanel";
import { TraceDrawer } from "./TraceDrawer";

const SAMPLE_PROMPTS = [
  "My sister has a 3 month old baby and tomorrow is her birthday. Budget $50.",
  "Friend who loves coffee and tea, no specific occasion, around $30.",
  "Mom's anniversary, she likes sentimental keepsakes. Budget $75.",
  "Colleague retiring, practical and professional. Under $40.",
  "Best friend's birthday next week—something fun and self-care. $50 max.",
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  isClarificationAnswer?: boolean;
};

export default function App() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [response, setResponse] = useState<ConciergeRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traceRunId, setTraceRunId] = useState<string | null>(null);
  const [traceDrawerOpen, setTraceDrawerOpen] = useState(false);

  const sendMessage = useCallback(
    async (message: string, isRefine?: boolean) => {
      setLoading(true);
      setError(null);

      const userMessages = messages.filter((m) => m.role === "user");
      const firstUserMessage = userMessages[0]?.content ?? "";
      const lastUserMessage = userMessages.slice(-1)[0]?.content ?? "";
      const isClarifying = response?.nextAction === "ask_clarifying";
      const refine = isRefine ?? false;
      const clarificationAnswers = userMessages
        .filter((m) => m.isClarificationAnswer)
        .map((m) => m.content);

      let combinedMessage: string;
      if (refine && firstUserMessage) {
        // Refine = same recipient/occasion/budget, just change preference.
        combinedMessage = `${firstUserMessage}\n\nAdditional preference: ${message}`;
      } else if (isClarifying && firstUserMessage) {
        // Always keep the original natural-language request and accumulate
        // all clarification answers so multiple clarifications don't lose context.
        const allAnswers = [...clarificationAnswers, message];
        const answersText = allAnswers.join("; ");
        combinedMessage = `${firstUserMessage}\n\nClarification answers: ${answersText}`;
      } else {
        combinedMessage = message;
      }

      setMessages((prev) => [
        ...prev,
        { role: "user", content: message, isClarificationAnswer: isClarifying },
      ]);
      try {
        const result = await runConcierge({
          conversationId: conversationId ?? undefined,
          message: combinedMessage,
        });
        setConversationId(result.conversationId);
        setResponse(result);
        setTraceRunId(result.runId);
        if (result.nextAction === "present_recommendations" && result.giftPlan) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.giftPlan!.headline },
          ]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setLoading(false);
      }
    },
    [conversationId, messages, response]
  );

  const openTrace = useCallback(() => {
    if (traceRunId) setTraceDrawerOpen(true);
  }, [traceRunId]);

  const closeTrace = useCallback(() => setTraceDrawerOpen(false), []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur px-4 py-3 flex items-center justify-between">
        <h1 className="font-display font-semibold text-xl text-stone-800">GiftOps Concierge</h1>
        {traceRunId && (
          <button
            type="button"
            onClick={openTrace}
            className="text-sm text-amber-700 hover:text-amber-800 font-medium"
          >
            Run Trace
          </button>
        )}
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-0">
        <aside className="lg:col-span-4 border-r border-stone-200 bg-white flex flex-col overflow-hidden">
          <ConversationPanel
            messages={messages}
            loading={loading}
            error={error}
            onSend={sendMessage}
            samplePrompts={SAMPLE_PROMPTS}
            response={response}
          />
        </aside>
        <main className="lg:col-span-5 flex flex-col overflow-auto bg-stone-50/50 p-4">
          <GiftPlanView response={response} onRefine={sendMessage} />
        </main>
        <aside className="lg:col-span-3 border-l border-stone-200 bg-white flex flex-col overflow-hidden">
          <DecisionPanel response={response} />
        </aside>
      </div>

      <TraceDrawer
        open={traceDrawerOpen}
        runTrace={null}
        onClose={closeTrace}
        runId={traceRunId}
        onLoad={getRun}
      />
    </div>
  );
}
