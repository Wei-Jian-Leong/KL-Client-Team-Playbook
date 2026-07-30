"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STATUS_STYLES } from "@/lib/hireStatus";
import { formatDate, getRoleLabel } from "@/lib/training";

type DisplayStatus = "UPCOMING" | "ONGOING" | "COMPLETED" | "RESIGNED" | "DELETED";

// Phase pill colors
const phaseTypeColor: Record<string, { bg: string; text: string; border: string; dot: string; darkBg: string }> = {
  GD:   { bg: "bg-blue-50",    darkBg: "dark:bg-blue-900/20",    text: "text-blue-700 dark:text-blue-300",    border: "border-blue-200 dark:border-blue-700",    dot: "bg-blue-500" },
  COS:  { bg: "bg-violet-50",  darkBg: "dark:bg-violet-900/20",  text: "text-violet-700 dark:text-violet-300",  border: "border-violet-200 dark:border-violet-700",  dot: "bg-violet-500" },
  MENU: { bg: "bg-amber-50",   darkBg: "dark:bg-amber-900/20",   text: "text-amber-700 dark:text-amber-300",   border: "border-amber-200 dark:border-amber-700",   dot: "bg-amber-500" },
};
const phaseTypeFallback = { bg: "bg-teal-50", darkBg: "dark:bg-teal-900/20", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-700", dot: "bg-teal-500" };

// Role chip colors
const roleChipColor: Record<string, { bg: string; text: string; border: string }> = {
  COS:                { bg: "bg-violet-50 dark:bg-violet-900/30",   text: "text-violet-700 dark:text-violet-300",   border: "border-violet-200 dark:border-violet-700" },
  PIS:                { bg: "bg-blue-50 dark:bg-blue-900/30",       text: "text-blue-700 dark:text-blue-300",       border: "border-blue-200 dark:border-blue-700" },
  OSM:                { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-700" },
  AE:                 { bg: "bg-amber-50 dark:bg-amber-900/30",     text: "text-amber-700 dark:text-amber-300",     border: "border-amber-200 dark:border-amber-700" },
  BILLING_COLLECTION: { bg: "bg-rose-50 dark:bg-rose-900/30",       text: "text-rose-700 dark:text-rose-300",       border: "border-rose-200 dark:border-rose-700" },
  OTHERS:             { bg: "bg-gray-100 dark:bg-gray-700/40",      text: "text-gray-600 dark:text-gray-300",       border: "border-gray-200 dark:border-gray-600" },
};
const roleChipFallback = { bg: "bg-indigo-50 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-700" };

const DARK_STATUS_STYLES: Record<DisplayStatus, { badge: string }> = {
  UPCOMING:  { badge: "dark:bg-purple-900/40 dark:text-purple-300" },
  ONGOING:   { badge: "dark:bg-blue-900/40 dark:text-blue-300" },
  COMPLETED: { badge: "dark:bg-green-900/40 dark:text-green-300" },
  RESIGNED:  { badge: "dark:bg-orange-900/40 dark:text-orange-300" },
  DELETED:   { badge: "dark:bg-red-900/40 dark:text-red-300" },
};

interface TrainingPhase { id: string; type: string; status: string; startDate: Date; endDate: Date }
interface Task { id: string; status: string; team: string; title: string }
interface Hire {
  id: string;
  name: string;
  role: string;
  roleDescription: string | null;
  joinDate: Date;
  teamLeadName: string | null;
  posId: string | null;
  waveNumber: number | null;
  deleteReason: string | null;
  tasks: Task[];
  trainingPhases: TrainingPhase[];
  displayStatus: DisplayStatus;
}

interface Props {
  hires: Hire[];
  isHROrAdmin: boolean;
  sessionTeam: string;
  isAdmin: boolean;
  stats: { total: number; upcoming: number; ongoing: number; completed: number; resigned: number };
}

type Filter = "ALL" | DisplayStatus;

const STAT_TILES: {
  key: Filter;
  label: string;
  valueKey: keyof Props["stats"];
  icon: string;
  light: string;
  dark: string;
  activeRing: string;
}[] = [
  { key: "ALL",       label: "Total",     valueKey: "total",     icon: "👥", light: "bg-white border-gray-200 text-gray-900",        dark: "dark:bg-gray-800 dark:border-gray-700 dark:text-white",         activeRing: "ring-2 ring-indigo-400 border-indigo-300" },
  { key: "UPCOMING",  label: "Upcoming",  valueKey: "upcoming",  icon: "🗓️", light: "bg-purple-50 border-purple-200 text-purple-800",  dark: "dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300", activeRing: "ring-2 ring-purple-400 border-purple-400" },
  { key: "ONGOING",   label: "Ongoing",   valueKey: "ongoing",   icon: "⚡", light: "bg-blue-50 border-blue-200 text-blue-800",        dark: "dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300",   activeRing: "ring-2 ring-blue-400 border-blue-400" },
  { key: "COMPLETED", label: "Completed", valueKey: "completed", icon: "✅", light: "bg-green-50 border-green-200 text-green-800",     dark: "dark:bg-green-900/20 dark:border-green-700 dark:text-green-300", activeRing: "ring-2 ring-green-400 border-green-400" },
  { key: "RESIGNED",  label: "Resigned",  valueKey: "resigned",  icon: "👋", light: "bg-orange-50 border-orange-200 text-orange-800",  dark: "dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300", activeRing: "ring-2 ring-orange-400 border-orange-400" },
];

function getMonthKey(date: Date) {
  const d = new Date(date);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit" });
  const parts = fmt.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function getMonthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", {
    month: "long", year: "numeric", timeZone: "America/New_York",
  });
}

export default function DashboardView({ hires, isHROrAdmin, sessionTeam, isAdmin, stats }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("UPCOMING");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [nameSearch, setNameSearch] = useState<string>("");

  const months = Array.from(new Set(hires.map((h) => getMonthKey(h.joinDate)))).sort();

  const nameFiltered = nameSearch.trim()
    ? hires.filter((h) => h.name.toLowerCase().includes(nameSearch.toLowerCase()))
    : hires;

  const monthFiltered = monthFilter === "ALL" ? nameFiltered : nameFiltered.filter((h) => getMonthKey(h.joinDate) === monthFilter);

  const filteredStats = {
    total:     monthFiltered.length,
    upcoming:  monthFiltered.filter((h) => h.displayStatus === "UPCOMING").length,
    ongoing:   monthFiltered.filter((h) => h.displayStatus === "ONGOING").length,
    completed: monthFiltered.filter((h) => h.displayStatus === "COMPLETED").length,
    resigned:  monthFiltered.filter((h) => h.displayStatus === "RESIGNED").length,
  };

  const [sortCol, setSortCol] = useState<string>("joinDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  function cmp(a: unknown, b: unknown) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
    return (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0;
  }

  const unfiltered = monthFiltered.filter((h) => filter === "ALL" || h.displayStatus === filter);

  const visible = [...unfiltered].sort((a, b) => {
    let v = 0;
    switch (sortCol) {
      case "name":     v = cmp(a.name, b.name); break;
      case "status":   v = cmp(a.displayStatus, b.displayStatus); break;
      case "role":     v = cmp(a.role, b.role); break;
      case "wave":     v = cmp(a.waveNumber, b.waveNumber); break;
      case "joinDate": v = cmp(+new Date(a.joinDate), +new Date(b.joinDate)); break;
      case "teamLead": v = cmp(a.teamLeadName ?? "", b.teamLeadName ?? ""); break;
      case "tasks": {
        const pctA = a.tasks.length > 0 ? a.tasks.filter(t => t.status === "COMPLETED").length / a.tasks.length : 0;
        const pctB = b.tasks.length > 0 ? b.tasks.filter(t => t.status === "COMPLETED").length / b.tasks.length : 0;
        v = cmp(pctA, pctB); break;
      }
    }
    return sortDir === "asc" ? v : -v;
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Hire</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">All new hire onboarding progress</p>
        </div>
        {isHROrAdmin && (
          <Link
            href="/new-hire/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            + New Hire
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <input
          type="text"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          placeholder="Search by name..."
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
        />
        {months.length > 0 && (
          <>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide shrink-0">Join Month:</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Months</option>
              {months.map((m) => (
                <option key={m} value={m}>{getMonthLabel(m)}</option>
              ))}
            </select>
          </>
        )}
        {(nameSearch || monthFilter !== "ALL") && (
          <button
            onClick={() => { setNameSearch(""); setMonthFilter("ALL"); }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {STAT_TILES.map((s) => {
          const val = filteredStats[s.valueKey];
          const active = filter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setFilter(active ? "ALL" : s.key)}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${s.light} ${s.dark} ${active ? s.activeRing + " shadow-sm" : "hover:scale-[1.02]"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg">{s.icon}</span>
                {active && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/50 dark:bg-black/20 text-current opacity-70">
                    ON
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold">{val}</p>
              <p className="text-xs font-medium opacity-70 mt-0.5">{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500 dark:text-gray-400">
            {filter === "ALL" ? "No new hires yet." : `No ${filter.toLowerCase()} hires.`}
          </p>
          {isHROrAdmin && filter === "ALL" && (
            <Link href="/new-hire/new" className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:underline text-sm">
              Add the first new hire →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {(["name","status","role","wave","joinDate","teamLead","tasks"] as const).map((col, i) => {
                    const labels: Record<string, string> = { name: "Name", status: "Status", role: "Role", wave: "Wave", joinDate: "Join Date", teamLead: "Team Lead", tasks: "Tasks" };
                    const hidden = col === "wave" ? "hidden md:table-cell" : col === "joinDate" || col === "teamLead" ? "hidden lg:table-cell" : "";
                    const active = sortCol === col;
                    return (
                      <th
                        key={col}
                        onClick={() => toggleSort(col)}
                        className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/40 transition-colors ${hidden}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {labels[col]}
                          <span className={active ? "text-indigo-500" : "text-gray-300 dark:text-gray-600"}>
                            {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                          </span>
                        </span>
                      </th>
                    );
                  })}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Training</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/60">
                {visible.map((hire) => {
                  const ds = hire.displayStatus;
                  const style = STATUS_STYLES[ds];
                  const darkStyle = DARK_STATUS_STYLES[ds];
                  const tasksDone = hire.tasks.filter((t) => t.status === "COMPLETED").length;
                  const tasksTotal = hire.tasks.length;
                  const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
                  const roleColor = roleChipColor[hire.role] ?? roleChipFallback;

                  return (
                    <tr
                      key={hire.id}
                      onClick={() => router.push(`/new-hire/${hire.id}`)}
                      className="cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors"
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 dark:text-white">{hire.name}</span>
                          {!hire.posId && ds === "ONGOING" && (
                            <span title="POS ID missing" className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          )}
                        </div>
                        {(ds === "RESIGNED" || ds === "DELETED") && hire.deleteReason && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 italic truncate max-w-[180px]">{hire.deleteReason}</p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${style.badge} ${darkStyle.badge}`}>
                          {style.label}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${roleColor.bg} ${roleColor.text} ${roleColor.border}`}>
                          {getRoleLabel(hire.role)}
                        </span>
                      </td>

                      {/* Wave */}
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {hire.waveNumber != null ? (
                          <span className="font-medium text-gray-700 dark:text-gray-300">W{hire.waveNumber}</span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>

                      {/* Join Date */}
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap hidden lg:table-cell">
                        {formatDate(hire.joinDate)}
                      </td>

                      {/* Team Lead */}
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                        {hire.teamLeadName ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>

                      {/* Tasks progress */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {tasksDone}<span className="text-gray-400 dark:text-gray-500 font-normal">/{tasksTotal}</span>
                          </span>
                          {tasksTotal > 0 && (
                            <div className="h-1.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Training phases */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          {hire.trainingPhases.map((phase) => {
                            const pc = phaseTypeColor[phase.type] ?? phaseTypeFallback;
                            const isCompleted = phase.status === "COMPLETED";
                            const isActive = phase.status === "IN_PROGRESS";
                            return (
                              <span
                                key={phase.id}
                                className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap
                                  ${isCompleted ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700" : `${pc.bg} ${pc.darkBg} ${pc.text} ${pc.border} ${isActive ? "" : "opacity-50"}`}`}
                              >
                                {isCompleted ? "✓" : isActive ? "⟳" : "○"} {phase.type}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
            <p className="text-xs text-gray-400 dark:text-gray-500">{visible.length} hire{visible.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}
    </div>
  );
}
