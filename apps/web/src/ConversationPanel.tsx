import { useState, useRef } from "react";
import type { ConciergeRunResponse } from "@giftops/shared";

type Props = {
  messages: { role: "user" | "assistant"; content: string; isClarificationAnswer?: boolean }[];
  loading: boolean;
  error: string | null;
  onSend: (message: string) => void;
  samplePrompts: string[];
  response: ConciergeRunResponse | null;
};

export function ConversationPanel({
  messages,
  loading,
  error,
  onSend,
  samplePrompts,
  response,
}: Props) {
  const [input, setInput] = useState("");
  const [showSamples, setShowSamples] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [clarifyInput, setClarifyInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput("");
    setShowSamples(false);
  };

  const handleSample = (text: string) => {
    setInput(text);
    setShowSamples(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-stone-200 flex items-center gap-2">
        <label className="text-sm font-medium text-stone-600">Sample prompts</label>
        <select
          className="flex-1 text-sm border border-stone-300 rounded-md px-2 py-1.5 bg-white text-stone-700"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) handleSample(v);
          }}
        >
          <option value="">Choose one...</option>
          {samplePrompts.map((p, i) => (
            <option key={i} value={p}>
              {p.slice(0, 50)}...
            </option>
          ))}
        </select>
      </div>
      <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-stone-500 italic">Send a gift request to get started.</p>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const isClarificationAnswer = isUser && m.isClarificationAnswer;
          const baseUserClasses = "ml-6";
          const baseAssistantClasses = "mr-6";
          const userBg = isClarificationAnswer ? "bg-amber-200 text-amber-900" : "bg-amber-50 text-amber-900";
          const assistantBg = "bg-stone-100 text-stone-800";
          return (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm ${
                isUser ? `${userBg} ${baseUserClasses}` : `${assistantBg} ${baseAssistantClasses}`
              }`}
            >
              <span className="font-medium text-stone-500 text-xs uppercase">
                {isClarificationAnswer ? "CLARIFICATION ANSWER" : m.role}
              </span>
              <p className="mt-0.5">{m.content}</p>
            </div>
          );
        })}
        {!loading && response?.nextAction === "ask_clarifying" && response.clarifyingQuestion && (
          <div className="rounded-lg px-3 py-2 text-sm bg-amber-100/80 border border-amber-300 shadow-sm">
            <p className="font-medium text-amber-900 text-xs uppercase tracking-wide">
              Clarification needed
            </p>
            <p className="mt-1">{response.clarifyingQuestion.question}</p>
            {response.clarifyingQuestion.options?.length ? (
              <ul className="mt-2 space-y-1">
                {response.clarifyingQuestion.options.map((opt, j) => (
                  <li key={j}>
                    <button
                      type="button"
                      className="text-amber-700 hover:underline"
                      onClick={() => onSend(opt)}
                    >
                      {opt}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 pt-2 border-t border-amber-200/60">
              <p className="text-xs text-amber-900 mb-1">Or type your own answer:</p>
              <div className="flex gap-2 items-end">
                <input
                  type="text"
                  value={clarifyInput}
                  onChange={(e) => setClarifyInput(e.target.value)}
                  className="flex-1 rounded-md border border-amber-300 px-2 py-1.5 text-xs focus:ring-2 focus:ring-amber-400 focus:border-amber-500 outline-none bg-white"
                  placeholder="Describe it in your own words..."
                  disabled={loading}
                />
                <button
                  type="button"
                  className="rounded-md bg-amber-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || !clarifyInput.trim()}
                  onClick={() => {
                    const v = clarifyInput.trim();
                    if (!v) return;
                    onSend(v);
                    setClarifyInput("");
                  }}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
        {loading && (
          <div className="rounded-lg px-3 py-2 text-sm bg-stone-100 text-stone-600">
            Running pipeline...
          </div>
        )}
        {error && (
          <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-800">{error}</div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-3 border-t border-stone-200">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your gift request..."
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-500 outline-none min-h-[3rem] max-h-32 resize-y disabled:bg-stone-100"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Run
          </button>
        </div>
      </form>
    </div>
  );
}
