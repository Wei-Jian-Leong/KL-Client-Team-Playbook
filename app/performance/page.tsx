import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { formatDate, getRoleLabel } from "@/lib/training";
import { getDisplayStatus, STATUS_STYLES } from "@/lib/hireStatus";
import { getPerformancePeriods } from "@/lib/performance";
import Link from "next/link";
import PerformanceFilters from "@/components/PerformanceFilters";
import PerformanceTabs from "@/components/PerformanceTabs";
import { Suspense } from "react";

const PERIOD_NAMES: Record<number, string> = {
  1: "First Month",
  2: "Second Month",
  3: "Third Month",
  4: "Fourth Month",
};

const metricFields = [
  { key: "aht", label: "AHT" },
  { key: "str", label: "STR" },
  { key: "mistakeRate", label: "Mistake" },
  { key: "adherence", label: "Adherence" },
  { key: "fcr", label: "FCR" },
];

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    kwave?: string; ksort?: string; kname?: string;
    cwave?: string; csort?: string; cname?: string; csorton?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const tab = params.tab === "kpi" ? "kpi" : "cert";

  // KPI tab params
  const kwave = params.kwave;
  const ksort = params.ksort;
  const kname = params.kname?.trim() || undefined;

  // Cert tab params
  const cwave = params.cwave;
  const csort = params.csort;
  const cname = params.cname?.trim() || undefined;
  const csorton = params.csorton ?? "name"; // "name" | "date" | "wave"

  const waveRows = await prisma.newHire.findMany({
    where: { waveNumber: { not: null } },
    select: { waveNumber: true },
    distinct: ["waveNumber"],
    orderBy: { waveNumber: "asc" },
  });
  const waves = waveRows.map((r) => r.waveNumber as number);

  if (tab === "kpi") {
    const cosHires = await prisma.newHire.findMany({
      where: {
        role: "COS",
        status: { not: "DELETED" },
        ...(kwave ? { waveNumber: parseInt(kwave) } : {}),
        ...(kname ? { name: { contains: kname } } : {}),
      },
      include: {
        performances: { orderBy: { period: "asc" } },
        trainingPhases: {
          where: { type: "COS" },
          include: {
            certAttempts: {
              where: { result: "PASSED" },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { name: ksort === "desc" ? "desc" : "asc" },
    });

    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Hire Performance</h1>
        </div>

        <Suspense>
          <PerformanceTabs activeTab="kpi" />
        </Suspense>

        <Suspense>
          <PerformanceFilters waves={waves} prefix="k" sort={ksort} name={kname} />
        </Suspense>

        {cosHires.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-400">No COS hires found for this filter.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {cosHires.map((hire) => {
              const ds = getDisplayStatus(hire);
              const style = STATUS_STYLES[ds];
              const cosPhase = hire.trainingPhases[0];
              const cosCertDate = cosPhase?.certAttempts[0]?.certDate ?? null;
              const periods = getPerformancePeriods(hire.joinDate, cosCertDate);

              return (
                <div
                  key={hire.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{hire.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {getRoleLabel(hire.role)} · Join: {formatDate(hire.joinDate)}
                        {hire.waveNumber != null && ` · Wave ${hire.waveNumber}`}
                      </span>
                    </div>
                    <Link
                      href={`/new-hire/${hire.id}/performance`}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      Edit →
                    </Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-100 dark:border-gray-700">
                        <tr>
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-40">
                            Period
                          </th>
                          {metricFields.map((f) => (
                            <th
                              key={f.key}
                              className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                            >
                              {f.label}
                            </th>
                          ))}
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                        {[1, 2, 3, 4].map((period) => {
                          const perf = hire.performances.find(
                            (p) => p.period === period && p.type === "KPI"
                          );
                          const periodInfo = periods[period - 1];
                          return (
                            <tr
                              key={period}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                            >
                              <td className="px-5 py-3">
                                <p className="font-medium text-gray-800 dark:text-gray-200 text-xs">
                                  {PERIOD_NAMES[period] ?? `Period ${period}`}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  {periodInfo.isTBC ? "TBC" : periodInfo.label}
                                </p>
                              </td>
                              {metricFields.map((f) => {
                                const val = perf
                                  ? (perf as Record<string, unknown>)[f.key]
                                  : null;
                                return (
                                  <td key={f.key} className="px-4 py-3 text-center">
                                    {val != null ? (
                                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                                        {String(val)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-300 dark:text-gray-600">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                {perf?.notes || (
                                  <span className="text-gray-300 dark:text-gray-600">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Cert tab
  const dir = csort === "desc" ? "desc" : "asc";
  const certPerfs = await prisma.performance.findMany({
    where: {
      type: "CERT",
      ...(cwave ? { newHire: { waveNumber: parseInt(cwave) } } : {}),
      ...(cname ? { newHire: { name: { contains: cname } } } : {}),
    },
    include: {
      newHire: { select: { id: true, name: true, role: true, joinDate: true, waveNumber: true } },
    },
    orderBy: csorton === "date" ? { startDate: dir }
           : csorton === "wave" ? { newHire: { waveNumber: dir } }
           : { newHire: { name: dir } },
  });

  // Group cert records by hire so each hire appears as one row
  const certByHire = new Map<string, typeof certPerfs>();
  for (const p of certPerfs) {
    const arr = certByHire.get(p.newHire.id) ?? [];
    arr.push(p);
    certByHire.set(p.newHire.id, arr);
  }
  const groupedCerts = Array.from(certByHire.values());

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Hire Performance</h1>
      </div>

      <Suspense>
        <PerformanceTabs activeTab="cert" />
      </Suspense>

      <Suspense>
        <PerformanceFilters waves={waves} prefix="c" sort={csort} name={cname} />
      </Suspense>

      {groupedCerts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-400">No certification records found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Wave
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Certification
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Cert Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Join Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {groupedCerts.map((group) => {
                const first = group[0];
                return (
                  <tr
                    key={first.newHire.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/new-hire/${first.newHire.id}`}
                        className="font-medium text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                      >
                        {first.newHire.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {getRoleLabel(first.newHire.role)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {first.newHire.waveNumber != null ? `Wave ${first.newHire.waveNumber}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        {group.map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5 text-xs">
                            <span className="text-green-500 font-bold flex-shrink-0">✓</span>
                            <span className="text-gray-800 dark:text-gray-200 font-medium leading-snug">
                              {p.periodLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      <div className="space-y-1">
                        {group.map((p) => (
                          <div key={p.id}>{formatDate(p.startDate)}</div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(first.newHire.joinDate)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                      <div className="space-y-1">
                        {group.map((p) =>
                          p.notes ? (
                            <div key={p.id} className="italic">{p.notes}</div>
                          ) : null
                        )}
                        {group.every((p) => !p.notes) && (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
