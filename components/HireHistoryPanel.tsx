"use client";

import { useState } from "react";

type HistoryEntry = {
  id: string;
  userName: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
};

function timeAgo(date: Date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function HireHistoryPanel({ history }: { history: HistoryEntry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <span>🕓</span>
          Edit History
          <span className="ml-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full px-1.5 py-0.5 text-xs font-medium">
            {history.length}
          </span>
        </span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-600 max-h-64 overflow-y-auto">
          {history.map((entry) => (
            <div key={entry.id} className="px-4 py-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{entry.userName}</span>
                  <span className="text-gray-500 dark:text-gray-400"> — {entry.action}</span>
                  {(entry.oldValue || entry.newValue) && (
                    <div className="mt-0.5 text-gray-400 dark:text-gray-500">
                      {entry.oldValue && (
                        <span className="line-through mr-1 text-red-400">{entry.oldValue}</span>
                      )}
                      {entry.newValue && (
                        <span className="text-green-600 dark:text-green-400">{entry.newValue}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                  {timeAgo(entry.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
