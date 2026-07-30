import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Training schedule helpers (mirrors lib/training.ts) ──────────────────────
function isWeekend(d) { const w = d.getUTCDay(); return w === 0 || w === 6; }

function addWorkingDays(start, days) {
  const d = new Date(start);
  let added = 0;
  while (added < days - 1) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!isWeekend(d)) added++;
  }
  return d;
}

function nextWorkingDay(date) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  while (isWeekend(d)) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function getFirstMondayOfMonth(date) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth();
  const d = new Date(Date.UTC(y, m, 1, 12, 0, 0));
  const dow = d.getUTCDay();
  d.setUTCDate(1 + (dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow));
  return d;
}

const TRACKS = {
  COS:                [{ type: "GD", days: 7 }, { type: "COS", days: 8 }],
  PIS:                [{ type: "GD", days: 7 }, { type: "COS", days: 8 }, { type: "MENU", days: 10 }],
  OSM:                [{ type: "GD", days: 7 }, { type: "COS", days: 8 }, { type: "MENU", days: 10 }],
  AE:                 [{ type: "GD", days: 2 }, { type: "COS", days: 4 }, { type: "MENU", days: 4 }],
  BILLING_COLLECTION: [{ type: "GD", days: 2 }, { type: "COS", days: 4 }],
  OTHERS:             [{ type: "GD", days: 7 }, { type: "COS", days: 8 }],
};
const MENU_ROLES = ["PIS", "OSM", "AE"];

function calcSchedule(joinDate, role) {
  const track = TRACKS[role] ?? TRACKS.OTHERS;
  let cur = getFirstMondayOfMonth(joinDate);
  return track.map((phase) => {
    const startDate = new Date(cur);
    const endDate = addWorkingDays(cur, phase.days);
    cur = nextWorkingDay(endDate);
    return { type: phase.type, startDate, endDate };
  });
}

function d(dateStr) {
  // Parse YYYY-MM-DD as UTC noon
  const [y, m, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
}

// ── Hire data from #my-onboarding Slack channel (2026 only) ──────────────────
// Wave 48 = Jul 6 (Brendan Chua's batch); earlier batches decrement from 48.
// 11 distinct join dates → Jan 5 = Wave 38 … Jul 6 = Wave 48.
const HIRES = [
  // Jan 5, 2026 — Wave 38
  { name: "New Jing Wen",          nric: "031214010864",     bambooEid: "7944", role: "COS",   joinDate: "2026-01-05", itTicketId: "WIT-50390", waveNumber: 38 },
  { name: "Clement Yap Khai Boon", nric: "021203140103",     bambooEid: "7941", role: "COS",   joinDate: "2026-01-05", itTicketId: "WIT-50390", waveNumber: 38 },
  { name: "Benny Lee Eryang",      nric: "960226105605",     bambooEid: "7945", role: "OSM",   joinDate: "2026-01-05", itTicketId: "WIT-50578", waveNumber: 38 },

  // Jan 12, 2026 — Wave 39
  { name: "Wei Loon Ooi",          nric: "980914835079",     bambooEid: "7942", role: "OTHERS",joinDate: "2026-01-12", itTicketId: "WIT-49988", waveNumber: 39 },

  // Jan 26, 2026 — Wave 40
  { name: "Lam Kuek Shen",         nric: "961118136505",     bambooEid: "7940", role: "COS",   joinDate: "2026-01-26", itTicketId: "WIT-50985", waveNumber: 40 },
  { name: "Helen Koh Kia Joo",     nric: "871112435134",     bambooEid: "7946", role: "COS",   joinDate: "2026-01-26", itTicketId: "WIT-50985", waveNumber: 40 },
  { name: "Jeconiah Khonry Tang",  nric: "030513130781",     bambooEid: "7950", role: "COS",   joinDate: "2026-01-26", itTicketId: "WIT-50985", waveNumber: 40 },
  { name: "Harvey Lum",            nric: "980829125435",     bambooEid: "7952", role: "COS",   joinDate: "2026-01-26", itTicketId: "WIT-50985", waveNumber: 40 },
  { name: "Rex Teh Boon Lok",      nric: "991004065021",     bambooEid: "93",   role: "COS",   joinDate: "2026-01-26", itTicketId: "WIT-50985", waveNumber: 40 },
  { name: "Yu Siu Ting",           nric: "990322125240",     bambooEid: "7887", role: "COS",   joinDate: "2026-01-26", itTicketId: "WIT-51239", waveNumber: 40 },
  { name: "Lye Elgene",            nric: "000128-10-1979",   bambooEid: "7951", role: "PIS",   joinDate: "2026-01-26", itTicketId: "WIT-50986", waveNumber: 40 },

  // Feb 2, 2026 — Wave 41
  { name: "Edison Lu",             nric: "8908281361090301", bambooEid: "7953", role: "OTHERS",joinDate: "2026-02-02", itTicketId: "WIT-51159", waveNumber: 41 },

  // Mar 2, 2026 — Wave 42
  { name: "Pheai Foong Loo",       nric: "961118-13-6505",   bambooEid: "7954", role: "COS",   joinDate: "2026-03-02", itTicketId: "WIT-51892", waveNumber: 42 },
  { name: "Cindy Loh",             nric: "940905-10-5836",   bambooEid: "7949", role: "COS",   joinDate: "2026-03-02", itTicketId: "WIT-51892", waveNumber: 42 },
  { name: "Daniel Leow",           nric: "010216-14-1419",   bambooEid: "7968", role: "COS",   joinDate: "2026-03-02", itTicketId: "WIT-51892", waveNumber: 42 },
  { name: "Isabel Samatha Chin",   nric: "000220-04-0152",   bambooEid: "7955", role: "PIS",   joinDate: "2026-03-02", itTicketId: "WIT-51893", waveNumber: 42 },
  { name: "Tan Ee Chiu",           nric: "TBC",              bambooEid: "7960", role: "PIS",   joinDate: "2026-03-02", itTicketId: "WIT-51894", waveNumber: 42 },

  // Mar 23, 2026 — Wave 43
  { name: "Joel Tan",              nric: "930604-10-6562",   bambooEid: "7986", role: "OTHERS",joinDate: "2026-03-23", itTicketId: "WIT-51894", waveNumber: 43, roleDescription: "Strategic Operations Lead" },
  { name: "Ann Heng",              nric: "980214-07-5128",   bambooEid: "7992", role: "COS",   joinDate: "2026-03-23", itTicketId: "WIT-52755", waveNumber: 43 },
  { name: "Nicolas Lee Wen Han",   nric: "981202-56-5685",   bambooEid: "8009", role: "OSM",   joinDate: "2026-03-23", itTicketId: "WIT-53109", waveNumber: 43 },

  // Apr 6, 2026 — Wave 44
  { name: "Wei Ler Kum",           nric: "040202-01-1143",   bambooEid: "8010", role: "COS",   joinDate: "2026-04-06", itTicketId: "WIT-53128", waveNumber: 44 },

  // May 4, 2026 — Wave 45
  { name: "Axlen Low",             nric: "961118-10-5709",   bambooEid: "32",   role: "COS",   joinDate: "2026-05-04", itTicketId: "WIT-54631", waveNumber: 45 },
  { name: "Keng Yew How",          nric: "990819106029",     bambooEid: "7996", role: "OTHERS",joinDate: "2026-05-04", itTicketId: "WIT-52929", waveNumber: 45, roleDescription: "Forward Deployed AI Strategist" },
  { name: "Wei Jie Chiew",         nric: "991108146213",     bambooEid: "8048", role: "AE",    joinDate: "2026-05-04", itTicketId: "WIT-54394", waveNumber: 45 },
  { name: "Kuhavati Rajanderan",   nric: "010125-14-0170",   bambooEid: "8027", role: "COS",   joinDate: "2026-05-04", itTicketId: "WIT-53729", waveNumber: 45 },
  { name: "Brandon Lee Kean Le",   nric: "990927-06-5455",   bambooEid: "8040", role: "PIS",   joinDate: "2026-05-04", itTicketId: "WIT-53725", waveNumber: 45 },

  // May 18, 2026 — Wave 46
  { name: "Kim Sam Chong",         nric: "030105-14-0331",   bambooEid: "8052", role: "BILLING_COLLECTION", joinDate: "2026-05-18", itTicketId: "WIT-55277", waveNumber: 46 },

  // Jun 1, 2026 — Wave 47
  { name: "Ee Hui Choy",           nric: "990810-14-6665",   bambooEid: "8044", role: "COS",   joinDate: "2026-06-01", itTicketId: "WIT-55790", waveNumber: 47 },
  { name: "Hao Zhe Fang",          nric: "021019-14-1093",   bambooEid: "8050", role: "COS",   joinDate: "2026-06-01", itTicketId: "WIT-55790", waveNumber: 47 },
  { name: "Liang Huey Jean",       nric: "920221-10-5036",   bambooEid: "8054", role: "OSM",   joinDate: "2026-06-01", itTicketId: "WIT-55789", waveNumber: 47 },
  { name: "Ching Juin Lee",        nric: "001116-19-0914",   bambooEid: "8016", role: "COS",   joinDate: "2026-06-01", itTicketId: "WIT-53730", waveNumber: 47 },
  { name: "Isabel Lim Min En",     nric: "030204-10-1696",   bambooEid: "8038", role: "PIS",   joinDate: "2026-06-01", itTicketId: "WIT-53577", waveNumber: 47 },

  // Jul 6, 2026 — Wave 48
  { name: "Brendan Chua",          nric: "991026-14-5831",   bambooEid: "8051", role: "COS",   joinDate: "2026-07-06", itTicketId: "WIT-56722", waveNumber: 48 },
  { name: "Koo Jia Wei",           nric: "030827-07-0742",   bambooEid: "8107", role: "COS",   joinDate: "2026-07-06", itTicketId: "WIT-56722", waveNumber: 48 },
];

async function main() {
  // Find an admin/HR user to use as createdById
  const creator = await prisma.user.findFirst({
    where: { OR: [{ isAdmin: true }, { team: "HR_HIRING" }] },
    select: { id: true, name: true },
  });
  if (!creator) throw new Error("No admin or HR_HIRING user found.");
  console.log(`Using creator: ${creator.name} (${creator.id})`);

  let created = 0;
  for (const h of HIRES) {
    const joinDate = d(h.joinDate);
    const schedule = calcSchedule(joinDate, h.role);
    const tasks = [
      { team: "IT",           title: "Create OKTA account" },
      { team: "RTA",          title: "Create POS ID (Greendot)" },
      { team: "HR_ONBOARDING",title: "Day 1 Orientation" },
      { team: "GD_TRAINING",  title: "GD Training setup & assignment" },
      { team: "COS_TRAINING", title: "COS Training setup & assignment" },
      ...(MENU_ROLES.includes(h.role) ? [{ team: "MENU_TRAINING", title: "Menu Training setup & assignment" }] : []),
    ];

    await prisma.newHire.create({
      data: {
        name:            h.name,
        nric:            h.nric,
        bambooEid:       h.bambooEid,
        role:            h.role,
        roleDescription: h.roleDescription ?? null,
        joinDate,
        itTicketId:      h.itTicketId ?? null,
        waveNumber:      h.waveNumber,
        createdById:     creator.id,
        trainingPhases: { create: schedule.map((s) => ({ type: s.type, startDate: s.startDate, endDate: s.endDate })) },
        tasks:          { create: tasks },
      },
    });

    console.log(`✓ ${h.name} — Wave ${h.waveNumber} (${h.joinDate})`);
    created++;
  }

  console.log(`\nDone. Created ${created} hires.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
