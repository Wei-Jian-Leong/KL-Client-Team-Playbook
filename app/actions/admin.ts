"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { parseLocalDate, firstMondayOfMonth } from "@/lib/dates";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "Tarro1234";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user?.isAdmin) throw new Error("Admin access required");
  return session;
}

export async function renameTask(formData: FormData) {
  await requireAdmin();
  const taskId = formData.get("taskId") as string;
  const title = formData.get("title") as string;
  const newHireId = formData.get("newHireId") as string;
  if (!title?.trim()) return { error: "Title cannot be empty" };
  await prisma.task.update({ where: { id: taskId }, data: { title: title.trim() } });
  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}

export async function addJoinDateSlot(formData: FormData) {
  await requireAdmin();
  const dateStr = formData.get("date") as string; // "YYYY-MM-DD"
  const label = formData.get("label") as string;
  if (!dateStr) return { error: "Date is required" };
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dow = date.getUTCDay();
  if (dow === 0 || dow === 6) return { error: "Join date must be a weekday" };
  await prisma.joinDateSlot.upsert({
    where: { date },
    update: { label: label || null, isAvailable: true },
    create: { date, label: label || null },
  });
  revalidatePath("/admin");
  revalidatePath("/new-hire/new");
  revalidatePath("/schedule");
  return { success: true };
}

export async function removeJoinDateSlot(id: string) {
  await requireAdmin();
  await prisma.joinDateSlot.update({ where: { id }, data: { isAvailable: false } });
  revalidatePath("/admin");
  revalidatePath("/new-hire/new");
  revalidatePath("/schedule");
}

export async function approveJoinDateRequest(id: string) {
  await requireAdmin();
  const req = await prisma.joinDateRequest.findUnique({ where: { id } });
  if (!req) return { error: "Request not found" };
  // Add as a slot
  await prisma.joinDateSlot.upsert({
    where: { date: req.requestedDate },
    update: { isAvailable: true },
    create: { date: req.requestedDate, label: "Requested batch" },
  });
  await prisma.joinDateRequest.update({
    where: { id },
    data: { status: "APPROVED" },
  });
  revalidatePath("/admin");
  revalidatePath("/new-hire/new");
  return { success: true };
}

export async function rejectJoinDateRequest(id: string, note: string) {
  await requireAdmin();
  await prisma.joinDateRequest.update({
    where: { id },
    data: { status: "REJECTED", adminNote: note },
  });
  revalidatePath("/admin");
  return { success: true };
}

export async function updateUserAccess(formData: FormData) {
  await requireAdmin();
  const userId = formData.get("userId") as string;
  const isAdmin = formData.get("isAdmin") === "true";
  const team = formData.get("team") as string;
  const position = formData.get("position") as string | null;
  if (!userId || !team) return { error: "Missing fields" };
  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin, team, position: position || null },
  });
  revalidatePath("/admin");
  return { success: true };
}

export async function createUser(formData: FormData) {
  await requireAdmin();
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const team = formData.get("team") as string;
  const isAdmin = formData.get("isAdmin") === "true";

  if (!name || !email || !team) return { error: "Name, email and team are required" };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with this email already exists" };

  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  await prisma.user.create({
    data: { name, email, password: hashed, team, isAdmin, mustChangePassword: true },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function resetUserPassword(userId: string) {
  await requireAdmin();
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, mustChangePassword: true },
  });
  revalidatePath("/admin");
  return { success: true };
}

// ── Mentor management ──────────────────────────────────────────────────────────

export async function createMentor(formData: FormData) {
  await requireAdmin();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required" };
  const existing = await prisma.mentor.findFirst({ where: { name } });
  if (existing) return { error: "A mentor with this name already exists" };
  await prisma.mentor.create({ data: { name } });
  revalidatePath("/admin");
  return { success: true };
}

export async function toggleMentorActive(id: string) {
  await requireAdmin();
  const mentor = await prisma.mentor.findUnique({ where: { id } });
  if (!mentor) return { error: "Not found" };
  await prisma.mentor.update({ where: { id }, data: { isActive: !mentor.isActive } });
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteMentor(id: string) {
  await requireAdmin();
  await prisma.mentor.delete({ where: { id } });
  revalidatePath("/admin");
  return { success: true };
}

export async function getRoleAccessConfig() {
  const rows = await prisma.roleAccess.findMany();
  const config: Record<string, Record<string, boolean>> = {};
  for (const r of rows) {
    if (!config[r.role]) config[r.role] = {};
    config[r.role][r.page] = r.enabled;
  }
  return config;
}

export async function updateRoleAccess(role: string, page: string, enabled: boolean) {
  await requireAdmin();
  await prisma.roleAccess.upsert({
    where: { role_page: { role, page } },
    update: { enabled },
    create: { role, page, enabled },
  });
  revalidatePath("/");
  return { success: true };
}

export async function migrateNewHireTeams() {
  await requireAdmin();
  const hires = await prisma.newHire.findMany({
    where: { userId: { not: null } },
    select: { userId: true, role: true, roleDescription: true },
  });
  let updated = 0;
  for (const h of hires) {
    const team = h.role === "OTHERS" ? (h.roleDescription?.trim() || "OTHERS") : h.role;
    await prisma.user.update({ where: { id: h.userId! }, data: { team } });
    updated++;
  }
  return { success: true, updated };
}

