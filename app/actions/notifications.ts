"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createNotificationsForTeams(
  teams: string[],
  title: string,
  content: string,
  link?: string
) {
  const regularTeams = teams.filter((t) => t !== "NEW_HIRE");
  const recipientIds = new Set<string>();

  if (regularTeams.length > 0) {
    const users = await prisma.user.findMany({
      where: { team: { in: regularTeams } },
      select: { id: true },
    });
    users.forEach((u) => recipientIds.add(u.id));
  }

  if (teams.includes("NEW_HIRE")) {
    const newHireUsers = await prisma.newHire.findMany({
      where: { userId: { not: null }, status: { not: "DELETED" } },
      select: { userId: true },
    });
    newHireUsers.forEach((nh) => nh.userId && recipientIds.add(nh.userId));
  }

  if (recipientIds.size === 0) return;
  await prisma.notification.createMany({
    data: [...recipientIds].map((id) => ({ userId: id, title, content, link: link || null })),
  });
}

export async function createNotificationForUser(
  userId: string,
  title: string,
  content: string,
  link?: string
) {
  await prisma.notification.create({
    data: { userId, title, content, link: link || null },
  });
}

export async function markNotificationRead(notificationId: string) {
  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
  revalidatePath("/");
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  revalidatePath("/");
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function getUserNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

// Parse @mentions from comment text, return mentioned user IDs
export async function parseMentions(text: string): Promise<string[]> {
  const mentionPattern = /@(\S+)/g;
  const matches = [...text.matchAll(mentionPattern)];
  if (matches.length === 0) return [];

  const names = matches.map((m) => m[1].replace(/_/g, " "));
  const users = await prisma.user.findMany({
    where: {
      OR: names.map((n) => ({
        name: { contains: n },
      })),
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
