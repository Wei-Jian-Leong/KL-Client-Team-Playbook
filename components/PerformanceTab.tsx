"use client";

import { useState, useTransition } from "react";
import { getPerformancePeriods, type PeriodInfo } from "@/lib/performance";
import { upsertPerformance } from "@/app/actions/performance";

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
  newHireId: string;
  hireName: string;
  joinDate: Date;
  cosCertDate?: Date | null;
  performances: Performance[];
  canEdit: boolean;
}

const PERIOD_NAMES: Record<number, string> = {
  1: "First Month",
  2: "Second Month",
  3: "Third Month",
  4: "Fourth Month",
};

export default function PerformanceTab({ newHireId, hireName, joinDate, cosCertDate, performances, canEdit }: Props) {
  const periods = getPerformancePeriods(new Date(joinDate), cosCertDate ? new Date(cosCertDate) : null);
  const [editingPeriod, setEditingPeriod] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  function getPerf(period: number) {
    return performances.find((p) => p.period === period);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>, period: number) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("newHireId", newHireId);
    fd.set("period", String(period));
    const p = periods[period - 1];
    fd.set("periodLabel", p.label);
    fd.set("startDate", p.startDate ? p.startDate.toISOString() : new Date().toISOString());
    fd.set("endDate", p.endDate ? p.endDate.toISOString() : new Date().toISOString());

    startTransition(async () => {
      const res = await upsertPerformance(fd);
      if (res?.error) {
        setMsg(res.error);
      } else {
        setMsg("Saved!");
        setEditingPeriod(null);
        setTimeout(() => setMsg(""), 2000);
      }
    });
  }

  const metricFields = [
    { key: "aht", label: "AHT (Average Handling Time)", unit: "min" },
    { key: "str", label: "STR (Single Touch Resolution)", unit: "%" },
    { key: "mistakeRate", label: "Mistake Rate", unit: "%" },
    { key: "adherence", label: "Adherence", unit: "%" },
    { key: "fcr", label: "FCR (First Call Resolution)", unit: "%" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">First 4 Month Performance — {hireName}</h2>
        <p className="text-sm text-gray-500">Join Date: {new Date(joinDate).toLocaleDateString()}</p>
      </div>

      {msg && (
        <div className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith("Saved") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg}
        </div>
      )}

      <div className="grid gap-4">
        {periods.map((p) => {
          const perf = getPerf(p.period);
          const isEditing = editingPeriod === p.period;

          return (
            <div key={p.period} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div>
                  <span className="font-semibold text-gray-800">{PERIOD_NAMES[p.period] ?? `Period ${p.period}`}:{" "}
                    {p.isTBC ? <span className="text-gray-400 font-normal">TBC</span> : p.label}
                  </span>
                  {!p.isTBC && p.startDate && p.endDate && (
                    <span className="ml-3 text-sm text-gray-500">
                      {new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {canEdit && !isEditing && !p.isTBC && (
                  <button
                    onClick={() => setEditingPeriod(p.period)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {perf ? "Edit" : "Enter Data"}
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={(e) => handleSubmit(e, p.period)} className="p-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {metricFields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {field.label}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            name={field.key}
                            step="0.01"
                            defaultValue={(perf as unknown as Record<string, unknown>)?.[field.key] as string ?? ""}
                            placeholder="—"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="absolute right-3 top-2 text-xs text-gray-400">{field.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <textarea
                      name="notes"
                      rows={2}
                      defaultValue={perf?.notes ?? ""}
                      placeholder="Optional notes..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPeriod(null)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-5">
                  {perf ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {metricFields.map((field) => {
                        const val = (perf as unknown as Record<string, unknown>)[field.key];
                        return (
                          <div key={field.key} className="text-center">
                            <p className="text-xs text-gray-500 mb-1">{field.key.toUpperCase()}</p>
                            <p className="text-xl font-bold text-gray-800">
                              {val != null ? `${val}${field.unit}` : "—"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No data entered yet</p>
                  )}
                  {perf?.notes && (
                    <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{perf.notes}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
