"use server";

import { prisma } from "@/lib/prisma";
import { getTeamFromEmail, isAdminEmail } from "@/lib/emailRoles";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function register(prevState: unknown, formData: FormData) {
  const name = formData.get("name") as string;
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!name || !email || !password) return { error: "All fields are required" };
  if (password !== confirm) return { error: "Passwords do not match" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (!email.endsWith("@wondersco.com")) return { error: "Only @wondersco.com emails are allowed" };

  const team = getTeamFromEmail(email);
  if (!team) return { error: "Your email is not recognized. Contact admin to be added." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists" };

  const passwordHash = await bcrypt.hash(password, 12);
  const isAdmin = isAdminEmail(email);

  await prisma.user.create({
    data: { name, email, passwordHash, team, isAdmin },
  });

  redirect("/login?registered=1");
}
