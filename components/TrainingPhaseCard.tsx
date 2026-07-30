"use client";

import { useState } from "react";
import { updateTrainingPhase, recordCertAttempt, updateCertNextAttemptDate } from "@/app/actions/newhire";
import { formatDate } from "@/lib/training";
import { SessionUser } from "@/lib/session";
import MentorCombobox from "@/components/MentorCombobox";

type User = { id: string; name: string; team: string };
type Mentor = { id: string; name: string };

type CertAuditRow = {
  id: string;
  auditorName: string;
  role: string;
  result: string | null;
  notes: string | null;
  auditedAt: Date | null;
};

type CertAttempt = {
  id: string;
  attemptNumber: number;
  result: string;
  certDate: Date;
  fileLink: string | null;
  nextAttemptDate: Date | null;
  notes: string | null;
  certAudits: CertAuditRow[];
};

type Phase = {
  id: string;
  type: string;
  startDate: Date;
  endDate: Date;
  status: string;
  notes: string | null;
  gdTrainer: User | null;
  gdMentorId: string | null;
  cosTrainer: User | null;
  cosMentorId: string | null;
  menuTrainer: User | null;
  gdCertResult: string | null;
  gdCertDate: Date | null;
  gdCertNotes: string | null;
  certAudits: CertAuditRow[];
  certAttempts: CertAttempt[];
};

const MENU_ROLES = ["PIS", "OSM", "AE"];

const phaseConfig: Record<string, { label: string; color: string; bg: string; team: string }> = {
  GD:   { label: "GD Training",   color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",   team: "GD_TRAINING"   },
  COS:  { label: "COS Training",  color: "text-purple-700", bg: "bg-purple-50 border-purple-200", team: "COS_TRAINING" },
  MENU: { label: "Menu Training", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", team: "MENU_TRAINING" },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  PENDING:     { color: "bg-gray-100 text-gray-600",   label: "Pending"     },
  IN_PROGRESS: { color: "bg-blue-100 text-blue-700",   label: "In Progress" },
  COMPLETED:   { color: "bg-green-100 text-green-700", label: "Completed"   },
};

const certBadge = (result: string | null) =>
  result === "PASSED"
    ? "bg-green-100 text-green-700 border border-green-300"
    : result === "FAILED"
    ? "bg-red-100 text-red-700 border border-red-300"
    : "bg-gray-100 text-gray-500";

function ordinalLabel(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function defaultCosAuditors(hireRole: string, sessionName: string) {
  if (MENU_ROLES.includes(hireRole)) {
    return [
      { auditorName: sessionName, auditorRole: "PRIMARY", auditorResult: "PASSED" as const },
      { auditorName: "Wei Loon Ooi", auditorRole: "LEAD", auditorResult: "PASSED" as const },
    ];
  }
  return [
    { auditorName: sessionName, auditorRole: "PRIMARY", auditorResult: "PASSED" as const },
    { auditorName: "", auditorRole: "LEAD", auditorResult: "PASSED" as const },
    { auditorName: "Sik", auditorRole: "OPTIONAL", auditorResult: "PASSED" as const },
  ];
}

function todayInputDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TrainingPhaseCard({
  phase,
  newHireId,
  hireRole,
  session,
  allUsers,
  mentors,
  isAdmin = false,
}: {
  phase: Phase;
  newHireId: string;
  hireRole: string;
  session: SessionUser;
  allUsers: User[];
  mentors: Mentor[];
  isAdmin?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(phase.status);
  const [notes, setNotes] = useState(phase.notes || "");
  const [gdTrainerId, setGdTrainerId] = useState(phase.gdTrainer?.id || "");
  const [gdMentorIds, setGdMentorIds] = useState<string[]>(phase.gdMentorId?.split(",").filter(Boolean) ?? []);
  const defaultCosTrainer = phase.cosTrainer?.id || (session.team === "COS_TRAINING" ? session.id : "");
  const [cosTrainerId, setCosTrainerId] = useState(defaultCosTrainer);
  const [cosMentorIds, setCosMentorIds] = useState<string[]>(phase.cosMentorId?.split(",").filter(Boolean) ?? []);
  const [menuTrainerId, setMenuTrainerId] = useState(phase.menuTrainer?.id || "");
  const [saving, setSaving] = useState(false);

  // Attempt form state
  const [showAttemptForm, setShowAttemptForm] = useState(false);
  const [attemptResult, setAttemptResult] = useState("PASSED");
  const [attemptDate, setAttemptDate] = useState(todayInputDate());
  const [attemptNotes, setAttemptNotes] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [attemptNumberOverride, setAttemptNumberOverride] = useState<number | "">(phase.certAttempts.length + 1);
  const [nextAttemptDate, setNextAttemptDate] = useState("");
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [cosAuditors, setCosAuditors] = useState(defaultCosAuditors(hireRole, session.name));
  const [schedulePreference, setSchedulePreference] = useState("");
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  const derivedCosResult = cosAuditors
    .filter(a => a.auditorRole !== "OPTIONAL")
    .every(a => a.auditorResult === "PASSED") ? "PASSED" : "FAILED";

  const cfg = phaseConfig[phase.type];
  const isMyPhase = session.team === cfg.team || isAdmin;
  const canRecordCert = (phase.type === "GD" && (session.team === "GD_TRAINING" || isAdmin))
    || (phase.type === "COS" && (session.team === "COS_TRAINING" || isAdmin));

  async function handleSave() {
    if (phase.type === "GD" && (!gdTrainerId || gdMentorIds.length === 0)) {
      alert("GD Training requires both a trainer and a mentor.");
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.append("phaseId", phase.id);
    fd.append("newHireId", newHireId);
    fd.append("status", status);
    fd.append("notes", notes);
    if (gdTrainerId) fd.append("gdTrainerId", gdTrainerId);
    if (gdMentorIds.length > 0) fd.append("gdMentorId", gdMentorIds.join(","));
    if (cosTrainerId) fd.append("cosTrainerId", cosTrainerId);
    if (cosMentorIds.length > 0) fd.append("cosMentorId", cosMentorIds.join(","));
    if (menuTrainerId) fd.append("menuTrainerId", menuTrainerId);
    try {
      await updateTrainingPhase(fd);
      setSaving(false);
      setEditing(false);
    } catch (err) {
      console.error("Failed to save training phase", err);
      setSaving(false);
      alert("Failed to save. Please try again.");
    }
  }

  async function handleAttemptSave() {
    setSavingAttempt(true);

    const effectiveResult = phase.type === "COS" ? derivedCosResult : attemptResult;

    const fd = new FormData();
    fd.append("phaseId", phase.id);
    fd.append("newHireId", newHireId);
    fd.append("phaseType", phase.type);
    fd.append("result", effectiveResult);
    fd.append("certDate", attemptDate);
    fd.append("notes", attemptNotes);
    if (driveLink.trim()) fd.append("fileLink", driveLink.trim());
    if (nextAttemptDate.trim()) fd.append("nextAttemptDate", nextAttemptDate.trim());
    if (phase.type === "GD" && attemptNumberOverride !== "") fd.append("overrideAttemptNumber", String(attemptNumberOverride));
    if (phase.type === "COS") {
      cosAuditors.forEach((a) => {
        fd.append("auditorName", a.auditorName);
        fd.append("auditorRole", a.auditorRole);
        fd.append("auditorResult", a.auditorResult);
      });
      if (schedulePreference.trim()) fd.append("schedulePreference", schedulePreference.trim());
    }

    await recordCertAttempt(fd);
    setSavingAttempt(false);
    setShowAttemptForm(false);
    setAttemptResult("PASSED");
    setAttemptDate(todayInputDate());
    setAttemptNotes("");
    setDriveLink("");
    setNextAttemptDate("");
    setSchedulePreference("");
    setCosAuditors(defaultCosAuditors(hireRole, session.name));
  }

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
          <span className="text-xs text-gray-500 ml-2">
            {formatDate(phase.startDate)} → {formatDate(phase.endDate)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[phase.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
            {statusConfig[phase.status]?.label ?? phase.status}
          </span>
          {isMyPhase && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-white/60 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Display info */}
      {!editing && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            {phase.type === "GD" && (
              <>
                <div>
                  <span className="font-medium">Trainer:</span>{" "}
                  {phase.gdTrainer?.name || <span className="text-red-500">Not assigned*</span>}
                </div>
                <div>
                  <span className="font-medium">Mentor:</span>{" "}
                  {phase.gdMentorId && phase.gdMentorId.length > 0
                    ? <span className="inline-flex flex-col gap-0.5">{phase.gdMentorId.split(",").filter(Boolean).map(id => <span key={id}>{mentors.find(m => m.id === id)?.name ?? "Unknown"}</span>)}</span>
                    : <span className="text-red-500">Not assigned*</span>}
                </div>
              </>
            )}
            {phase.type === "COS" && (
              <>
                <div>
                  <span className="font-medium">Trainer:</span>{" "}
                  {phase.cosTrainer?.name || <span className="text-gray-400">Not assigned</span>}
                </div>
                <div>
                  <span className="font-medium">Mentor:</span>{" "}
                  {phase.cosMentorId && phase.cosMentorId.length > 0
                    ? <span className="inline-flex flex-col gap-0.5">{phase.cosMentorId.split(",").filter(Boolean).map(id => <span key={id}>{mentors.find(m => m.id === id)?.name ?? "Unknown"}</span>)}</span>
                    : <span className="text-gray-400">Not assigned</span>}
                </div>
              </>
            )}
            {phase.type === "MENU" && (
              <div>
                <span className="font-medium">Trainer:</span>{" "}
                {phase.menuTrainer?.name || <span className="text-gray-400">Not assigned</span>}
              </div>
            )}
            {phase.notes && (
              <div className="col-span-2 mt-1">
                <span className="font-medium">Notes:</span> {phase.notes}
              </div>
            )}
          </div>

          {/* Cert attempts section — GD and COS */}
          {(phase.type === "GD" || phase.type === "COS") && (
            <div className={`pt-2 border-t ${phase.type === "GD" ? "border-blue-100" : "border-purple-100"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-600">
                  {phase.type === "GD" ? "GD Certification" : "COS Certification"}
                </span>
                {canRecordCert && !showAttemptForm && (
                  <button
                    onClick={() => setShowAttemptForm(true)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                      phase.type === "GD"
                        ? "text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                        : "text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                    }`}
                  >
                    + Record Attempt
                  </button>
                )}
              </div>

              {/* Attempt history */}
              {phase.certAttempts.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No attempts recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {phase.certAttempts.map((attempt) => (
                    <div key={attempt.id} className="bg-white/60 rounded-lg p-2 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-600">
                          {ordinalLabel(attempt.attemptNumber)} Attempt
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${certBadge(attempt.result)}`}>
                          {attempt.result}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(attempt.certDate)}</span>
                        {attempt.fileLink && (
                          <a
                            href={attempt.fileLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            📎 View File
                          </a>
                        )}
                        {attempt.result === "FAILED" && (
                          editingAttemptId === attempt.id ? (
                            <span className="flex items-center gap-1">
                              <input
                                type="date"
                                value={editingDate}
                                onChange={(e) => setEditingDate(e.target.value)}
                                className="text-xs px-1.5 py-0.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <button
                                disabled={savingDate}
                                onClick={async () => {
                                  setSavingDate(true);
                                  const fd = new FormData();
                                  fd.append("attemptId", attempt.id);
                                  fd.append("phaseId", phase.id);
                                  fd.append("newHireId", newHireId);
                                  if (editingDate) fd.append("nextAttemptDate", editingDate);
                                  await updateCertNextAttemptDate(fd);
                                  setSavingDate(false);
                                  setEditingAttemptId(null);
                                }}
                                className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                              >
                                {savingDate ? "..." : "Save"}
                              </button>
                              <button
                                onClick={() => setEditingAttemptId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                ✕
                              </button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              Next: {attempt.nextAttemptDate ? formatDate(attempt.nextAttemptDate) : "TBC"}
                              {canRecordCert && (
                                <button
                                  onClick={() => {
                                    const d = attempt.nextAttemptDate ? new Date(attempt.nextAttemptDate) : null;
                                    setEditingDate(d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : "");
                                    setEditingAttemptId(attempt.id);
                                  }}
                                  className="text-gray-300 hover:text-indigo-500 transition-colors"
                                  title="Edit next attempt date"
                                >
                                  ✏️
                                </button>
                              )}
                            </span>
                          )
                        )}
                      </div>
                      {attempt.notes && (
                        <p className="text-xs text-gray-500 italic">{attempt.notes}</p>
                      )}
                      {attempt.certAudits.length > 0 && (
                        <div className="space-y-0.5 pt-1">
                          {attempt.certAudits.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 text-xs">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${certBadge(a.result)}`}>
                                {a.result ?? "Pending"}
                              </span>
                              <span className="text-gray-700">{a.auditorName}</span>
                              <span className="text-gray-400">({a.role})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Legacy COS audits (no certAttemptId) */}
              {phase.type === "COS" && phase.certAudits.filter(a => !phase.certAttempts.some(at => at.certAudits.some(ca => ca.id === a.id))).length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-400 italic">Previous audit records:</p>
                  {phase.certAudits.filter(a => !phase.certAttempts.some(at => at.certAudits.some(ca => ca.id === a.id))).map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${certBadge(a.result)}`}>
                        {a.result ?? "Pending"}
                      </span>
                      <span className="text-gray-700">{a.auditorName}</span>
                      <span className="text-gray-400">({a.role})</span>
                      {a.auditedAt && <span className="text-gray-400">{formatDate(a.auditedAt)}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Record attempt form */}
              {showAttemptForm && canRecordCert && (
                <div className={`mt-2 bg-white/80 rounded-lg p-3 space-y-3 border ${phase.type === "GD" ? "border-blue-200" : "border-purple-200"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700">
                      Record {ordinalLabel(typeof attemptNumberOverride === "number" && phase.type === "GD" ? attemptNumberOverride : phase.certAttempts.length + 1)} Attempt
                    </p>
                    {phase.type === "GD" && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span>Attempt #</span>
                        <input
                          type="number"
                          min={1}
                          value={attemptNumberOverride}
                          onChange={(e) => setAttemptNumberOverride(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 px-2 py-1 rounded border border-gray-300 bg-white text-center focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Auditor list for COS */}
                  {phase.type === "COS" && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-600">Auditors</p>
                      {cosAuditors.map((a, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`w-16 text-center px-1.5 py-0.5 rounded font-medium ${
                              a.auditorRole === "PRIMARY" ? "bg-purple-100 text-purple-700"
                              : a.auditorRole === "LEAD" ? "bg-indigo-100 text-indigo-700"
                              : "bg-gray-100 text-gray-500"
                            }`}>{a.auditorRole}</span>
                            <input
                              type="text"
                              value={a.auditorName}
                              onChange={(e) => {
                                const updated = [...cosAuditors];
                                updated[i] = { ...updated[i], auditorName: e.target.value };
                                setCosAuditors(updated);
                              }}
                              placeholder="Auditor name"
                              className="flex-1 px-2 py-1 rounded border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                            />
                            {i > 0 && (
                              <button
                                onClick={() => setCosAuditors(cosAuditors.filter((_, j) => j !== i))}
                                className="text-gray-400 hover:text-red-500 text-xs"
                              >✕</button>
                            )}
                          </div>
                          <div className="flex gap-3 ml-18 pl-[72px] text-xs">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                checked={a.auditorResult === "PASSED"}
                                onChange={() => {
                                  const updated = [...cosAuditors];
                                  updated[i] = { ...updated[i], auditorResult: "PASSED" };
                                  setCosAuditors(updated);
                                }}
                              />
                              <span className="text-green-700 font-medium">Pass</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                checked={a.auditorResult === "FAILED"}
                                onChange={() => {
                                  const updated = [...cosAuditors];
                                  updated[i] = { ...updated[i], auditorResult: "FAILED" };
                                  setCosAuditors(updated);
                                }}
                              />
                              <span className="text-red-700 font-medium">Fail</span>
                            </label>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setCosAuditors([...cosAuditors, { auditorName: "", auditorRole: "LEAD" }])}
                        className="text-xs text-purple-600 hover:underline"
                      >
                        + Add auditor
                      </button>
                    </div>
                  )}

                  {/* Result */}
                  {phase.type === "COS" ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600 font-medium">Overall Result:</span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${certBadge(derivedCosResult)}`}>
                        {derivedCosResult}
                      </span>
                      <span className="text-gray-400">(derived from auditors)</span>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="radio" value="PASSED" checked={attemptResult === "PASSED"} onChange={() => setAttemptResult("PASSED")} />
                        <span className="text-green-700 font-medium">Passed</span>
                      </label>
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="radio" value="FAILED" checked={attemptResult === "FAILED"} onChange={() => setAttemptResult("FAILED")} />
                        <span className="text-red-700 font-medium">Failed</span>
                      </label>
                    </div>
                  )}

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cert Date</label>
                    <input
                      type="date"
                      value={attemptDate}
                      onChange={(e) => setAttemptDate(e.target.value)}
                      className="text-xs px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Google Drive link */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Google Drive Link (optional)</label>
                    <input
                      type="url"
                      value={driveLink}
                      onChange={(e) => setDriveLink(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full text-xs px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Notes */}
                  <textarea
                    value={attemptNotes}
                    onChange={(e) => setAttemptNotes(e.target.value)}
                    rows={2}
                    placeholder="Notes (optional)..."
                    className="w-full text-xs px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  />

                  {/* Next attempt date — shown when result is FAILED */}
                  {((phase.type === "COS" && derivedCosResult === "FAILED") || (phase.type === "GD" && attemptResult === "FAILED")) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Next Attempt Date <span className="text-gray-400 font-normal">(optional — leave blank for TBC)</span>
                      </label>
                      <input
                        type="date"
                        value={nextAttemptDate}
                        onChange={(e) => setNextAttemptDate(e.target.value)}
                        className="text-xs px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {/* Schedule preference — COS role + PASSED */}
                  {phase.type === "COS" && hireRole === "COS" && derivedCosResult === "PASSED" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Schedule Preference <span className="text-gray-400">(for RTA)</span>
                      </label>
                      <textarea
                        value={schedulePreference}
                        onChange={(e) => setSchedulePreference(e.target.value)}
                        rows={2}
                        placeholder="e.g. Morning shift, Mon–Fri, 8am start"
                        className="w-full text-xs px-2 py-1.5 rounded border border-purple-300 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleAttemptSave}
                      disabled={savingAttempt}
                      className={`text-xs text-white px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                        phase.type === "GD" ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"
                      }`}
                    >
                      {savingAttempt ? "Saving..." : "Save Attempt"}
                    </button>
                    <button
                      onClick={() => {
                        setShowAttemptForm(false);
                        setDriveLink("");
                        setNextAttemptDate("");
                      }}
                      className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit form */}
      {editing && isMyPhase && (
        <div className="mt-3 space-y-3 bg-white/70 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          {phase.type === "GD" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Trainer <span className="text-red-500">*</span>
                </label>
                <select
                  value={gdTrainerId}
                  onChange={(e) => setGdTrainerId(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select trainer...</option>
                  {allUsers.filter(u => u.team === "GD_TRAINING" || u.team === "ADMIN").map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Mentor <span className="text-red-500">*</span>
                </label>
                <MentorCombobox
                  mentors={mentors}
                  value={gdMentorIds}
                  onChange={setGdMentorIds}
                  multiple
                  placeholder="Search mentor..."
                />
              </div>
            </div>
          )}

          {phase.type === "COS" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Trainer</label>
                <select
                  value={cosTrainerId}
                  onChange={(e) => setCosTrainerId(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select trainer...</option>
                  {allUsers.filter(u => u.team === "COS_TRAINING" || u.team === "ADMIN").map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mentor</label>
                <MentorCombobox
                  mentors={mentors}
                  value={cosMentorIds}
                  onChange={setCosMentorIds}
                  multiple
                  placeholder="Search mentor..."
                />
              </div>
            </div>
          )}

          {phase.type === "MENU" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Trainer</label>
              <select
                value={menuTrainerId}
                onChange={(e) => setMenuTrainerId(e.target.value)}
                className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select trainer...</option>
                {allUsers.filter(u => u.team === "MENU_TRAINING" || u.team === "ADMIN").map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add any notes..."
              className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
