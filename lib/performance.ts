export type PeriodInfo = {
  period: number;
  label: string;
  startDate: Date | null;
  endDate: Date | null;
  isTBC: boolean;
};

export function getPerformancePeriods(
  joinDate: Date,
  cosCertDate?: Date | null
): PeriodInfo[] {
  if (!cosCertDate) {
    return [1, 2, 3, 4].map((period) => ({
      period,
      label: "TBC",
      startDate: null,
      endDate: null,
      isTBC: true,
    }));
  }

  const base = new Date(cosCertDate);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth(); // 0-based
  const day = base.getUTCDate();

  // If cert passed after the 13th, KPI starts the following month
  const anchorMonth = day > 13 ? m + 1 : m;

  return [1, 2, 3, 4].map((i) => {
    const startDate = new Date(Date.UTC(y, anchorMonth + i - 2, 29, 12, 0, 0));
    const endDate = new Date(Date.UTC(y, anchorMonth + i - 1, 28, 12, 0, 0));
    const label = endDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "America/New_York",
    });
    return { period: i, label, startDate, endDate, isTBC: false };
  });
}
