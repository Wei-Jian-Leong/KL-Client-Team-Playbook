"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { updateRoleAccess } from "@/app/actions/admin";

import { addWorkingDays, nextWorkingDay, getTrainingTrack } from "@/lib/training";
import type { HireRole } from "@/lib/training";

const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CAL_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const ROLE_OPTIONS: { value: HireRole; label: string }[] = [
  { value: "COS",                label: "Client Operations Specialist" },
  { value: "PIS",                label: "Product Implementation Specialist" },
  { value: "OSM",                label: "Onboarding Success Manager" },
  { value: "AE",                 label: "Account Executive" },
  { value: "BILLING_COLLECTION", label: "Billing & Collection Specialist" },
  { value: "OTHERS",             label: "Others" },
];

const PHASE_COLORS: Record<string, string> = {
  GD:   "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  COS:  "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
  MENU: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function DatePicker({
  value,
  onChange,
  existingDates,
  previewRole,
  onRoleChange,
}: {
  value: string; // "YYYY-MM-DD"
  onChange: (v: string) => void;
  existingDates: Set<string>;
  previewRole: HireRole;
  onRoleChange: (r: HireRole) => void;
}) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // Build calendar cells (Mon-first)
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function toKey(day: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const displayLabel = value
    ? new Date(value + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "Select a weekday";

  // Training preview
  const previewPhases = value
    ? (() => {
        const [y, m, d] = value.split("-").map(Number);
        const start = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        const track = getTrainingTrack(previewRole);
        const phases = [];
        let cur = new Date(start);
        for (const p of track) {
          const end = addWorkingDays(cur, p.days);
          phases.push({ type: p.type, start: new Date(cur), end });
          cur = nextWorkingDay(end);
        }
        return phases;
      })()
    : [];

  return (
    <div className="space-y-3">
      {/* Trigger */}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[220px]
            ${open ? "border-indigo-400 dark:border-indigo-500" : "border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500"}
            bg-white dark:bg-gray-700`}
        >
          <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className={value ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}>
            {displayLabel}
          </span>
          <svg className={`w-3.5 h-3.5 ml-auto text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 w-72">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{MONTH_FULL[viewMonth]} {viewYear}</span>
              <button type="button" onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {CAL_DAYS.map(d => (
                <div key={d} className="text-center text-[9px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 py-1">{d}</div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />;
                const dow = new Date(viewYear, viewMonth, day).getDay();
                const isWeekday = dow !== 0 && dow !== 6;
                const key = toKey(day);
                const isSelected = key === value;
                const isAdded = existingDates.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!isWeekday || isAdded}
                    onClick={() => { onChange(key); setOpen(false); }}
                    title={!isWeekday ? "Weekdays only" : isAdded ? "Already added" : undefined}
                    className={`h-8 w-full flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all
                      ${isSelected ? "bg-indigo-600 text-white shadow-sm" :
                        isAdded ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 cursor-not-allowed" :
                        isWeekday ? "hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-800 dark:text-gray-200 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer" :
                        "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                      }`}
                  >
                    {day}
                    {isAdded && !isSelected && <span className="text-[7px] leading-none">✓</span>}
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">Weekdays only — Sat/Sun are not selectable</p>
          </div>
        )}
      </div>

      {/* Training schedule preview */}
      {value && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Training Preview</p>
            <select
              value={previewRole}
              onChange={e => onRoleChange(e.target.value as HireRole)}
              className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {previewPhases.map(p => (
              <span key={p.type} className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md ${PHASE_COLORS[p.type] ?? ""}`}>
                <span className="font-bold">{p.type}</span>
                <span className="opacity-75">{fmtDate(p.start)} – {fmtDate(p.end)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import {
  addJoinDateSlot,
  removeJoinDateSlot,
  approveJoinDateRequest,
  rejectJoinDateRequest,
  updateUserAccess,
  createUser,
  createMentor,
  toggleMentorActive,
  deleteMentor,
} from "@/app/actions/admin";

const COS_ROLE_OPTIONS = [
  { value: "USER",    label: "User" },
  { value: "SUPPORT", label: "Support" },
  { value: "ADMIN",   label: "Admin" },
];

interface JoinDateSlot { id: string; date: Date; label: string | null; isAvailable: boolean }
interface JoinDateRequest {
  id: string;
  requestedDate: Date;
  reason: string;
  status: string;
  requestedBy: { name: string; email: string };
}
interface User { id: string; name: string; email: string; team: string; position: string | null; isAdmin: boolean }
interface MentorItem { id: string; name: string; isActive: boolean }
interface Props {
  joinDateSlots: JoinDateSlot[];
  joinDateRequests: JoinDateRequest[];
  users: User[];
  mentors: MentorItem[];
  roleAccessConfig: Record<string, Record<string, boolean>>;
}

function SectionCard({ title, badge, children }: { title: string; badge?: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{title}</h2>
        {badge != null && badge > 0 && (
          <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {children}
      </div>
    </section>
  );
}

export default function AdminPanel({ joinDateSlots, joinDateRequests, users, mentors, roleAccessConfig }: Props) {
  const [, startTransition] = useTransition();
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [previewRole, setPreviewRole] = useState<HireRole>("COS");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserTeam, setNewUserTeam] = useState("COS_I");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function flash(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  }

  function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate) { flash("Please select a Monday", false); return; }
    const fd = new FormData();
    fd.set("date", newDate);
    fd.set("label", newLabel);
    startTransition(async () => {
      const res = await addJoinDateSlot(fd);
      if (res?.error) flash(res.error, false);
      else { flash("Join date added!"); setNewDate(""); setNewLabel(""); }
    });
  }

  return (
    <div className="space-y-8">
      {/* Quick Links */}
      <div className="flex flex-wrap gap-3">
        <a
          href="/admin/call-sim-drafts"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium transition-colors"
        >
          <span>📋</span>
          <span>Call Sim Drafts</span>
        </a>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2.5 rounded-xl font-medium ${
          msg.ok
            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
        }`}>
          {msg.text}
        </div>
      )}

      {/* Pending Join Date Requests */}
      {joinDateRequests.length > 0 && (
        <SectionCard title="Pending Join Date Requests" badge={joinDateRequests.length}>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {joinDateRequests.map((req) => (
              <div key={req.id} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                    {new Date(req.requestedDate).toLocaleDateString("en-US", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric",
                      timeZone: "America/New_York",
                    })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Requested by <strong className="text-gray-700 dark:text-gray-300">{req.requestedBy.name}</strong>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">&ldquo;{req.reason}&rdquo;</p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0 min-w-[140px]">
                  <button
                    onClick={() => startTransition(async () => { const r = await approveJoinDateRequest(req.id); if (r?.error) flash(r.error, false); else flash("Request approved."); })}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <input
                    placeholder="Rejection note (optional)"
                    value={rejectNote[req.id] || ""}
                    onChange={(e) => setRejectNote((p) => ({ ...p, [req.id]: e.target.value }))}
                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 placeholder:text-gray-400"
                  />
                  <button
                    onClick={() => startTransition(async () => { await rejectJoinDateRequest(req.id, rejectNote[req.id] || ""); flash("Request rejected."); })}
                    className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 transition-colors"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Manage Join Dates */}
      <SectionCard title="Join Date Slots">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <form onSubmit={handleAddSlot} className="space-y-3">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Join Date <span className="text-gray-400 font-normal">(weekdays only)</span></label>
                <DatePicker
                  value={newDate}
                  onChange={(v) => {
                    setNewDate(v);
                    const d = new Date(v + "T12:00:00Z");
                    setNewLabel(`${MONTH_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()} Batch`);
                  }}
                  existingDates={new Set(joinDateSlots.filter((s) => s.isAvailable).map((s) => {
                    const d = new Date(s.date);
                    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
                  }))}
                  previewRole={previewRole}
                  onRoleChange={setPreviewRole}
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Label (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. July 2026 Batch"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  autoComplete="off"
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400"
                />
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm shrink-0"
              >
                Add Date
              </button>
            </div>
          </form>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Label</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {joinDateSlots.filter((s) => s.isAvailable).length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm italic">No join dates configured</td>
              </tr>
            )}
            {joinDateSlots.filter((s) => s.isAvailable).map((slot) => (
              <tr key={slot.id} className={`${!slot.isAvailable ? "opacity-40" : ""} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors`}>
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                  {new Date(slot.date).toLocaleDateString("en-US", {
                    weekday: "short", day: "numeric", month: "short", year: "numeric",
                    timeZone: "America/New_York",
                  })}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{slot.label || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    slot.isAvailable
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}>
                    {slot.isAvailable ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {slot.isAvailable && (
                    <button
                      onClick={() => startTransition(async () => { await removeJoinDateSlot(slot.id); flash("Date disabled."); })}
                      className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:underline"
                    >
                      Disable
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      {/* User Access */}
      <SectionCard title="User Access Management">
        {/* Add User */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          {!showAddUser ? (
            <button
              onClick={() => setShowAddUser(true)}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              + Add User
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">New User</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
                  <input
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    autoComplete="off"
                    placeholder="e.g. Jane Doe"
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                  <input
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    type="email"
                    autoComplete="off"
                    placeholder="jane@wondersco.com"
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
                  <select
                    value={newUserTeam}
                    onChange={(e) => setNewUserTeam(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {COS_ROLE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUserIsAdmin}
                      onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                      className="rounded accent-indigo-600"
                    />
                    Admin access
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("name", newUserName);
                    fd.set("email", newUserEmail);
                    fd.set("team", newUserTeam);
                    fd.set("isAdmin", String(newUserIsAdmin));
                    startTransition(async () => {
                      const res = await createUser(fd);
                      if (res?.error) flash(res.error, false);
                      else {
                        flash(`User ${newUserName} created!`);
                        setShowAddUser(false);
                        setNewUserName(""); setNewUserEmail(""); setNewUserTeam("COS_I"); setNewUserIsAdmin(false);
                      }
                    });
                  }}
                  className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                  Create User
                </button>
                <button
                  onClick={() => { setShowAddUser(false); setNewUserName(""); setNewUserEmail(""); }}
                  className="text-sm text-gray-600 dark:text-gray-400 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {users.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8 italic">No users found</p>
          )}
          {users.map((u) => (
            <UserRow key={u.id} user={u} onFlash={flash} />
          ))}
        </div>
      </SectionCard>

      {/* Mentors */}
      <SectionCard title={`Mentors (${mentors.filter(m => m.isActive).length} active)`}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const nameVal = (fd.get("name") as string)?.trim();
              if (!nameVal) return;
              startTransition(async () => {
                const res = await createMentor(fd);
                if (res?.error) flash(res.error, false);
                else { flash(`${nameVal} added to mentor list`); (e.target as HTMLFormElement).reset(); }
              });
            }}
            className="flex gap-2"
          >
            <input
              name="name"
              placeholder="Add new mentor name..."
              className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              + Add
            </button>
          </form>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
          {mentors.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6 italic">No mentors yet</p>
          )}
          {mentors.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <span className={`text-sm flex-1 ${!m.isActive ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-200"}`}>
                {m.name}
              </span>
              {!m.isActive && (
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-full">Inactive</span>
              )}
              <button
                onClick={() => startTransition(async () => {
                  const res = await toggleMentorActive(m.id);
                  if (res?.error) flash(res.error, false);
                  else flash(m.isActive ? `${m.name} deactivated` : `${m.name} reactivated`);
                })}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium shrink-0 transition-colors ${
                  m.isActive
                    ? "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                    : "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
                }`}
              >
                {m.isActive ? "Deactivate" : "Reactivate"}
              </button>
              <button
                onClick={() => {
                  if (!confirm(`Delete ${m.name} from the mentor list?`)) return;
                  startTransition(async () => {
                    const res = await deleteMentor(m.id);
                    if (res?.error) flash(res.error, false);
                    else flash(`${m.name} removed`);
                  });
                }}
                className="text-xs px-2.5 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 font-medium shrink-0 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Role Access */}
      <SectionCard title="Role Access Control">
        <RoleAccessSection config={roleAccessConfig} onFlash={flash} />
      </SectionCard>
    </div>
  );
}

const COS_ROLES = ["USER", "SUPPORT", "ADMIN"] as const;
const ROLE_LABELS: Record<string, string> = { USER: "User", SUPPORT: "Support", ADMIN: "Admin" };
const PAGE_LABELS: Record<string, string> = {
  dashboard: "New Hire Info",
  schedule: "Training Schedule",
  knowledge: "Knowledge Base",
  announcements: "Updates",
  training: "Training Materials",
  admin: "Admin Page",
};
const ALL_PAGES = Object.keys(PAGE_LABELS);

function RoleAccessSection({
  config,
  onFlash,
}: {
  config: Record<string, Record<string, boolean>>;
  onFlash: (m: string, ok?: boolean) => void;
}) {
  const [local, setLocal] = useState(config);
  const [, startTransition] = useTransition();

  const toggle = useCallback((role: string, page: string, enabled: boolean) => {
    setLocal(prev => ({ ...prev, [role]: { ...prev[role], [page]: enabled } }));
    startTransition(async () => {
      const res = await updateRoleAccess(role, page, enabled);
      if (!res.success) onFlash("Failed to update access", false);
    });
  }, [onFlash]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Toggle page access per role. Changes save instantly.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {COS_ROLES.map(role => (
          <div key={role} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{ROLE_LABELS[role]}</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {ALL_PAGES.map(page => {
                const enabled = !!(local[role]?.[page]);
                return (
                  <div key={page} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <span className="text-xs text-gray-700 dark:text-gray-300">{PAGE_LABELS[page]}</span>
                    <button
                      onClick={() => toggle(role, page, !enabled)}
                      className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${enabled ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-600"}`}
                      aria-label={`${ROLE_LABELS[role]} ${PAGE_LABELS[page]}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${enabled ? "left-4" : "left-0.5"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function UserRow({
  user,
  onFlash,
}: {
  user: { id: string; name: string; email: string; team: string; position: string | null; isAdmin: boolean };
  onFlash: (m: string, ok?: boolean) => void;
}) {
  const currentRole = user.position ?? COS_ROLE_OPTIONS[0].value;
  const [role, setRole] = useState(currentRole);
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  function handleSave() {
    const fd = new FormData();
    fd.set("userId", user.id);
    fd.set("team", "COS_TRAINING");
    fd.set("isAdmin", String(role === "ADMIN" || isAdmin));
    fd.set("position", role);
    startTransition(async () => {
      const res = await updateUserAccess(fd);
      if (res?.error) onFlash(res.error, false);
      else { onFlash(`Updated ${user.name}`); setEditing(false); }
    });
  }

  const roleLabel = COS_ROLE_OPTIONS.find(r => r.value === (editing ? role : currentRole))?.label ?? currentRole;

  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
        {getInitials(user.name)}
      </div>

      <div className="flex-1 min-w-[160px]">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{user.email}</p>
      </div>

      {editing ? (
        <>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {COS_ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={handleSave} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm">
              Save
            </button>
            <button onClick={() => { setEditing(false); setRole(currentRole); setIsAdmin(user.isAdmin); }} className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1.5 hover:text-gray-700 dark:hover:text-gray-200">
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full font-medium">
            {roleLabel}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}
