import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatDate, getRoleLabel } from "@/lib/training";
import { getDisplayStatus, STATUS_STYLES } from "@/lib/hireStatus";
import { notFound, redirect } from "next/navigation";
import { getJiraComments } from "@/lib/jira";
import TaskCard from "@/components/TaskCard";
import TrainingPhaseCard from "@/components/TrainingPhaseCard";
import CommentSection from "@/components/CommentSection";
import DeleteHireModal from "@/components/DeleteHireModal";
import EditHireDetails from "@/components/EditHireDetails";
import BackButton from "@/components/BackButton";
import NewHireDetailsButton from "@/components/NewHireDetailsButton";
import HireHistoryPanel from "@/components/HireHistoryPanel";
import JiraCommentPanel from "@/components/JiraCommentPanel";

function DetailChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-3 py-1.5 rounded-lg">
      <span>{icon}</span>
      <span className="text-gray-400 dark:text-gray-500">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function NewHireDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const [hire, user, joinDateSlots] = await Promise.all([
    prisma.newHire.findUnique({
      where: { id },
      include: {
        trainingPhases: {
          orderBy: { startDate: "asc" },
          include: {
            gdTrainer: true,
            cosTrainer: true,
            menuTrainer: true,
            certAudits: { orderBy: { createdAt: "asc" } },
            certAttempts: {
              orderBy: { attemptNumber: "asc" },
              include: { certAudits: { orderBy: { createdAt: "asc" } } },
            },
          },
        },
        tasks: {
          orderBy: { createdAt: "asc" },
          include: {
            completedBy: true,
            comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
            history: { orderBy: { createdAt: "asc" } },
          },
        },
        comments: {
          include: { author: true },
          orderBy: { createdAt: "asc" },
          where: { taskId: null },
        },
        hireHistory: { orderBy: { createdAt: "desc" }, take: 100 },
        createdBy: true,
        performances: true,
      },
    }),
    prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } }),
    prisma.joinDateSlot.findMany({
      where: { isAvailable: true },
      orderBy: { date: "asc" },
    }),
  ]);

  if (!hire) notFound();

  const [allUsers, mentors] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.mentor.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  // Fetch wave batch for GD Briefing
  const waveBatch = hire.waveNumber != null
    ? await prisma.newHire.findMany({
        where: { waveNumber: hire.waveNumber, deletedAt: null, status: { not: "DELETED" } },
        select: { name: true, bambooEid: true, posId: true },
        orderBy: { name: "asc" },
      })
    : [];

  const jiraComments = hire.jiraTicketId ? await getJiraComments(hire.jiraTicketId) : [];

  const isHR = session.team === "HR";
  const isCosTraining = session.team === "COS_TRAINING";
  const canDelete = isHR || !!user?.isAdmin;
  const canEditDetails = isHR || !!user?.isAdmin;
  const canEditPosId = session.team === "RTA" || !!user?.isAdmin;
  const visibleTasks = hire.tasks;

  const ds = getDisplayStatus(hire);
  const style = STATUS_STYLES[ds];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <BackButton />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{hire.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.badge}`}>
                {style.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <DetailChip icon="💼" label="Role" value={getRoleLabel(hire.role) + (hire.roleDescription ? ` — ${hire.roleDescription}` : "")} />
              <DetailChip icon="📅" label="Join Date" value={formatDate(hire.joinDate)} />
              {hire.waveNumber != null && <DetailChip icon="🌊" label="Wave" value={`Wave ${hire.waveNumber}`} />}
              <DetailChip icon="🪪" label="EID" value={hire.bambooEid} />
              {hire.email && <DetailChip icon="📧" label="Email" value={hire.email} />}
              {hire.itTicketId && <DetailChip icon="🎫" label="IT Ticket" value={hire.itTicketId} />}
              {hire.teamLeadName && <DetailChip icon="👤" label="Team Lead" value={hire.teamLeadName} />}
              {hire.posId && <DetailChip icon="🟢" label="POS ID" value={hire.posId} />}
              {hire.jiraTicketUrl && (
                <a
                  href={hire.jiraTicketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-medium"
                >
                  <span>🔗</span> Jira: {hire.jiraTicketId}
                </a>
              )}
            </div>
            {hire.jiraTicketId && (
              <div className="mt-3">
                <JiraCommentPanel
                  newHireId={hire.id}
                  jiraTicketId={hire.jiraTicketId}
                  initialComments={jiraComments}
                  canComment={!!(isHR || user?.isAdmin)}
                />
              </div>
            )}
            {(ds === "RESIGNED" || ds === "DELETED") && hire.deleteReason && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                {hire.deleteReason}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hire.status !== "DELETED" && (
              <EditHireDetails
                newHireId={hire.id}
                hire={{
                  bambooEid: hire.bambooEid,
                  teamLeadName: hire.teamLeadName,
                  joinDate: hire.joinDate,
                  itTicketId: hire.itTicketId,
                  posId: hire.posId ?? null,
                  waveNumber: hire.waveNumber ?? null,
                }}
                joinDateSlots={joinDateSlots}
                canEditDetails={canEditDetails}
                canEditItTicket={session.team === "IT" || !!user?.isAdmin}
                canEditPosId={canEditPosId}
                isAdmin={!!user?.isAdmin}
              />
            )}
            {canDelete && hire.status !== "DELETED" && (
              <DeleteHireModal newHireId={hire.id} hireName={hire.name} />
            )}
          </div>
        </div>
      </div>

      {/* COS mentor not assigned warning */}
      {(isCosTraining || !!user?.isAdmin) && hire.trainingPhases.some(
        p => p.type === "COS" && p.status === "PENDING" && !p.cosMentorId
      ) && (
        <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl px-4 py-3 text-yellow-800 dark:text-yellow-300 text-sm">
          <span>⚠️</span>
          <span>
            COS training starts {formatDate(hire.trainingPhases.find(p => p.type === "COS")!.startDate)} — mentor not yet assigned.
          </span>
        </div>
      )}

      {/* A3: POS ID missing warning for COS Training */}
      {(isCosTraining || !!user?.isAdmin) && !hire.posId && hire.tasks.some(t => t.team === "RTA" && t.status !== "COMPLETED") && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-amber-800 dark:text-amber-300 text-sm">
          <span>⚠️</span>
          <span>POS ID not yet provided by RTA — follow up before GD briefing.</span>
        </div>
      )}

      {/* Copy New Hire Details buttons */}
      {(session.team === "GD_TRAINING" || isCosTraining || !!user?.isAdmin) && hire.waveNumber != null && waveBatch.length > 0 && (
        <NewHireDetailsButton
          waveNumber={hire.waveNumber}
          batch={waveBatch}
          currentHire={{ name: hire.name, bambooEid: hire.bambooEid, posId: hire.posId ?? null }}
        />
      )}

      {/* Certifications — auto-created on cert PASSED */}
      {hire.performances.filter(p => p.type === "CERT").length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Certifications</h2>
          <div className="space-y-2">
            {hire.performances.filter(p => p.type === "CERT").map(p => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="text-green-600 font-semibold">✓</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{p.periodLabel}</span>
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  {new Date(p.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main grid: Tasks left, Training + Comments right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Team Tasks */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Team Tasks</h2>
          {visibleTasks.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">No tasks assigned to your team.</p>
          ) : (
            visibleTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                newHireId={hire.id}
                session={session}
                isAdmin={user?.isAdmin}
              />
            ))
          )}
        </div>

        {/* Right: Training Schedule + Activity */}
        <div className="lg:col-span-1 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Training Schedule</h2>
            <div className="space-y-3">
              {hire.trainingPhases.map((phase) => (
                <TrainingPhaseCard
                  key={phase.id}
                  phase={phase}
                  newHireId={hire.id}
                  hireRole={hire.role}
                  session={session}
                  allUsers={allUsers}
                  mentors={mentors}
                  isAdmin={user?.isAdmin}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Activity & Comments</h2>
            {hire.hireHistory.length > 0 && (
              <HireHistoryPanel history={hire.hireHistory} />
            )}
            <CommentSection
              newHireId={hire.id}
              hireName={hire.name}
              comments={hire.comments}
              session={session}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
