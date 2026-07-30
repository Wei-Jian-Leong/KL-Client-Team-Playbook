"use client";

import { useState } from "react";

const TYPE_STYLE = {
  GD:   { bg: "bg-blue-500",   light: "bg-blue-100 dark:bg-blue-900/50",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-300 dark:border-blue-700",   dot: "bg-blue-500",   label: "GD Training" },
  COS:  { bg: "bg-violet-500", light: "bg-violet-100 dark:bg-violet-900/50",text: "text-violet-700 dark:text-violet-300",border: "border-violet-300 dark:border-violet-700",dot: "bg-violet-500", label: "COS Training" },
  MENU: { bg: "bg-amber-500",  light: "bg-amber-100 dark:bg-amber-900/50", text: "text-amber-700 dark:text-amber-300",  border: "border-amber-300 dark:border-amber-700",  dot: "bg-amber-500",  label: "Menu Training" },
} as const;

const STATUS_OPACITY: Record<string, string> = {
  COMPLETED:   "opacity-50",
  IN_PROGRESS: "opacity-100",
  PENDING:     "opacity-80",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface Phase {
  type: string;
  status: string;
  startDate: string;
  endDate: string;
}

function getDayTypes(year: number, month: number, phases: Phase[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const types: string[] = [];
    for (const phase of phases) {
      const start = new Date(phase.startDate);
      const end = new Date(phase.endDate);
      // normalize to date only
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (date >= start && date <= end) {
        if (!types.includes(phase.type)) types.push(phase.type);
      }
    }
    if (types.length > 0) map.set(day, types);
  }
  return map;
}

function MonthCard({ year, month, phases }: { year: number; month: number; phases: Phase[] }) {
  const dayTypes = getDayTypes(year, month, phases);
  const rawFirstDay = new Date(year, month, 1).getDay();
  const firstDay = rawFirstDay === 0 ? 6 : rawFirstDay - 1; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  // pad to complete weeks
  while (cells.length % 7 !== 0) cells.push(null);

  // Build legend entries for this month — always in GD → COS → MENU order
  const TYPE_ORDER = ["GD", "COS", "MENU"];
  const presentTypes = new Set<string>();
  dayTypes.forEach((types) => types.forEach((t) => presentTypes.add(t)));
  const usedTypes = TYPE_ORDER.filter((t) => presentTypes.has(t));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      {/* Month header */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white text-base">
          {MONTH_NAMES[month]} {year}
        </h3>
      </div>

      <div className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const types = dayTypes.get(day) ?? [];
            const isToday = isCurrentMonth && today.getDate() === day;

            // Pick primary type for background (first in list, priority: IN_PROGRESS > PENDING > COMPLETED)
            const primaryType = types[0] as keyof typeof TYPE_STYLE | undefined;
            const style = primaryType ? TYPE_STYLE[primaryType] : null;

            // Find status for this day's primary phase
            const primaryPhase = phases.find((p) => {
              if (p.type !== primaryType) return false;
              const s = new Date(p.startDate); s.setHours(0,0,0,0);
              const e = new Date(p.endDate); e.setHours(23,59,59,999);
              const d = new Date(year, month, day);
              return d >= s && d <= e;
            });
            const statusOp = primaryPhase ? (STATUS_OPACITY[primaryPhase.status] ?? "") : "";

            return (
              <div key={day} className="flex flex-col items-center py-0.5">
                <div
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-all
                    ${style ? `${style.bg} text-white ${statusOp}` : "text-gray-700 dark:text-gray-300"}
                    ${isToday && !style ? "ring-2 ring-indigo-500 font-bold" : ""}
                    ${isToday && style ? "ring-2 ring-white dark:ring-gray-800" : ""}
                  `}
                >
                  {day}
                </div>
                {/* Secondary type dot (e.g. transition day) */}
                {types.length > 1 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {types.slice(1).map((t) => {
                      const s2 = TYPE_STYLE[t as keyof typeof TYPE_STYLE];
                      return s2 ? <span key={t} className={`w-1 h-1 rounded-full ${s2.dot}`} /> : null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TrainingCalendar({ phases, showMenu, yearLabel }: { phases: Phase[]; showMenu: boolean; yearLabel?: string }) {
  // Find months that have training
  const monthSet = new Set<string>();
  phases.forEach((p) => {
    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      monthSet.add(`${cur.getFullYear()}-${cur.getMonth()}`);
      cur.setMonth(cur.getMonth() + 1);
    }
  });

  const allMonths = Array.from(monthSet)
    .map((k) => { const [y, m] = k.split("-").map(Number); return { year: y, month: m }; })
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

  // Group years for the filter bar
  const years = Array.from(new Set(allMonths.map((m) => m.year))).sort();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set());

  const activeYear = selectedYear ?? (years[0] ?? new Date().getFullYear());

  function toggleMonth(m: number) {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  }

  function clearFilter() {
    setSelectedMonths(new Set());
  }

  const monthsForYear = allMonths.filter((m) => m.year === activeYear);
  const months = monthsForYear.filter((m) => selectedMonths.size === 0 || selectedMonths.has(m.month));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Schedule</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Available training dates{yearLabel ? ` · ${yearLabel}` : ""}</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 mb-5 flex flex-wrap items-center gap-4">
        {/* Year tabs */}
        {years.length > 1 && (
          <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-600 rounded-lg p-0.5">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => { setSelectedYear(y); setSelectedMonths(new Set()); }}
                className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors
                  ${activeYear === y
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {/* Month pills */}
        <div className="flex flex-wrap gap-1.5">
          {monthsForYear.map(({ month }) => {
            const active = selectedMonths.has(month);
            return (
              <button
                key={month}
                onClick={() => toggleMonth(month)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors
                  ${active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"}`}
              >
                {MONTH_NAMES[month].slice(0, 3)}
              </button>
            );
          })}
        </div>

        {selectedMonths.size > 0 && (
          <button
            onClick={clearFilter}
            className="ml-auto text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {(["GD", "COS", ...(showMenu ? ["MENU"] : [])] as const).map((t) => {
          const s = TYPE_STYLE[t];
          return (
            <div key={t} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${s.light} ${s.border}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
              <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-500" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Completed (dimmed)</span>
        </div>
      </div>

      {allMonths.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500 dark:text-gray-400">No training scheduled yet.</p>
        </div>
      ) : months.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No training in the selected months.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {months.map(({ year, month }) => (
            <MonthCard key={`${year}-${month}`} year={year} month={month} phases={phases} />
          ))}
        </div>
      )}
    </div>
  );
}
