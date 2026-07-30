import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import AppHeader from "@/components/AppHeader";
import { getRoleAccessMap } from "@/lib/role-access";

export default async function AnnouncementsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const jar = await cookies();
  const previewAsId = jar.get("preview_as")?.value ?? null;

  const [notifications, unread, dbUser, roleAccess, newHires] = await Promise.all([
    prisma.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: session.id, read: false } }),
    prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true, position: true } }),
    getRoleAccessMap(session.position ?? ""),
    prisma.newHire.findMany({ where: { status: { not: "DELETED" }, userId: { not: null } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
  ]);

  if (!dbUser?.isAdmin && !roleAccess["announcements"]) redirect("/knowledge");

  const previewNewHire = previewAsId
    ? await prisma.newHire.findUnique({ where: { id: previewAsId }, select: { userId: true } })
    : null;
  const previewUser = previewNewHire?.userId
    ? await prisma.user.findUnique({ where: { id: previewNewHire.userId }, select: { team: true, position: true } })
    : null;
  const effectiveIsAdmin = !!dbUser?.isAdmin && !previewAsId;
  const effectiveSession = previewUser
    ? { ...session, team: previewUser.team, position: previewUser.position ?? undefined }
    : session;
  const effectiveRoleAccess = previewUser
    ? await getRoleAccessMap(previewUser.position ?? "USER")
    : roleAccess;

  const previewingAs = previewAsId ? (newHires.find(nh => nh.id === previewAsId) ?? null) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader session={effectiveSession} isAdmin={effectiveIsAdmin} notifications={notifications} unread={unread} activePage="announcements" roleAccess={effectiveRoleAccess} newHires={newHires} previewingAs={previewingAs} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
