import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/training";

const typeStyle: Record<string, { bg: string; text: string; dot: string }> = {
  GD:  { bg: "bg-blue-100 dark:bg-blue-900/40",   text: "text-blue-700 dark:text-blue-300",   dot: "bg-blue-500" },
  COS: { bg: "bg-violet-100 dark:bg-violet-900/40",text: "text-violet-700 dark:text-violet-300",dot: "bg-violet-500" },
};

const statusRing: Record<string, string> = {
  IN_PROGRESS: "ring-2 ring-offset-1 ring-blue-400 dark:ring-blue-500",
  COMPLETED:   "opacity-60",
  PENDING:     "",
};

export default async function TrainingScheduleBar() {
  const phases = await prisma.trainingPhase.findMany({
    where: {
      type: { in: ["GD", "COS"] },
      startDate: { gte: new Date("2026-01-01"), lt: new Date("2027-01-01") },
    },
    include: {
      newHire: { select: { id: true, name: true, status: true, deletedAt: true } },
    },
    orderBy: { startDate: "asc" },
  });

  // Filter out deleted/resigned hires
  const filtered = phases.filter(
    (p) => p.newHire.status !== "RESIGNED" && !p.newHire.deletedAt
  );

  // Group by hire
  const byHire = new Map<string, { name: string; id: string; phases: typeof filtered }>();
  for (const p of filtered) {
    const key = p.newHire.id;
    if (!byHire.has(key)) byHire.set(key, { name: p.newHire.name, id: key, phases: [] });
    byHire.get(key)!.phases.push(p);
  }

  if (byHire.size === 0) return null;

  const entries = Array.from(byHire.values()).sort(
    (a, b) => Math.min(...a.phases.map((p) => p.startDate.getTime())) - Math.min(...b.phases.map((p) => p.startDate.getTime()))
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700/60 px-6 py-2 overflow-x-auto">
      <div className="flex items-center gap-1.5 min-w-max">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-2 shrink-0">
          2026 Schedule
        </span>
        {entries.map((hire, hi) => (
          <div key={hire.id} className="flex items-center gap-1">
            {hi > 0 && <span className="text-gray-300 dark:text-gray-600 mx-1 text-sm">·</span>}
            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 shrink-0 mr-1">
              {hire.name.split(" ")[0]}
            </span>
            {hire.phases.map((phase) => {
              const ts = typeStyle[phase.type];
              const sr = statusRing[phase.status] ?? "";
              const isActive = phase.status === "IN_PROGRESS";
              return (
                <span
                  key={phase.id}
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${ts.bg} ${ts.text} ${sr}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "animate-pulse " : ""}${ts.dot}`} />
                  {phase.type}
                  <span className="opacity-70">{formatDate(phase.startDate)}–{formatDate(phase.endDate)}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
