import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminPanel from "@/components/AdminPanel";
import BackButton from "@/components/BackButton";
import { getFullRoleAccessConfig } from "@/lib/role-access";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [joinDateSlots, joinDateRequests, users, mentors, roleAccessConfig] = await Promise.all([
    prisma.joinDateSlot.findMany({ orderBy: { date: "asc" } }),
    prisma.joinDateRequest.findMany({
      where: { status: "PENDING" },
      include: { requestedBy: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.mentor.findMany({ orderBy: { name: "asc" } }),
    getFullRoleAccessConfig(),
  ]);

  return (
    <div className="max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage join dates, users, and requests</p>
      </div>
      <AdminPanel
        joinDateSlots={joinDateSlots}
        joinDateRequests={joinDateRequests}
        users={users}
        mentors={mentors}
        roleAccessConfig={roleAccessConfig}
      />
    </div>
  );
}
