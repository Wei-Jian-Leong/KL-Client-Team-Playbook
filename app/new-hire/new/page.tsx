import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NewHireForm from "@/components/NewHireForm";
import BackButton from "@/components/BackButton";

export const HIRE_LIMIT_PER_SLOT = 5;

export default async function NewHirePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (session.team !== "HR" && !user?.isAdmin) {
    redirect("/dashboard");
  }

  const joinDateSlots = await prisma.joinDateSlot.findMany({
    where: { isAvailable: true, date: { gte: new Date() } },
    orderBy: { date: "asc" },
  });

  // Count active hires per join date slot
  const hireCounts = await prisma.newHire.groupBy({
    by: ["joinDate"],
    where: { status: { not: "DELETED" } },
    _count: { id: true },
  });

  const countByDate: Record<string, number> = {};
  for (const row of hireCounts) {
    const key = new Date(row.joinDate).toISOString().slice(0, 10);
    countByDate[key] = row._count.id;
  }

  const slotsWithCount = joinDateSlots.map((slot) => {
    const key = new Date(slot.date).toISOString().slice(0, 10);
    return { ...slot, hireCount: countByDate[key] ?? 0 };
  });

  return (
    <div className="max-w-7xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Hire</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Enter new hire details to kick off onboarding</p>
      </div>
      <NewHireForm
        joinDateSlots={slotsWithCount}
        hireLimit={HIRE_LIMIT_PER_SLOT}
        isAdmin={!!user?.isAdmin}
      />
    </div>
  );
}
