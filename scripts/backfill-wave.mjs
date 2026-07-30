import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const WAVE_BASE = 48;

async function main() {
  const hires = await prisma.newHire.findMany({
    select: { id: true, name: true, joinDate: true, waveNumber: true },
    where: { deletedAt: null },
    orderBy: { joinDate: "asc" },
  });

  // Build ordered list of distinct join dates
  const seenDates = new Map(); // isoDate -> waveNumber
  let nextWave = WAVE_BASE;

  for (const hire of hires) {
    const key = hire.joinDate.toISOString();
    if (!seenDates.has(key)) {
      seenDates.set(key, nextWave++);
    }
  }

  // Update hires that don't have a wave number yet
  for (const hire of hires) {
    if (hire.waveNumber == null) {
      const wave = seenDates.get(hire.joinDate.toISOString());
      await prisma.newHire.update({ where: { id: hire.id }, data: { waveNumber: wave } });
      console.log(`${hire.name} (${hire.joinDate.toDateString()}) → Wave ${wave}`);
    } else {
      console.log(`${hire.name} already has Wave ${hire.waveNumber}, skipped`);
    }
  }

  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
