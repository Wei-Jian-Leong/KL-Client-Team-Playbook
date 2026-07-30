import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function parseArticleDate(s: string): Date | null {
  const parts = s.split("/").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [m, d, y] = parts;
  return new Date(Date.UTC(y, m - 1, d));
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const articleId = req.nextUrl.searchParams.get("articleId");
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 });

  const article = await prisma.knowledgeArticle.findUnique({
    where: { id: articleId },
    select: { title: true, date: true },
  });
  if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

  const pubDate = parseArticleDate(article.date);
  const expiryDate = pubDate ? new Date(pubDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null;

  // All users across all roles
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, position: true, isAdmin: true },
    orderBy: { name: "asc" },
  });

  // Attempts for this article
  const attempts = await prisma.knowledgeQuizAttempt.findMany({
    where: { articleId },
    select: { userId: true, score: true, total: true, completedAt: true },
  });

  const attemptMap = new Map(attempts.map(a => [a.userId, a]));

  const ROLE_LABELS: Record<string, string> = { USER: "User", SUPPORT: "Support", ADMIN: "Admin" };

  const rows: string[] = [
    ["Name", "Email", "Role", "Quiz Status", "Completed At"].map(escapeCsv).join(","),
  ];

  for (const u of allUsers) {
    const attempt = attemptMap.get(u.id);
    const roleLabel = u.isAdmin ? "Admin" : (ROLE_LABELS[u.position ?? ""] ?? (u.position ?? "—"));

    let status: string;
    let completedAt = "—";

    if (!attempt) {
      status = "Not attempted";
    } else if (pubDate && expiryDate) {
      const completedDate = new Date(attempt.completedAt);
      completedAt = completedDate.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
      const completedInWindow = completedDate >= pubDate && completedDate <= expiryDate;
      status = completedInWindow ? "Completed" : "Expired";
    } else {
      status = "Completed (no expiry window)";
      completedAt = new Date(attempt.completedAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
    }

    rows.push([u.name, u.email, roleLabel, status, completedAt].map(escapeCsv).join(","));
  }

  const safeTitle = article.title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40);
  const filename = `quiz-report-${safeTitle}.csv`;

  return new NextResponse(rows.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
