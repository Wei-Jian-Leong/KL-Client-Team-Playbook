"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function upsertPerformance(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const newHireId = formData.get("newHireId") as string;
  const period = parseInt(formData.get("period") as string);
  const periodLabel = formData.get("periodLabel") as string;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const aht = formData.get("aht") ? parseFloat(formData.get("aht") as string) : null;
  const str = formData.get("str") ? parseFloat(formData.get("str") as string) : null;
  const mistakeRate = formData.get("mistakeRate") ? parseFloat(formData.get("mistakeRate") as string) : null;
  const adherence = formData.get("adherence") ? parseFloat(formData.get("adherence") as string) : null;
  const fcr = formData.get("fcr") ? parseFloat(formData.get("fcr") as string) : null;
  const notes = formData.get("notes") as string;

  const existing = await prisma.performance.findFirst({
    where: { newHireId, period },
  });

  if (existing) {
    await prisma.performance.update({
      where: { id: existing.id },
      data: { aht, str, mistakeRate, adherence, fcr, notes: notes || null, updatedById: session.id },
    });
  } else {
    await prisma.performance.create({
      data: {
        newHireId, period, periodLabel, startDate, endDate,
        aht, str, mistakeRate, adherence, fcr,
        notes: notes || null,
        updatedById: session.id,
      },
    });
  }

  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}
