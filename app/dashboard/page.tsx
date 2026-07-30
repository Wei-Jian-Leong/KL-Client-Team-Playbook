import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getDisplayStatus } from "@/lib/hireStatus";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import DashboardView from "@/components/DashboardView";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.isNewHire) redirect("/training-materials");

  const jar = await cookies();
  const previewAs = jar.get("preview_as")?.value ?? null;

  const [allHires, dbUser] = await Promise.all([
    prisma.newHire.findMany({
      include: {
        trainingPhases: { orderBy: { startDate: "asc" } },
        tasks: true,
        createdBy: true,
      },
      orderBy: { joinDate: "asc" },
    }),
    prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } }),
  ]);

  const isAdmin = !!dbUser?.isAdmin;
  const effectiveIsAdmin = isAdmin && !previewAs;
  const isHROrAdmin = (session.team === "HR" || isAdmin) && !previewAs;

  const newHires = isHROrAdmin
    ? allHires
    : allHires.filter((h) => h.status !== "DELETED");

  const hiresWithStatus = newHires.map((h) => ({
    ...h,
    displayStatus: getDisplayStatus(h),
  }));

  const stats = {
    total: hiresWithStatus.filter(
      (h) => h.displayStatus !== "DELETED" && h.displayStatus !== "RESIGNED"
    ).length,
    upcoming: hiresWithStatus.filter((h) => h.displayStatus === "UPCOMING").length,
    ongoing: hiresWithStatus.filter((h) => h.displayStatus === "ONGOING").length,
    completed: hiresWithStatus.filter((h) => h.displayStatus === "COMPLETED").length,
    resigned: hiresWithStatus.filter((h) => h.displayStatus === "RESIGNED").length,
  };

  return (
    <DashboardView
      hires={hiresWithStatus}
      isHROrAdmin={isHROrAdmin}
      sessionTeam={session.team}
      isAdmin={effectiveIsAdmin}
      stats={stats}
      />
  );
}
