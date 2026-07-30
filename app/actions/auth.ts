"use server";

import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function setPreviewUser(newHireId: string | null) {
  const jar = await cookies();
  if (newHireId) {
    jar.set("preview_as", newHireId, { path: "/", httpOnly: true, sameSite: "lax" });
  } else {
    jar.delete("preview_as");
  }
}

export async function login(prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "No account found for this email" };
  }

  if (user.password) {
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return { error: "Incorrect password" };
    }
  }

  const newHireProfile = await prisma.newHire.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  const isNewHire = !!newHireProfile;

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    team: user.team,
    position: user.position ?? undefined,
    isNewHire,
  });

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  if (isNewHire) {
    redirect("/training-materials");
  }

  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function changePassword(prevState: unknown, formData: FormData) {
  const { getSession } = await import("@/lib/session");
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  const user = await prisma.user.update({
    where: { id: session.id },
    data: { password: hashed, mustChangePassword: false },
  });

  const nhProfile = await prisma.newHire.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (nhProfile) {
    redirect("/training-materials");
  }
  redirect("/dashboard");
}
