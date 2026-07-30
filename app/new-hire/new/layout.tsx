import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";

export default async function NewHireLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [notifications, unread, dbUser] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: session.id, read: false } }),
    prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } }),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        session={session}
        isAdmin={!!dbUser?.isAdmin}
        notifications={notifications}
        unread={unread}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
