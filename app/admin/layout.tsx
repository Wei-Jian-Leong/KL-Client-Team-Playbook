import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [notifications, unread, dbUser, newHires] = await Promise.all([
    prisma.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: session.id, read: false } }),
    prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } }),
    prisma.newHire.findMany({ where: { status: { not: "DELETED" }, userId: { not: null } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
  ]);

  if (!dbUser?.isAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader session={session} isAdmin={true} notifications={notifications} unread={unread} activePage="admin" newHires={newHires} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
