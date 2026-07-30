"use client";

import { useState } from "react";
import PerformanceTab from "./PerformanceTab";

interface Performance {
  id: string;
  period: number;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  aht: number | null;
  str: number | null;
  mistakeRate: number | null;
  adherence: number | null;
  fcr: number | null;
  notes: string | null;
}

interface Props {
  children: React.ReactNode; // Team Tasks section
  showPerformance: boolean;
  newHireId: string;
  hireName: string;
  joinDate: Date;
  performances: Performance[];
  canEditPerformance: boolean;
}

export default function HireDetailTabs({
  children,
  showPerformance,
  newHireId,
  hireName,
  joinDate,
  performances,
  canEditPerformance,
}: Props) {
  const [tab, setTab] = useState<"tasks" | "performance">("tasks");

  if (!showPerformance) {
    return <>{children}</>;
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        <button
          onClick={() => setTab("tasks")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === "tasks"
              ? "bg-white border border-b-white border-gray-200 text-indigo-600 -mb-px"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Team Tasks
        </button>
        <button
          onClick={() => setTab("performance")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === "performance"
              ? "bg-white border border-b-white border-gray-200 text-indigo-600 -mb-px"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          First 4 Month Performance
        </button>
      </div>

      {tab === "tasks" && <>{children}</>}
      {tab === "performance" && (
        <PerformanceTab
          newHireId={newHireId}
          hireName={hireName}
          joinDate={joinDate}
          performances={performances}
          canEdit={canEditPerformance}
        />
      )}
    </div>
  );
}
