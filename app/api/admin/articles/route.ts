import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const articles = await prisma.knowledgeArticle.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      articleNo: true,
      title: true,
      category: true,
      content: true,
      isDraft: true,
      date: true,
    },
    orderBy: { articleNo: "asc" },
  });

  return NextResponse.json({ articles });
}
