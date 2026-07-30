import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import KnowledgeArticleFullScreen from "@/components/KnowledgeArticleFullScreen";

export default async function KnowledgeArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const [article, dbUser, userAttempts, userReadRaw] = await Promise.all([
    prisma.knowledgeArticle.findUnique({
      where: { id },
      include: { quizQuestions: { orderBy: { order: "asc" } }, faqs: { orderBy: { order: "asc" } }, talkTracks: { orderBy: { order: "asc" } } },
    }),
    prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } }),
    prisma.knowledgeQuizAttempt.findMany({
      where: { userId: session.id },
      select: { articleId: true, score: true, total: true, completedAt: true },
    }),
    prisma.articleRead.findMany({
      where: { userId: session.id },
      select: { articleId: true },
    }),
  ]);

  const isAdmin = !!dbUser?.isAdmin;

  if (!article || (article.isDraft && !isAdmin)) notFound();

  const userReads = userReadRaw.map(r => r.articleId);

  return (
    <KnowledgeArticleFullScreen
      article={article}
      isAdmin={isAdmin}
      userAttempts={userAttempts}
      userReads={userReads}
    />
  );
}
