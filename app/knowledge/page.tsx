import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getRoleAccessMap } from "@/lib/role-access";
import KnowledgeBase from "@/components/KnowledgeBase";

export default async function KnowledgePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const jar = await cookies();
  const previewAs = jar.get("preview_as")?.value ?? null;

  const userId = previewAs ?? session.id;

  const [articles, dbUser, userAttempts, userReadRaw] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      orderBy: [{ articleNo: "desc" }],
      include: { quizQuestions: { orderBy: { order: "asc" } }, faqs: { orderBy: { order: "asc" } }, talkTracks: { orderBy: { order: "asc" } } },
    }),
    prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } }),
    prisma.knowledgeQuizAttempt.findMany({
      where: { userId },
      select: { articleId: true, score: true, total: true, completedAt: true },
    }),
    prisma.articleRead.findMany({
      where: { userId },
      select: { articleId: true },
    }),
  ]);
  const userReads = userReadRaw.map(r => r.articleId);

  const isAdmin = !!dbUser?.isAdmin;
  // When previewing as a user, hide admin controls
  const effectiveIsAdmin = isAdmin && !previewAs;

  const roleAccess = await getRoleAccessMap(previewAs ? "USER" : (session.position ?? "USER"));
  if (!effectiveIsAdmin && !roleAccess["knowledge"]) redirect("/");
  // Non-admins only see published articles
  const visibleArticles = effectiveIsAdmin ? articles : articles.filter(a => !a.isDraft);
  const publishedCount = articles.filter(a => !a.isArchived && !a.isDraft).length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Base</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Process updates and guidelines — {publishedCount} active articles
        </p>
      </div>
      <KnowledgeBase articles={visibleArticles} isAdmin={effectiveIsAdmin} userAttempts={userAttempts} userReads={userReads} />
    </div>
  );
}
