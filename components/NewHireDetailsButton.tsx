"use client";

import { useState } from "react";

type HireInfo = { name: string; bambooEid: string; posId: string | null };

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export default function NewHireDetailsButton({
  waveNumber,
  batch,
  currentHire,
}: {
  waveNumber: number;
  batch: HireInfo[];
  currentHire: HireInfo;
}) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedOne, setCopiedOne] = useState(false);

  function buildHeader() {
    return `Wave ${waveNumber} — New Hire Details\nEmployee ID\tName\tPOS ID`;
  }

  function buildRow(h: HireInfo) {
    return `${h.bambooEid}\t${h.name}\t${h.posId || "TBC"}`;
  }

  async function handleCopyAll() {
    const rows = batch.map(buildRow).join("\n");
    await navigator.clipboard.writeText(`${buildHeader()}\n${rows}`);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  async function handleCopyOne() {
    await navigator.clipboard.writeText(`${buildHeader()}\n${buildRow(currentHire)}`);
    setCopiedOne(true);
    setTimeout(() => setCopiedOne(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={handleCopyAll}
        className="inline-flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-4 py-2 rounded-xl transition-colors font-medium"
      >
        <CopyIcon />
        {copiedAll ? "Copied!" : `Copy Wave ${waveNumber}`}
      </button>
      <button
        onClick={handleCopyOne}
        className="inline-flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-4 py-2 rounded-xl transition-colors font-medium"
      >
        <CopyIcon />
        {copiedOne ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
