import { prisma } from "@/lib/prisma";
import { addWorkingDays, nextWorkingDay } from "@/lib/training";
import TrainingCalendar from "@/components/TrainingCalendar";

export default async function SchedulePage() {
  const GD_DAYS = 7;
  const COS_DAYS = 8;

  const slots = await prisma.joinDateSlot.findMany({
    where: { isAvailable: true },
    orderBy: { date: "asc" },
  });

  const computedPhases = slots.flatMap((slot) => {
    const gdStart = slot.date;
    const gdEnd = addWorkingDays(gdStart, GD_DAYS);
    const cosStart = nextWorkingDay(gdEnd);
    const cosEnd = addWorkingDays(cosStart, COS_DAYS);
    return [
      { type: "GD",  status: "SLOT", startDate: gdStart.toISOString(),  endDate: gdEnd.toISOString() },
      { type: "COS", status: "SLOT", startDate: cosStart.toISOString(), endDate: cosEnd.toISOString() },
    ];
  });

  // MENU: only show when there are actual hires needing menu training
  const menuPhases = await prisma.trainingPhase.findMany({
    where: {
      type: "MENU",
      newHire: { status: { not: "RESIGNED" }, deletedAt: null },
    },
    select: { type: true, status: true, startDate: true, endDate: true },
  });

  const menuSerialized = menuPhases.map((p) => ({
    type: p.type,
    status: p.status,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
  }));

  // Derive year range for display
  const allDates = slots.map((s) => s.date.getFullYear());
  const minYear = allDates.length ? Math.min(...allDates) : new Date().getFullYear();
  const maxYear = allDates.length ? Math.max(...allDates) : minYear;
  const yearLabel = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`;

  return (
    <div className="max-w-7xl mx-auto">
      <TrainingCalendar
        phases={[...computedPhases, ...menuSerialized]}
        showMenu={menuPhases.length > 0}
        yearLabel={yearLabel}
      />
    </div>
  );
}
