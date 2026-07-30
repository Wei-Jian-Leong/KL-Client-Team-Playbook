import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getRoleAccessMap } from "@/lib/role-access";
import AnnouncementsView from "@/components/AnnouncementsView";

export default async function AnnouncementsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const jar = await cookies();
  const previewAs = jar.get("preview_as")?.value ?? null;

  const dbUser = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  const isAdmin = !!dbUser?.isAdmin;
  const effectiveIsAdmin = isAdmin && !previewAs;

  const roleAccess = await getRoleAccessMap(previewAs ? "USER" : (session.position ?? "USER"));
  if (!effectiveIsAdmin && !roleAccess["announcements"]) redirect("/knowledge");

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      quizzes: isAdmin
        ? { orderBy: { order: "asc" } }
        : { where: { isDraft: false }, orderBy: { order: "asc" } },
    },
  });

  return (
    <div className="max-w-3xl mx-auto">
      <AnnouncementsView announcements={announcements} isAdmin={isAdmin} />
    </div>
  );
}
