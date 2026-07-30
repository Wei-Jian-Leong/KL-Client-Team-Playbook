/**
 * One-time script: sets default password Tarro1234 for all existing users
 * who have an empty or missing password, and marks mustChangePassword = true.
 * Run with: npx tsx scripts/seed-passwords.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { password: "" },
    select: { id: true, name: true, email: true },
  });

  if (users.length === 0) {
    console.log("No users with empty passwords found. All good!");
    return;
  }

  const hashed = await bcrypt.hash("Tarro1234", 12);
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, mustChangePassword: true },
    });
    console.log(`✓ Set password for ${user.name} (${user.email})`);
  }

  console.log(`\nDone. ${users.length} user(s) updated.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
