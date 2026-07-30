import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const users = [
  { name: "Wei Jian Leong", email: "wei.leong@wondersco.com", team: "COS_TRAINING", isAdmin: true },
  { name: "Cassandra Yap", email: "cassandra.yap@wondersco.com", team: "HR_HIRING", isAdmin: false },
  { name: "Callie Foo", email: "callie.foo@wondersco.com", team: "HR_ONBOARDING", isAdmin: false },
  { name: "Jivanish Sures", email: "jivanish.sures@wondersco.com", team: "IT", isAdmin: false },
  { name: "Kyll Del Rosario", email: "kyll.delrosario@wondersco.com", team: "RTA", isAdmin: false },
  { name: "Jalyn Rose Bael", email: "jalyn.bael@wondersco.com", team: "RTA", isAdmin: false },
];

// First Mondays for upcoming months (join date slots)
const joinDateSlots = [
  { date: new Date(Date.UTC(2026, 6, 6, 12, 0, 0)), label: "July 2026 Batch" },
  { date: new Date(Date.UTC(2026, 7, 3, 12, 0, 0)), label: "August 2026 Batch" },
  { date: new Date(Date.UTC(2026, 8, 7, 12, 0, 0)), label: "September 2026 Batch" },
  { date: new Date(Date.UTC(2026, 9, 5, 12, 0, 0)), label: "October 2026 Batch" },
  { date: new Date(Date.UTC(2026, 10, 2, 12, 0, 0)), label: "November 2026 Batch" },
  { date: new Date(Date.UTC(2026, 11, 7, 12, 0, 0)), label: "December 2026 Batch" },
];

async function main() {
  console.log("Seeding users...");
  for (const u of users) {
    const hashed = await bcrypt.hash("Welcome123!", 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { isAdmin: u.isAdmin },
      create: {
        name: u.name,
        email: u.email,
        password: hashed,
        team: u.team as any,
        isAdmin: u.isAdmin,
      },
    });
    console.log(`  ✓ ${u.name} (${u.team})${u.isAdmin ? " [ADMIN]" : ""}`);
  }

  console.log("Seeding join date slots...");
  for (const slot of joinDateSlots) {
    await prisma.joinDateSlot.upsert({
      where: { date: slot.date },
      update: {},
      create: slot,
    });
    console.log(`  ✓ ${slot.label}`);
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
