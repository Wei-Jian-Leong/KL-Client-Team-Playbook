"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { deleteDraftFile } from "@/lib/call-sim-drafts";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (!user?.isAdmin) throw new Error("Admin only");
}

export async function discardDraft(filename: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const deleted = deleteDraftFile(filename);
    if (!deleted) return { success: false, error: "File not found" };
    revalidatePath("/admin/call-sim-drafts");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
