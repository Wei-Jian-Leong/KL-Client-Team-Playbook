"use client";

import { useState, useTransition } from "react";
import { updateHireDetails } from "@/app/actions/newhire";
import { toInputDate } from "@/lib/dates";

const TEAM_LEADS = ["Joel Tan", "Darren Wong", "Gaberial Ng", "Francine Destura", "Tallia Tang"];

interface JoinDateSlot { id: string; date: Date; label: string | null }

interface Props {
  newHireId: string;
  hire: {
    bambooEid: string;
    teamLeadName: string | null;
    joinDate: Date;
    itTicketId: string | null;
    posId: string | null;
    waveNumber: number | null;
  };
  joinDateSlots: JoinDateSlot[];
  canEditDetails: boolean;    // HR Hiring or Admin — join date, team lead, EID
  canEditItTicket: boolean;   // IT or Admin
  canEditPosId: boolean;      // RTA or Admin
  isAdmin: boolean;
}

export default function EditHireDetails({
  newHireId, hire, joinDateSlots, canEditDetails, canEditItTicket, canEditPosId, isAdmin,
}: Props) {
  const [open, setOpen] = useState(false);
  const [joinDate, setJoinDate] = useState(toInputDate(hire.joinDate));
  const [teamLeadName, setTeamLeadName] = useState(hire.teamLeadName ?? "");
  const [bambooEid, setBambooEid] = useState(hire.bambooEid);
  const [itTicketId, setItTicketId] = useState(hire.itTicketId ?? "");
  const [posId, setPosId] = useState(hire.posId ?? "");
  const [waveNumber, setWaveNumber] = useState(hire.waveNumber != null ? String(hire.waveNumber) : "");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const canOpen = canEditDetails || canEditItTicket || canEditPosId;
  if (!canOpen) return null;

  function handleSave() {
    const fd = new FormData();
    fd.set("newHireId", newHireId);
    if (canEditDetails) {
      fd.set("joinDate", joinDate);
      fd.set("teamLeadName", teamLeadName);
      fd.set("bambooEid", bambooEid);
    }
    if (canEditItTicket) fd.set("itTicketId", itTicketId);
    if (canEditPosId) fd.set("posId", posId);
    if (isAdmin) fd.set("waveNumber", waveNumber);

    startTransition(async () => {
      const res = await updateHireDetails(fd);
      if (res?.error) setError(res.error);
      else { setOpen(false); setError(""); }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit details"
        className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Edit Hire Details</h2>

            {canEditDetails && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Join Date</label>
                  <select
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={toInputDate(hire.joinDate)}>
                      {new Date(hire.joinDate).toLocaleDateString("en-US", {
                        day: "numeric", month: "long", year: "numeric", timeZone: "America/New_York",
                      })} (current)
                    </option>
                    {joinDateSlots
                      .filter((s) => toInputDate(s.date) !== toInputDate(hire.joinDate))
                      .map((slot) => (
                        <option key={slot.id} value={toInputDate(slot.date)}>
                          {new Date(slot.date).toLocaleDateString("en-US", {
                            day: "numeric", month: "long", year: "numeric", timeZone: "America/New_York",
                          })}
                          {slot.label ? ` — ${slot.label}` : ""}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Changing join date will notify all teams.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Lead</label>
                  <select
                    value={teamLeadName}
                    onChange={(e) => setTeamLeadName(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None</option>
                    {TEAM_LEADS.map((tl) => (
                      <option key={tl} value={tl}>{tl}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bamboo EID</label>
                  <input
                    value={bambooEid}
                    onChange={(e) => setBambooEid(e.target.value)}
                    autoComplete="off"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </>
            )}

            {canEditItTicket && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IT Ticket ID</label>
                <input
                  value={itTicketId}
                  onChange={(e) => setItTicketId(e.target.value)}
                  autoComplete="off"
                  placeholder="e.g. WIT-56722"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {canEditPosId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">POS ID</label>
                <input
                  value={posId}
                  onChange={(e) => setPosId(e.target.value)}
                  autoComplete="off"
                  placeholder="Enter POS ID"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wave Number</label>
                <input
                  type="number"
                  value={waveNumber}
                  onChange={(e) => setWaveNumber(e.target.value)}
                  autoComplete="off"
                  placeholder="e.g. 48"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => { setOpen(false); setError(""); }}
                className="text-sm text-gray-600 dark:text-gray-400 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
