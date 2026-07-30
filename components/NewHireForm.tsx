"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createNewHire } from "@/app/actions/newhire";
import { calculateTrainingSchedule, formatDate, getRoleLabel, HireRole } from "@/lib/training";
import { toInputDate } from "@/lib/dates";

const SITE_OPTIONS: Record<string, string[]> = {
  CH: ["Remote", "Shenzhen"],
  DR: ["Onsite", "Remote"],
  MY: ["KL", "Remote"],
  PH: ["DGT", "RBC-T1", "Remote"],
  US: ["LIC", "Remote", "SNM"],
};

const EMPLOYMENT_TYPES = [
  "Regular Full Time",
  "Regular Part-Time",
  "Contractor",
  "Probationary",
  "Others",
];

const ROLES: { value: HireRole; label: string }[] = [
  { value: "COS", label: "Client Operations Specialist (COS)" },
  { value: "PIS", label: "Product Implementation Specialist (PIS)" },
  { value: "OSM", label: "Onboarding Success Manager (OSM)" },
  { value: "AE", label: "Account Executive (AE)" },
  { value: "BILLING_COLLECTION", label: "Billing & Collection Specialist" },
  { value: "OTHERS", label: "Others" },
];

interface JoinDateSlot {
  id: string;
  date: Date;
  label: string | null;
  hireCount?: number;
}

interface Props {
  joinDateSlots: JoinDateSlot[];
  hireLimit?: number;
  isAdmin?: boolean;
}

export default function NewHireForm({ joinDateSlots, hireLimit = 5, isAdmin = false }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createNewHire, null);
  const [role, setRole] = useState<HireRole | "">("");
  const [joinDate, setJoinDate] = useState("");
  const [joinDateType, setJoinDateType] = useState<"slot" | "request">("slot");
  const [preview, setPreview] = useState<{ type: string; startDate: Date; endDate: Date }[]>([]);
  const [location, setLocation] = useState("");
  const [site, setSite] = useState("");
  const [employeeType, setEmployeeType] = useState("");
  const [laptopNeeded, setLaptopNeeded] = useState("");
  const [equipmentDelivery, setEquipmentDelivery] = useState("");

  useEffect(() => {
    if (role && joinDate && joinDateType === "slot") {
      const schedule = calculateTrainingSchedule(new Date(joinDate), role as HireRole);
      setPreview(schedule);
    } else {
      setPreview([]);
    }
  }, [role, joinDate, joinDateType]);

  useEffect(() => {
    if (state?.success) {
      if (state.requested) {
        alert("Join date request submitted! Admin will be notified.");
        router.push("/dashboard");
      } else if (state.id) {
        router.push(`/new-hire/${state.id}`);
      }
    }
  }, [state, router]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <form action={action} autoComplete="off" className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900 text-base">New Hire Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                required
                autoComplete="new-password"
                placeholder="e.g. Alex Tan"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NRIC <span className="text-red-500">*</span>
              </label>
              <input
                name="nric"
                required
                autoComplete="new-password"
                placeholder="e.g. 880315-10-1234"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bamboo EID <span className="text-red-500">*</span>
              </label>
              <input
                name="bambooEid"
                required
                autoComplete="new-password"
                placeholder="e.g. 9042"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="new-password"
                placeholder="e.g. alex.tan@wondersco.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                name="role"
                required
                value={role}
                onChange={(e) => setRole(e.target.value as HireRole)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              >
                <option value="">Select role...</option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Team Lead
              </label>
              <select
                name="teamLeadName"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              >
                <option value="">Select team lead...</option>
                <option value="Joel Tan">Joel Tan</option>
                <option value="Darren Wong">Darren Wong</option>
                <option value="Gaberial Ng">Gaberial Ng</option>
                <option value="Francine Destura">Francine Destura</option>
                <option value="Tallia Tang">Tallia Tang</option>
              </select>
            </div>

          </div>

          {role === "OTHERS" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Description <span className="text-red-500">*</span>
              </label>
              <input
                name="roleDescription"
                required
                placeholder="Describe the role..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          )}

          {/* Join Date */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Join Date <span className="text-red-500">*</span>
            </label>

            <input type="hidden" name="joinDateType" value={joinDateType} />

            {joinDateType === "slot" ? (
              <>
                <select
                  name="joinDate"
                  required
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                >
                  <option value="">Select join date...</option>
                  {joinDateSlots.map((slot) => {
                    const count = slot.hireCount ?? 0;
                    const isFull = count >= hireLimit;
                    const label = new Date(slot.date).toLocaleDateString("en-US", {
                      day: "numeric", month: "long", year: "numeric", timeZone: "America/New_York",
                    });
                    const suffix = slot.label ? ` — ${slot.label}` : "";
                    const capacity = ` (${count}/${hireLimit})`;
                    const fullTag = isFull && !isAdmin ? " 🔒 Full" : isFull ? " ⚠️ Full (admin override)" : "";
                    return (
                      <option key={slot.id} value={toInputDate(slot.date)} disabled={isFull && !isAdmin}>
                        {label}{suffix}{capacity}{fullTag}
                      </option>
                    );
                  })}
                </select>

                {/* Capacity warning when a full slot is selected by admin */}
                {(() => {
                  const selected = joinDateSlots.find((s) => toInputDate(s.date) === joinDate);
                  const count = selected?.hireCount ?? 0;
                  if (selected && count >= hireLimit && isAdmin) {
                    return (
                      <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
                        ⚠️ This date has reached the {hireLimit}-hire limit. You are proceeding as admin override.
                      </p>
                    );
                  }
                  if (selected && count >= hireLimit && !isAdmin) {
                    return (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
                        🔒 This date is full ({hireLimit}/{hireLimit} hires). Please select another date or{" "}
                        <button
                          type="button"
                          onClick={() => { setJoinDateType("request"); setJoinDate(""); }}
                          className="font-semibold underline"
                        >
                          request admin approval
                        </button>.
                      </div>
                    );
                  }
                  return null;
                })()}

                <button
                  type="button"
                  onClick={() => { setJoinDateType("request"); setJoinDate(""); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                >
                  Request a custom date →
                </button>
              </>
            ) : (
              <>
                <input
                  type="date"
                  name="joinDate"
                  required
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Reason for requesting this date <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="requestReason"
                    rows={2}
                    required
                    placeholder="Explain why a new join date is needed..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setJoinDateType("slot"); setJoinDate(""); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  ← Available dates
                </button>
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  This will submit a request to admin. The hire will NOT be created until the date is approved.
                </p>
              </>
            )}
          </div>

          {/* IT Ticket Details */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">IT Ticket Details</h3>
            <p className="text-xs text-gray-400 -mt-2">These fields will be used to auto-create the Jira onboarding ticket.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Email <span className="text-red-500">*</span>
                </label>
                <input
                  name="personalEmail"
                  type="email"
                  required
                  autoComplete="new-password"
                  placeholder="e.g. alex.tan88@gmail.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manager&apos;s Work Email <span className="text-red-500">*</span>
                </label>
                <input
                  name="managerEmail"
                  type="email"
                  required
                  autoComplete="new-password"
                  placeholder="e.g. timothy.cu@wondersco.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <select
                  name="location"
                  required
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); setSite(""); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                  <option value="">Select location...</option>
                  {Object.keys(SITE_OPTIONS).map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site <span className="text-red-500">*</span>
                </label>
                <select
                  name="site"
                  required
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  disabled={!location}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">Select site...</option>
                  {(SITE_OPTIONS[location] ?? []).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee&apos;s Division <span className="text-red-500">*</span>
                </label>
                <input
                  name="division"
                  required
                  autoComplete="new-password"
                  placeholder="e.g. Customer Operations"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee&apos;s Department <span className="text-red-500">*</span>
                </label>
                <input
                  name="department"
                  required
                  autoComplete="new-password"
                  placeholder="e.g. Customer Operations"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee&apos;s Team
                </label>
                <input
                  name="employeeTeam"
                  autoComplete="new-password"
                  placeholder="e.g. COS Team A"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="employmentType"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                  <option value="">Select employment type...</option>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="employeeType"
                  required
                  value={employeeType}
                  onChange={(e) => setEmployeeType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                  <option value="">Select employee type...</option>
                  <option value="Agent">Agent</option>
                  <option value="Non-agent">Non-agent</option>
                </select>
              </div>
            </div>

            {employeeType === "Non-agent" && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Laptop Needed */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Laptop Needed? <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="laptopNeeded"
                      required
                      value={laptopNeeded}
                      onChange={(e) => {
                        setLaptopNeeded(e.target.value);
                        if (e.target.value !== "Yes (Mac)" && e.target.value !== "Yes (Windows)") {
                          setEquipmentDelivery("");
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                    >
                      <option value="">Select...</option>
                      <option value="Yes (Mac)">Yes (Mac)</option>
                      <option value="Yes (Windows)">Yes (Windows)</option>
                      <option value="No (Bring Your Own Device)">No (Bring Your Own Device)</option>
                      <option value="No">No</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Equipment Delivery — only when laptop is needed */}
                  {(laptopNeeded === "Yes (Mac)" || laptopNeeded === "Yes (Windows)") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Equipment Delivery Method <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="equipmentDelivery"
                        required
                        value={equipmentDelivery}
                        onChange={(e) => setEquipmentDelivery(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                      >
                        <option value="">Select...</option>
                        <option value="On-site pickup">On-site pickup</option>
                        <option value="Ship">Ship</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Laptop Other — free text */}
                {laptopNeeded === "Other" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Please specify <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="laptopNeededOther"
                      required
                      autoComplete="new-password"
                      placeholder="Please specify..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                )}

                {/* Ship — address + phone */}
                {equipmentDelivery === "Ship" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Home Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="equipmentDeliveryAddress"
                        required
                        autoComplete="new-password"
                        placeholder="Full home address for delivery"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Personal Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="personalPhone"
                        required
                        autoComplete="new-password"
                        placeholder="e.g. +601x-xxxxxxx"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{state.error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              id="create-hire-btn"
              type="submit"
              disabled={pending || (() => {
                if (isAdmin || joinDateType !== "slot") return false;
                const selected = joinDateSlots.find((s) => toInputDate(s.date) === joinDate);
                return !!selected && (selected.hireCount ?? 0) >= hireLimit;
              })()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Submitting..." : joinDateType === "request" ? "Send Request" : "Create Hire"}
            </button>
            <a
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>

      {/* Training Preview */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
          <h2 className="font-semibold text-gray-900 text-base mb-4">Training Preview</h2>

          {preview.length === 0 ? (
            <p className="text-sm text-gray-400">Select a role and join date to preview the training schedule.</p>
          ) : (
            <div className="space-y-3">
              {role && (
                <p className="text-xs text-gray-500 mb-3">
                  Track for <strong>{getRoleLabel(role as HireRole)}</strong>
                </p>
              )}
              {preview.map((phase, i) => (
                <div key={phase.type} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      phase.type === "GD" ? "bg-blue-500" : phase.type === "COS" ? "bg-purple-500" : "bg-orange-500"
                    }`}>
                      {i + 1}
                    </div>
                    {i < preview.length - 1 && <div className="w-0.5 h-6 bg-gray-200 mt-1" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-sm font-medium text-gray-900">
                      {phase.type === "GD" ? "GD Training" : phase.type === "COS" ? "COS Training" : "Menu Training"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(phase.startDate)} → {formatDate(phase.endDate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
