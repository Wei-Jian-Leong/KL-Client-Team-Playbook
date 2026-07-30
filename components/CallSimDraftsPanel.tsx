"use client";

import { useState, useTransition } from "react";
import { marked } from "marked";
import { discardDraft } from "@/app/actions/call-sim";
import type { CallSimDraft } from "@/lib/call-sim-drafts";

const TYPE_LABELS: Record<string, string> = {
  draft: "SOP Draft",
  simulation: "Simulation",
  quiz: "Quiz",
  "edge-case": "Edge Case",
};

const TYPE_COLORS: Record<string, string> = {
  draft: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  simulation: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  quiz: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "edge-case": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function scenarioLabel(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function groupByScenario(drafts: CallSimDraft[]) {
  const groups: Record<string, CallSimDraft[]> = {};
  for (const d of drafts) {
    if (!groups[d.scenario]) groups[d.scenario] = [];
    groups[d.scenario].push(d);
  }
  return groups;
}

export default function CallSimDraftsPanel({ drafts: initial }: { drafts: CallSimDraft[] }) {
  const [drafts, setDrafts] = useState(initial);
  const [selected, setSelected] = useState<CallSimDraft | null>(null);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function showFlash(msg: string, ok: boolean) {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  }

  function handleDiscard(draft: CallSimDraft) {
    if (!confirm(`Discard "${draft.filename}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await discardDraft(draft.filename);
      if (res.success) {
        setDrafts(prev => prev.filter(d => d.filename !== draft.filename));
        if (selected?.filename === draft.filename) setSelected(null);
        showFlash("Draft discarded.", true);
      } else {
        showFlash(res.error || "Failed to discard.", false);
      }
    });
  }

  const groups = groupByScenario(drafts);
  const scenarios = Object.keys(groups).sort();

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[500px]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
        {flash && (
          <div className={`px-3 py-2 rounded-lg text-sm font-medium ${flash.ok ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
            {flash.msg}
          </div>
        )}

        {drafts.length === 0 && (
          <div className="text-gray-400 dark:text-gray-500 text-sm text-center mt-8">
            No drafts found in call-sim-kb/
          </div>
        )}

        {scenarios.map(scenario => (
          <div key={scenario} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                {scenarioLabel(scenario)}
              </p>
              {groups[scenario][0]?.date && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {groups[scenario][0].date.slice(0, 10)}
                </p>
              )}
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {groups[scenario].map(draft => (
                <button
                  key={draft.filename}
                  onClick={() => setSelected(draft)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selected?.filename === draft.filename ? "bg-indigo-50 dark:bg-indigo-900/20" : ""}`}
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${TYPE_COLORS[draft.type]}`}>
                    {TYPE_LABELS[draft.type]}
                  </span>
                  {draft.restaurant && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{draft.restaurant.split(" (")[0]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Preview pane */}
      <div className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden flex flex-col">
        {selected ? (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[selected.type]}`}>
                    {TYPE_LABELS[selected.type]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selected.complexity === "edge" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                    {selected.complexity === "edge" ? "Edge Case" : "General Case"}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {scenarioLabel(selected.scenario)}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {[selected.restaurant, selected.caller, selected.date?.slice(0, 10)].filter(Boolean).join(" · ")}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selected.type === "draft" && (
                  <a
                    href="/knowledge"
                    target="_blank"
                    className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Publish →
                  </a>
                )}
                <button
                  onClick={() => handleDiscard(selected)}
                  disabled={isPending}
                  className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Discard
                </button>
              </div>
            </div>

            {/* Markdown content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div
                className="rte-content text-sm text-gray-800 dark:text-gray-200"
                dangerouslySetInnerHTML={{ __html: marked.parse(selected.content) as string }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            Select a draft to preview
          </div>
        )}
      </div>
    </div>
  );
}
