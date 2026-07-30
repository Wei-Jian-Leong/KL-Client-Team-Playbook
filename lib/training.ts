export type HireRole = "COS" | "PIS" | "OSM" | "AE" | "BILLING_COLLECTION" | "OTHERS";
export type TrainingType = "GD" | "COS" | "MENU";

export type TrainingConfig = {
  type: TrainingType;
  days: number;
};

const FULL_TRACK: TrainingConfig[] = [
  { type: "GD", days: 7 },
  { type: "COS", days: 8 },
];

const FULL_TRACK_WITH_MENU: TrainingConfig[] = [
  { type: "GD", days: 7 },
  { type: "COS", days: 8 },
  { type: "MENU", days: 10 },
];

const SHORT_TRACK: TrainingConfig[] = [
  { type: "GD", days: 2 },
  { type: "COS", days: 4 },
];

const SHORT_TRACK_WITH_MENU: TrainingConfig[] = [
  { type: "GD", days: 2 },
  { type: "COS", days: 4 },
  { type: "MENU", days: 4 },
];

export function getTrainingTrack(role: HireRole): TrainingConfig[] {
  switch (role) {
    case "COS":
      return FULL_TRACK;
    case "PIS":
    case "OSM":
      return FULL_TRACK_WITH_MENU;
    case "AE":
      return SHORT_TRACK_WITH_MENU;
    case "BILLING_COLLECTION":
      return SHORT_TRACK;
    case "OTHERS":
    default:
      return FULL_TRACK;
  }
}

export function getFirstMondayOfMonth(date: Date): Date {
  // Use UTC accessors so the result is timezone-safe (dates stored as UTC noon)
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const d = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const dow = d.getUTCDay();
  const diff = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
  d.setUTCDate(1 + diff);
  return d;
}

export function addWorkingDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days - 1) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

export function nextWorkingDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

export type TrainingSchedule = {
  type: TrainingType;
  startDate: Date;
  endDate: Date;
};

export function calculateTrainingSchedule(joinDate: Date, role: HireRole): TrainingSchedule[] {
  const track = getTrainingTrack(role);
  const trainingStart = getFirstMondayOfMonth(joinDate);
  const schedule: TrainingSchedule[] = [];

  let currentStart = new Date(trainingStart);
  for (const phase of track) {
    const endDate = addWorkingDays(currentStart, phase.days);
    schedule.push({ type: phase.type, startDate: new Date(currentStart), endDate });
    currentStart = nextWorkingDay(endDate);
  }

  return schedule;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    COS: "Client Operations Specialist",
    PIS: "Product Implementation Specialist",
    OSM: "Onboarding Success Manager",
    AE: "Account Executive",
    BILLING_COLLECTION: "Billing & Collection Specialist",
    OTHERS: "Others",
  };
  return labels[role] || role;
}

export function getTeamLabel(team: string): string {
  const labels: Record<string, string> = {
    HR: "HR",
    IT: "IT",
    RTA: "RTA",
    GD_TRAINING: "GD Training",
    COS_TRAINING: "COS Training",
    MENU_TRAINING: "Menu Training",
    ADMIN: "Admin",
    NEW_HIRE: "New Hire",
  };
  return labels[team] || team;
}

// Wave 48 = July 2026. Each subsequent batch (month) increments by 1.
const WAVE_BASE = 48;
const WAVE_BASE_YEAR = 2026;
const WAVE_BASE_MONTH = 6; // July = 6 (0-based)

export function computeWaveNumber(joinDate: Date): number {
  const y = joinDate.getUTCFullYear();
  const m = joinDate.getUTCMonth();
  const monthsFromBase = (y - WAVE_BASE_YEAR) * 12 + (m - WAVE_BASE_MONTH);
  return WAVE_BASE + monthsFromBase;
}
