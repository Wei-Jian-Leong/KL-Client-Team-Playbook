import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getAllDrafts } from "@/lib/call-sim-drafts";
import BackButton from "@/components/BackButton";
import CallSimDraftsPanel from "@/components/CallSimDraftsPanel";

export default async function CallSimDraftsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (!user?.isAdmin) redirect("/dashboard");

  const drafts = getAllDrafts();

  return (
    <div className="max-w-5xl mx-auto">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Call Sim Drafts</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
          Review generated simulation materials before publishing to the knowledge base
        </p>
      </div>
      <CallSimDraftsPanel drafts={drafts} />
    </div>
  );
}
