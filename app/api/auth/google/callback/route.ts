import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSessionToken, SESSION_COOKIE_OPTS } from "@/lib/session";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=oauth_cancelled", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/login?error=oauth_token", req.url));
  }

  const { access_token } = await tokenRes.json() as { access_token: string };

  // Get user info
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(new URL("/login?error=oauth_profile", req.url));
  }

  const profile = await profileRes.json() as { email: string; name: string; sub: string };

  // Restrict to @wondersco.com
  if (!profile.email?.endsWith("@wondersco.com")) {
    return NextResponse.redirect(new URL("/login?error=domain_restricted", req.url));
  }

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email: profile.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: profile.name ?? profile.email.split("@")[0],
        email: profile.email,
        password: "",
        team: "COS_TRAINING",
        position: "USER",
        mustChangePassword: false,
      },
    });
  }

  const newHireProfile = await prisma.newHire.findUnique({ where: { userId: user.id }, select: { id: true } });

  const token = await generateSessionToken({
    id: user.id,
    name: user.name,
    email: user.email,
    team: user.team,
    position: user.position ?? undefined,
    isNewHire: !!newHireProfile,
  });

  const dest = newHireProfile ? "/training-materials" : "/dashboard";
  const response = NextResponse.redirect(new URL(dest, req.url));
  response.cookies.set("session", token, SESSION_COOKIE_OPTS);
  return response;
}
