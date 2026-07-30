"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { generateAnnouncementQuizDraft } from "@/lib/generate-announcement-quiz";
import { createNotificationsForTeams } from "@/app/actions/notifications";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (!user?.isAdmin) throw new Error("Admin only");
  return session;
}

export async function createAnnouncement(data: { title: string; content: string }) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Error" };
  }

  const announcement = await prisma.announcement.create({
    data: { title: data.title, content: data.content, createdById: session.id },
  });

  // Fire-and-forget: generate quiz and send notifications
  generateAnnouncementQuizDraft(announcement.id, data.title, data.content).catch(() => {});

  createNotificationsForTeams(
    ["COS_TRAINING"],
    `New Update: ${data.title}`,
    data.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120),
    "/announcements"
  ).catch(() => {});

  revalidatePath("/announcements");
  return { success: true, id: announcement.id };
}

export async function getAnnouncements(isAdmin: boolean) {
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      quizzes: isAdmin ? true : { where: { isDraft: false }, orderBy: { order: "asc" } },
    },
  });
  return announcements;
}

export async function approveAnnouncementQuizQuestion(questionId: string) {
  try { await requireAdmin(); } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Error" }; }
  await prisma.announcementQuiz.update({ where: { id: questionId }, data: { isDraft: false } });
  revalidatePath("/announcements");
  return { success: true };
}

export async function deleteAnnouncementQuizQuestion(questionId: string) {
  try { await requireAdmin(); } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Error" }; }
  await prisma.announcementQuiz.delete({ where: { id: questionId } });
  revalidatePath("/announcements");
  return { success: true };
}

export async function updateAnnouncementQuizQuestion(
  questionId: string,
  data: { question?: string; type?: string; options?: string | null; correctAnswer?: string | null }
) {
  try { await requireAdmin(); } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Error" }; }
  await prisma.announcementQuiz.update({ where: { id: questionId }, data });
  revalidatePath("/announcements");
  return { success: true };
}

export async function deleteAnnouncement(id: string) {
  try { await requireAdmin(); } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Error" }; }
  await prisma.announcement.delete({ where: { id } });
  revalidatePath("/announcements");
  return { success: true };
}
