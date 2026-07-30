import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getRoleAccessMap } from "@/lib/role-access";
import { getModulesWithTopics, getAcknowledgmentStats } from "@/app/actions/training-materials";
import TrainingMaterialsView from "@/components/TrainingMaterialsView";

export default async function TrainingMaterialsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const jar = await cookies();
  const previewAs = jar.get("preview_as")?.value ?? null;

  const [dbUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } }),
  ]);

  const isAdmin = !!dbUser?.isAdmin;
  const effectiveIsAdmin = isAdmin && !previewAs;
  let isNewHire = !!session.isNewHire || session.team === "NEW_HIRE";

  const roleAccess = await getRoleAccessMap(previewAs ? "USER" : (session.position ?? "USER"));
  if (!effectiveIsAdmin && !isNewHire && !roleAccess["training"]) redirect("/knowledge");
  let newHireId: string | undefined;
  let previewingAs: { id: string; name: string } | undefined;

  if (isNewHire) {
    const newHire = await prisma.newHire.findUnique({
      where: { userId: session.id },
      select: { id: true },
    });
    newHireId = newHire?.id;
  }

  // Admin preview mode
  if (isAdmin && previewAs) {
    const targetHire = await prisma.newHire.findUnique({
      where: { id: previewAs },
      select: { id: true, name: true },
    });
    if (targetHire) {
      newHireId = targetHire.id;
      isNewHire = true;
      previewingAs = { id: targetHire.id, name: targetHire.name };
    }
  }

  const [modules, ackStats] = await Promise.all([
    getModulesWithTopics(newHireId),
    isAdmin ? getAcknowledgmentStats() : Promise.resolve([]),
  ]);

  return (
    <TrainingMaterialsView
      modules={modules}
      isAdmin={isAdmin && !previewingAs}
      isNewHire={isNewHire}
      newHireId={newHireId}
      ackStats={ackStats}
      previewingAs={previewingAs}
    />
  );
}
