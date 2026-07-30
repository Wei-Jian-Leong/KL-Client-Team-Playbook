"use client";

import { useState } from "react";

type HireInfo = { name: string; email: string | null; posId: string | null };

export default function GdBriefingButton({
  waveNumber,
  batch,
}: {
  waveNumber: number;
  batch: HireInfo[];
}) {
  const [copied, setCopied] = useState(false);

  function buildBriefing() {
    const lines = batch.map(
      (h) => `${h.name} | POS ID: ${h.posId || "TBC"} | Email: ${h.email || "TBC"}`
    );
    return `Wave ${waveNumber} — GD Briefing\nNew Hires: ${batch.length}\n${lines.join("\n")}`;
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildBriefing());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-4 py-2 rounded-xl transition-colors font-medium"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      {copied ? "Copied!" : `Copy GD Briefing (Wave ${waveNumber})`}
    </button>
  );
}
