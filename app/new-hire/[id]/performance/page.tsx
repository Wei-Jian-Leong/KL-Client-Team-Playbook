import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import PerformanceTab from "@/components/PerformanceTab";
import BackButton from "@/components/BackButton";
import { getDisplayStatus, STATUS_STYLES } from "@/lib/hireStatus";
import { getRoleLabel, formatDate } from "@/lib/training";

export default async function PerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const [hire, user] = await Promise.all([
    prisma.newHire.findUnique({
      where: { id },
      include: {
        performances: true,
        trainingPhases: {
          include: {
            certAttempts: {
              where: { result: "PASSED" },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } }),
  ]);

  if (!hire) notFound();

  const cosPhase = hire.trainingPhases.find((p) => p.type === "COS");
  const cosCertDate = cosPhase?.certAttempts[0]?.certDate ?? null;

  const isCosTraining = session.team === "COS_TRAINING";
  const canEdit = isCosTraining || !!user?.isAdmin;

  const ds = getDisplayStatus(hire);
  const style = STATUS_STYLES[ds];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <BackButton />
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{hire.name}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.badge}`}>
            {style.label}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {getRoleLabel(hire.role)} · Join: {formatDate(hire.joinDate)}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <PerformanceTab
          newHireId={hire.id}
          hireName={hire.name}
          joinDate={hire.joinDate}
          cosCertDate={cosCertDate}
          performances={hire.performances}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
