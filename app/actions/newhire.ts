"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { calculateTrainingSchedule, HireRole } from "@/lib/training";
import { createOnboardingTicket } from "@/lib/jira";
import { createDay1GMeet, createMeetAndGreetSession, addAttendeeToEvent, createOneOnOneSession } from "@/lib/gcal";
import { parseLocalDate, toInputDate } from "@/lib/dates";
import {
  createNotificationsForTeams,
  createNotificationForUser,
  parseMentions,
} from "@/app/actions/notifications";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

const ALL_TEAMS = ["IT", "RTA", "HR", "GD_TRAINING", "COS_TRAINING", "MENU_TRAINING"];
const MENU_ROLES = ["PIS", "OSM", "AE"];

const ROLE_TITLES: Record<string, string> = {
  COS_I: "Client Operations Specialist I",
  COS_II: "Client Operations Specialist II",
  COM: "Client Operations Manager",
  COSTL: "Client Operations Team Lead",
  GD: "Growth Driver",
  RTA: "Real-Time Analyst",
  PIS: "Partner Integration Specialist",
  OSM: "Operations Support Manager",
  AE: "Account Executive",
};

async function postNewHireAnnouncement(hire: {
  name: string;
  bambooEid: string;
  role: string;
  roleDescription?: string | null;
  joinDate: Date;
  jiraTicketId: string | null;
  jiraTicketUrl: string | null;
}) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;

  const dateStr = hire.joinDate.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Kuala_Lumpur",
  });
  const roleTitle = ROLE_TITLES[hire.role] ?? hire.roleDescription ?? hire.role;
  const ticketLine = hire.jiraTicketId && hire.jiraTicketUrl
    ? `*IT Ticket ID:* <${hire.jiraTicketUrl}|${hire.jiraTicketId}>`
    : `*IT Ticket ID:* Pending`;

  const text = [
    `*${dateStr} (MYT) New Hire Alert <!subteam^S073XP455E0>*`,
    ``,
    `*${roleTitle}*`,
    ticketLine,
    `*Name*: ${hire.name}`,
    `*Bamboo EID*: ${hire.bambooEid}`,
  ].join("\n");

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: "C0A0XFL3074",
      text,
      mrkdwn: true,
    }),
  });
}

export async function createNewHire(prevState: unknown, formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const nric = formData.get("nric") as string;
  const bambooEid = formData.get("bambooEid") as string;
  const role = formData.get("role") as HireRole;
  const roleDescription = formData.get("roleDescription") as string;
  const joinDateStr = formData.get("joinDate") as string;
  const email = formData.get("email") as string;
  const itTicketId = formData.get("itTicketId") as string;
  const teamLeadName = formData.get("teamLeadName") as string;
  const TEAM_LEAD_EMAILS: Record<string, string> = {
    "Joel Tan": "joel.tan@wondersco.com",
    "Darren Wong": "darren.leong@wondersco.com",
    "Gaberial Ng": "gaberial.ng@wondersco.com",
    "Tallia Tang": "tallia.tang@wondersco.com",
    "Francine Destura": "francine.destura@wondersco.com",
  };
  const teamLeadEmail = TEAM_LEAD_EMAILS[teamLeadName] ?? null;
  const joinDateType = formData.get("joinDateType") as string;
  const requestReason = formData.get("requestReason") as string;

  if (!name || !nric || !bambooEid || !role || !joinDateStr) {
    return { error: "All required fields must be filled" };
  }

  // Handle join date request
  if (joinDateType === "request") {
    if (!requestReason) return { error: "Please provide a reason for the new join date request" };
    await prisma.joinDateRequest.create({
      data: {
        requestedDate: parseLocalDate(joinDateStr),
        reason: requestReason,
        requestedById: session.id,
      },
    });
    // Notify admins
    const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
    for (const admin of admins) {
      await createNotificationForUser(
        admin.id,
        "New Join Date Request",
        `${session.name} requested a new join date: ${parseLocalDate(joinDateStr).toLocaleDateString()}. Reason: ${requestReason}`,
        "/admin"
      );
    }
    return { success: true, requested: true };
  }

  const joinDate = parseLocalDate(joinDateStr);
  const schedule = calculateTrainingSchedule(joinDate, role);

  // Compute wave number: derive base from earliest existing batch so new batches get the right offset.
  const allHires = await prisma.newHire.findMany({
    select: { id: true, joinDate: true, waveNumber: true },
    where: { deletedAt: null },
    orderBy: { joinDate: "asc" },
  });
  // Derive wave base from the minimum wave number in existing hires (corresponds to the earliest batch).
  // Fallback to 48 if no hires exist yet.
  const existingWaves = allHires.map((h) => h.waveNumber).filter((w): w is number => w != null);
  const WAVE_BASE = existingWaves.length > 0 ? Math.min(...existingWaves) : 48;

  const isExistingDate = allHires.some(
    (h) => h.joinDate.toISOString() === joinDate.toISOString()
  );
  let waveNumber: number;
  if (isExistingDate) {
    // Reuse the wave number already assigned to this batch
    const existing = allHires.find(
      (h) => h.joinDate.toISOString() === joinDate.toISOString() && h.waveNumber != null
    );
    // Count distinct dates before as fallback (in case no wave assigned yet)
    const distinctBefore = new Set(
      allHires.filter((h) => h.joinDate < joinDate).map((h) => h.joinDate.toISOString())
    ).size;
    waveNumber = existing?.waveNumber ?? WAVE_BASE + distinctBefore;
  } else {
    // New batch date — count distinct dates strictly before it
    const distinctBefore = new Set(
      allHires.filter((h) => h.joinDate < joinDate).map((h) => h.joinDate.toISOString())
    ).size;
    waveNumber = WAVE_BASE + distinctBefore;
    // Bump wave numbers of all hires with join dates strictly after this new date
    const hiresAfter = allHires.filter((h) => h.joinDate > joinDate);
    if (hiresAfter.length > 0) {
      await prisma.$transaction(
        hiresAfter.map((h) =>
          prisma.newHire.update({
            where: { id: h.id },
            data: { waveNumber: (h.waveNumber ?? 0) + 1 },
          })
        )
      );
    }
  }

  const personalEmail = formData.get("personalEmail") as string;
  const managerEmail = formData.get("managerEmail") as string;
  const location = formData.get("location") as string;
  const site = formData.get("site") as string;
  const division = formData.get("division") as string;
  const department = formData.get("department") as string;
  const employeeTeam = formData.get("employeeTeam") as string;
  const employmentType = formData.get("employmentType") as string;
  const employeeType = formData.get("employeeType") as string;
  const laptopNeededRaw = formData.get("laptopNeeded") as string;
  const laptopNeededOther = formData.get("laptopNeededOther") as string;
  const laptopNeeded = laptopNeededRaw === "Other" ? (laptopNeededOther || "Other") : laptopNeededRaw;
  const equipmentDelivery = formData.get("equipmentDelivery") as string;
  const equipmentDeliveryAddress = formData.get("equipmentDeliveryAddress") as string;
  const personalPhone = formData.get("personalPhone") as string;

  // Create Jira ticket
  const jira = await createOnboardingTicket({
    name, nric, bambooEid, role, joinDate, itTicketId,
    email: email || undefined,
    personalEmail: personalEmail || undefined,
    managerEmail: managerEmail || undefined,
    location: location || undefined,
    site: site || undefined,
    division: division || undefined,
    department: department || undefined,
    employeeTeam: employeeTeam || undefined,
    employmentType: employmentType || undefined,
    employeeType: employeeType || undefined,
    laptopNeeded: laptopNeeded || undefined,
    equipmentDelivery: equipmentDelivery || undefined,
    equipmentDeliveryAddress: equipmentDeliveryAddress || undefined,
    personalPhone: personalPhone || undefined,
    roleDescription: roleDescription || undefined,
  });

  const newHire = await prisma.newHire.create({
    data: {
      name, nric, bambooEid, role,
      roleDescription: roleDescription || null,
      email: email || null,
      joinDate,
      waveNumber,
      itTicketId: jira?.ticketId || null,
      jiraTicketId: jira?.ticketId || null,
      jiraTicketUrl: jira?.ticketUrl || null,
      teamLeadName: teamLeadName || null,
      teamLeadEmail: teamLeadEmail,
      personalEmail: personalEmail || null,
      managerEmail: managerEmail || null,
      location: location || null,
      site: site || null,
      division: division || null,
      department: department || null,
      employeeTeam: employeeTeam || null,
      employmentType: employmentType || null,
      employeeType: employeeType || null,
      laptopNeeded: laptopNeeded || null,
      equipmentDelivery: equipmentDelivery || null,
      equipmentDeliveryAddress: equipmentDeliveryAddress || null,
      personalPhone: personalPhone || null,
      createdById: session.id,
      trainingPhases: {
        create: schedule.map((s) => ({
          type: s.type,
          startDate: s.startDate,
          endDate: s.endDate,
        })),
      },
      tasks: {
        create: [
          { team: "RTA", title: "Create POS ID (Greendot)" },
          { team: "RTA", title: "Create Nice Login" },
          ...(role === "COS" ? [{ team: "RTA", title: "Schedule Shell" }] : []),
          { team: "GD_TRAINING", title: "GD Training setup & assignment" },
          { team: "COS_TRAINING", title: "COS Training setup & assignment" },
          ...(MENU_ROLES.includes(role)
            ? [{ team: "MENU_TRAINING", title: "Menu Training setup & assignment" }]
            : []),
        ],
      },
    },
  });

  // Auto-create NEW_HIRE user account using personalEmail
  if (personalEmail) {
    const existingUser = await prisma.user.findUnique({ where: { email: personalEmail } });
    if (!existingUser) {
      const hashed = await bcrypt.hash("Tarro1234", 12);
      const displayTeam = role === "OTHERS"
        ? (roleDescription?.trim() || "OTHERS")
        : role;
      const newHireUser = await prisma.user.create({
        data: {
          name,
          email: personalEmail,
          password: hashed,
          team: displayTeam,
          isAdmin: false,
          mustChangePassword: true,
        },
      });
      await prisma.newHire.update({
        where: { id: newHire.id },
        data: { userId: newHireUser.id },
      });
    } else if (!existingUser.id) {
      // user exists but no link yet
      await prisma.newHire.update({
        where: { id: newHire.id },
        data: { userId: existingUser.id },
      });
    }
  }

  // Notify all relevant teams
  const teamsToNotify = ["IT", "RTA", "HR", "GD_TRAINING", "COS_TRAINING"];
  if (MENU_ROLES.includes(role)) teamsToNotify.push("MENU_TRAINING");
  await createNotificationsForTeams(
    teamsToNotify,
    `New Hire: ${name}`,
    `${name} (${role}) joins on ${joinDate.toLocaleDateString()}. Please complete your assigned task.`,
    `/new-hire/${newHire.id}`
  );

  // Day 1 Orientation Google Meet (4pm–5:30pm EST)
  createDay1GMeet({ hireName: name, hireEmail: email || null, joinDate, newHireId: newHire.id });

  // Meet & Greet on day 10 of training — grouped by wave+role, no duplicate invites
  if (waveNumber != null) {
    const waveRoleGroup = await prisma.newHire.findMany({
      where: { waveNumber, role, deletedAt: null, status: { not: "DELETED" } },
      select: { id: true, name: true, email: true, teamLeadEmail: true, meetGreetEventId: true },
    });
    const existingEvent = waveRoleGroup.find((h) => h.meetGreetEventId);
    if (existingEvent?.meetGreetEventId) {
      // Add new hire to the existing event
      const toAdd = [email, teamLeadEmail].filter(Boolean) as string[];
      addAttendeeToEvent({ eventId: existingEvent.meetGreetEventId, emails: toAdd });
      await prisma.newHire.update({
        where: { id: newHire.id },
        data: { meetGreetEventId: existingEvent.meetGreetEventId },
      });
    } else {
      // First hire in this wave+role group — create the event for everyone
      const gdStartDate = schedule[0].startDate;
      const eventId = await createMeetAndGreetSession({
        waveNumber,
        role,
        trainingStartDate: gdStartDate,
        hires: waveRoleGroup,
      });
      if (eventId) {
        await prisma.newHire.updateMany({
          where: { id: { in: waveRoleGroup.map((h) => h.id) } },
          data: { meetGreetEventId: eventId },
        });
      }
    }
  }

  postNewHireAnnouncement({
    name,
    bambooEid,
    role,
    roleDescription,
    joinDate,
    jiraTicketId: jira?.ticketId ?? null,
    jiraTicketUrl: jira?.ticketUrl ?? null,
  });

  revalidatePath("/dashboard");
  return { success: true, id: newHire.id };
}

export async function addComment(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const content = formData.get("content") as string;
  const newHireId = formData.get("newHireId") as string;
  const taskId = formData.get("taskId") as string | null;
  const hireName = formData.get("hireName") as string;

  if (!content) return { error: "Comment cannot be empty" };

  await prisma.comment.create({
    data: {
      content,
      authorId: session.id,
      newHireId: newHireId || null,
      taskId: taskId || null,
    },
  });

  // Notify COS Training team (Wei Jian) of all comments
  const cosUsers = await prisma.user.findMany({
    where: { team: "COS_TRAINING" },
    select: { id: true },
  });
  for (const u of cosUsers) {
    if (u.id !== session.id) {
      await createNotificationForUser(
        u.id,
        `New comment on ${hireName || "hire"}`,
        `${session.name}: "${content.slice(0, 80)}${content.length > 80 ? "..." : ""}"`,
        `/new-hire/${newHireId}`
      );
    }
  }

  // Notify @mentioned users
  const mentionedIds = await parseMentions(content);
  for (const uid of mentionedIds) {
    if (uid !== session.id) {
      await createNotificationForUser(
        uid,
        `You were mentioned by ${session.name}`,
        `"${content.slice(0, 100)}"`,
        `/new-hire/${newHireId}`
      );
    }
  }

  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}

export async function updateTaskStatus(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const taskId = formData.get("taskId") as string;
  const status = formData.get("status") as string;
  const newHireId = formData.get("newHireId") as string;
  const hireName = formData.get("hireName") as string;

  const existing = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
      completedById: status === "COMPLETED" ? session.id : null,
    },
  });

  await prisma.taskHistory.create({
    data: {
      taskId,
      userId: session.id,
      userName: session.name,
      fromStatus: existing?.status ?? null,
      toStatus: status,
    },
  });

  // Notify other team members of status change
  await createNotificationsForTeams(
    ["COS_TRAINING"],
    `Task updated: ${task.title}`,
    `${session.name} marked "${task.title}" as ${status} for ${hireName || "a new hire"}.`,
    `/new-hire/${newHireId}`
  );

  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}

export async function updateTrainingPhase(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const phaseId = formData.get("phaseId") as string;
  const newHireId = formData.get("newHireId") as string;
  const status = formData.get("status") as string;
  const notes = formData.get("notes") as string;
  const gdTrainerId = formData.get("gdTrainerId") as string;
  const gdMentorId = formData.get("gdMentorId") as string;
  const cosTrainerId = formData.get("cosTrainerId") as string;
  const cosMentorId = formData.get("cosMentorId") as string;
  const menuTrainerId = formData.get("menuTrainerId") as string;

  const existing = await prisma.trainingPhase.findUnique({
    where: { id: phaseId },
    include: {
      gdTrainer: { select: { name: true } },
      cosTrainer: { select: { name: true } },
      menuTrainer: { select: { name: true } },
    },
  });

  await prisma.trainingPhase.update({
    where: { id: phaseId },
    data: {
      status,
      notes: notes || null,
      gdTrainerId: gdTrainerId || null,
      gdMentorId: gdMentorId || null,
      cosTrainerId: cosTrainerId || null,
      cosMentorId: cosMentorId || null,
      menuTrainerId: menuTrainerId || null,
    },
  });

  if (existing) {
    const phaseType = existing.type;
    const histories: Array<{ action: string; oldValue: string | null; newValue: string | null }> = [];

    if (existing.status !== status) {
      histories.push({ action: `Updated ${phaseType} Training Status`, oldValue: existing.status, newValue: status });
    }

    // Look up new trainer names (User model) if IDs changed
    const trainerIds = [gdTrainerId, cosTrainerId, menuTrainerId].filter(Boolean);
    const trainerNames: Record<string, string> = {};
    if (trainerIds.length > 0) {
      const users = await prisma.user.findMany({ where: { id: { in: trainerIds } }, select: { id: true, name: true } });
      users.forEach(u => { trainerNames[u.id] = u.name; });
    }

    const trainerChecks: Array<{ label: string; oldId: string | null; newId: string; oldName: string | null }> = [
      { label: "GD Trainer",   oldId: existing.gdTrainerId,  newId: gdTrainerId,  oldName: existing.gdTrainer?.name ?? null },
      { label: "COS Trainer",  oldId: existing.cosTrainerId, newId: cosTrainerId, oldName: existing.cosTrainer?.name ?? null },
      { label: "Menu Trainer", oldId: existing.menuTrainerId, newId: menuTrainerId, oldName: existing.menuTrainer?.name ?? null },
    ];

    for (const { label, oldId, newId, oldName } of trainerChecks) {
      if ((oldId || "") !== (newId || "")) {
        const newName = newId ? (trainerNames[newId] ?? newId) : null;
        histories.push({ action: `Updated ${label}`, oldValue: oldName, newValue: newName });
      }
    }

    // Mentor changes (Mentor model, comma-separated IDs)
    async function resolveMentorNames(ids: string): Promise<string | null> {
      const parts = ids.split(",").filter(Boolean);
      if (parts.length === 0) return null;
      const found = await prisma.mentor.findMany({ where: { id: { in: parts } }, select: { name: true } });
      return found.map(m => m.name).join(", ") || null;
    }
    if ((existing.gdMentorId ?? "") !== (gdMentorId ?? "")) {
      histories.push({
        action: "Updated GD Mentor",
        oldValue: await resolveMentorNames(existing.gdMentorId ?? ""),
        newValue: await resolveMentorNames(gdMentorId ?? ""),
      });
    }
    if ((existing.cosMentorId ?? "") !== (cosMentorId ?? "")) {
      histories.push({
        action: "Updated COS Mentor",
        oldValue: await resolveMentorNames(existing.cosMentorId ?? ""),
        newValue: await resolveMentorNames(cosMentorId ?? ""),
      });
    }

    for (const h of histories) {
      await prisma.hireHistory.create({
        data: { newHireId, userId: session.id, userName: session.name, ...h },
      });
    }
  }

  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}

export async function recordGdCert(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  const actor = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (session.team !== "GD_TRAINING" && !actor?.isAdmin) return { error: "Permission denied" };

  const phaseId = formData.get("phaseId") as string;
  const newHireId = formData.get("newHireId") as string;
  const result = formData.get("result") as string;
  const notes = formData.get("notes") as string;

  await prisma.trainingPhase.update({
    where: { id: phaseId },
    data: {
      gdCertResult: result,
      gdCertDate: new Date(),
      gdCertNotes: notes || null,
    },
  });

  if (result === "PASSED") {
    const hire = await prisma.newHire.findUnique({ where: { id: newHireId }, select: { name: true } });
    await createNotificationsForTeams(
      ["GD_TRAINING", "COS_TRAINING"],
      `GD Certification Passed: ${hire?.name}`,
      `${hire?.name} passed GD certification — COS training can begin.`,
      `/new-hire/${newHireId}`
    );
  }

  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}

export async function recordCosCert(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  const actor = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (session.team !== "COS_TRAINING" && !actor?.isAdmin) return { error: "Permission denied" };

  const phaseId = formData.get("phaseId") as string;
  const newHireId = formData.get("newHireId") as string;
  const auditorName = formData.get("auditorName") as string;
  const auditorRole = formData.get("auditorRole") as string; // PRIMARY | LEAD | OPTIONAL
  const result = formData.get("result") as string;
  const notes = formData.get("notes") as string;
  const schedulePreference = formData.get("schedulePreference") as string;

  await prisma.certAudit.create({
    data: {
      trainingPhaseId: phaseId,
      auditorName,
      auditorId: session.id,
      role: auditorRole || "PRIMARY",
      result,
      notes: notes || null,
      auditedAt: new Date(),
    },
  });

  // Post-cert automation for COS-role hires that passed
  if (result === "PASSED") {
    const hire = await prisma.newHire.findUnique({
      where: { id: newHireId },
      select: { name: true, role: true, email: true, teamLeadEmail: true },
    });

    if (hire?.role === "COS") {
      // Only create RTA tasks once (guard against multiple auditor submissions)
      const existingScheduleTask = await prisma.task.findFirst({
        where: { newHireId, title: "Adjust Schedule Preference" },
      });

      if (!existingScheduleTask) {
        const schedTask = await prisma.task.create({
          data: { newHireId, team: "RTA", title: "Adjust Schedule Preference" },
        });
        await prisma.task.create({
          data: { newHireId, team: "RTA", title: "Remove Trainees Tag from POS ID" },
        });

        if (schedulePreference?.trim()) {
          await prisma.comment.create({
            data: {
              content: schedulePreference.trim(),
              authorId: session.id,
              taskId: schedTask.id,
            },
          });
        }

        await createNotificationsForTeams(
          ["RTA"],
          `Action needed: ${hire.name}`,
          `COS cert passed — adjust schedule preference and remove Trainees Tag from POS ID.`,
          `/new-hire/${newHireId}`
        );

        // Individual 1:1 Google Meet with team lead (4pm–5pm EST)
        createOneOnOneSession({
          hireName: hire.name,
          hireEmail: hire.email,
          teamLeadEmail: hire.teamLeadEmail,
          newHireId,
        });
      }
    }
  }

  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function recordCertAttempt(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const actor = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  const phaseId = formData.get("phaseId") as string;
  const newHireId = formData.get("newHireId") as string;
  const phaseType = formData.get("phaseType") as string; // "GD" | "COS"
  const result = formData.get("result") as string;
  const certDateStr = formData.get("certDate") as string;
  const notes = formData.get("notes") as string;
  const fileLink = formData.get("fileLink") as string;
  const nextAttemptDateStr = formData.get("nextAttemptDate") as string;
  const auditorResults = formData.getAll("auditorResult") as string[];

  if (phaseType === "GD" && session.team !== "GD_TRAINING" && !actor?.isAdmin) return { error: "Permission denied" };
  if (phaseType === "COS" && session.team !== "COS_TRAINING" && !actor?.isAdmin) return { error: "Permission denied" };

  const certDate = certDateStr ? new Date(certDateStr + "T00:00:00") : new Date();

  const existingCount = await prisma.certAttempt.count({ where: { trainingPhaseId: phaseId } });
  const overrideStr = formData.get("overrideAttemptNumber") as string;
  const attemptNumber = overrideStr && parseInt(overrideStr) > 0 ? parseInt(overrideStr) : existingCount + 1;

  const nextAttemptDate = nextAttemptDateStr ? new Date(nextAttemptDateStr + "T00:00:00") : null;

  const attempt = await prisma.certAttempt.create({
    data: {
      trainingPhaseId: phaseId,
      attemptNumber,
      result,
      certDate,
      fileLink: fileLink || null,
      nextAttemptDate,
      notes: notes || null,
      recordedById: session.id,
    },
  });

  if (phaseType === "COS") {
    const auditorNames = formData.getAll("auditorName") as string[];
    const auditorRoles = formData.getAll("auditorRole") as string[];
    for (let i = 0; i < auditorNames.length; i++) {
      if (auditorNames[i]?.trim()) {
        await prisma.certAudit.create({
          data: {
            trainingPhaseId: phaseId,
            certAttemptId: attempt.id,
            auditorName: auditorNames[i].trim(),
            auditorId: session.id,
            role: auditorRoles[i] || "PRIMARY",
            result: auditorResults[i] || result,
            notes: notes || null,
            auditedAt: certDate,
          },
        });
      }
    }
  }

  if (result === "FAILED" && nextAttemptDate) {
    await prisma.trainingPhase.update({
      where: { id: phaseId },
      data: { endDate: nextAttemptDate },
    });
  }

  if (result === "PASSED") {
    const hire = await prisma.newHire.findUnique({
      where: { id: newHireId },
      select: { name: true, role: true, email: true, teamLeadEmail: true },
    });

    await prisma.trainingPhase.update({
      where: { id: phaseId },
      data: {
        status: "COMPLETED",
        ...(phaseType === "GD" ? { gdCertResult: "PASSED", gdCertDate: certDate, gdCertNotes: notes || null } : {}),
      },
    });

    await prisma.performance.create({
      data: {
        newHireId,
        type: "CERT",
        period: attemptNumber,
        periodLabel: `${ordinal(attemptNumber)} Attempt — ${phaseType} Certification`,
        startDate: certDate,
        endDate: certDate,
        notes: notes || null,
      },
    });

    if (phaseType === "GD") {
      await createNotificationsForTeams(
        ["GD_TRAINING", "COS_TRAINING"],
        `GD Certification Passed: ${hire?.name}`,
        `${hire?.name} passed GD certification (${ordinal(attemptNumber)} attempt) — COS training can begin.`,
        `/new-hire/${newHireId}`
      );
    }

    if (phaseType === "COS" && hire?.role === "COS") {
      const schedulePreference = formData.get("schedulePreference") as string;
      const existingScheduleTask = await prisma.task.findFirst({
        where: { newHireId, title: "Adjust Schedule Preference" },
      });
      if (!existingScheduleTask) {
        const schedTask = await prisma.task.create({
          data: { newHireId, team: "RTA", title: "Adjust Schedule Preference" },
        });
        await prisma.task.create({
          data: { newHireId, team: "RTA", title: "Remove Trainees Tag from POS ID" },
        });
        if (schedulePreference?.trim()) {
          await prisma.comment.create({
            data: { content: schedulePreference.trim(), authorId: session.id, taskId: schedTask.id },
          });
        }
        await createNotificationsForTeams(
          ["RTA"],
          `Action needed: ${hire.name}`,
          `COS cert passed — adjust schedule preference and remove Trainees Tag from POS ID.`,
          `/new-hire/${newHireId}`
        );
        createOneOnOneSession({
          hireName: hire.name,
          hireEmail: hire.email,
          teamLeadEmail: hire.teamLeadEmail,
          newHireId,
        });
      }
    }
  }

  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}

export async function deleteNewHire(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  const actor = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (session.team !== "HR" && !actor?.isAdmin) {
    return { error: "Permission denied" };
  }

  const newHireId = formData.get("newHireId") as string;
  const reason = formData.get("reason") as string;

  if (!reason?.trim()) return { error: "Reason is required" };

  const hire = await prisma.newHire.update({
    where: { id: newHireId },
    data: {
      status: "DELETED",
      deleteReason: reason,
      deletedAt: new Date(),
    },
  });

  // Notify all teams
  await createNotificationsForTeams(
    ALL_TEAMS,
    `New hire removed: ${hire.name}`,
    `${hire.name}'s onboarding has been cancelled by ${session.name}. Reason: ${reason}`,
    "/dashboard"
  );

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateHireDetails(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const actor = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  const isAdmin = !!actor?.isAdmin;
  const isHR = session.team === "HR";
  const isIT = session.team === "IT";
  const isRTA = session.team === "RTA";

  if (!isHR && !isIT && !isRTA && !isAdmin) return { error: "Permission denied" };

  const newHireId = formData.get("newHireId") as string;
  const existing = await prisma.newHire.findUnique({ where: { id: newHireId } });
  if (!existing) return { error: "Hire not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  let joinDateChanged = false;
  let newJoinDate = existing.joinDate;

  if (isHR || isAdmin) {
    const joinDateStr = formData.get("joinDate") as string | null;
    const teamLeadName = formData.get("teamLeadName") as string | null;
    const bambooEid = formData.get("bambooEid") as string | null;
    if (joinDateStr) {
      newJoinDate = parseLocalDate(joinDateStr);
      joinDateChanged = newJoinDate.toISOString() !== existing.joinDate.toISOString();
      updateData.joinDate = newJoinDate;
    }
    if (teamLeadName !== null) updateData.teamLeadName = teamLeadName || null;
    if (bambooEid) updateData.bambooEid = bambooEid;
  }

  if (isIT || isAdmin) {
    const itTicketId = formData.get("itTicketId") as string | null;
    if (itTicketId !== null) updateData.itTicketId = itTicketId || null;
  }

  if (isRTA || isAdmin) {
    const posId = formData.get("posId") as string | null;
    if (posId !== null) updateData.posId = posId || null;
  }

  if (isAdmin) {
    const waveNumberStr = formData.get("waveNumber") as string | null;
    if (waveNumberStr !== null) {
      updateData.waveNumber = waveNumberStr ? parseInt(waveNumberStr, 10) : null;
    }
  }

  if (Object.keys(updateData).length === 0) return { error: "Nothing to update" };

  const FIELD_LABELS: Record<string, string> = {
    bambooEid: "Employee ID", posId: "POS ID", joinDate: "Join Date",
    teamLeadName: "Team Lead", waveNumber: "Wave", itTicketId: "IT Ticket",
  };

  await prisma.newHire.update({ where: { id: newHireId }, data: updateData });

  for (const [field, newVal] of Object.entries(updateData)) {
    const oldVal = (existing as Record<string, unknown>)[field];
    const oldStr = oldVal != null ? String(oldVal) : "";
    const newStr = newVal != null ? String(newVal) : "";
    if (oldStr !== newStr) {
      await prisma.hireHistory.create({
        data: {
          newHireId,
          userId: session.id,
          userName: session.name,
          action: `Updated ${FIELD_LABELS[field] ?? field}`,
          oldValue: oldStr || null,
          newValue: newStr || null,
        },
      });
    }
  }

  if (joinDateChanged) {
    await createNotificationsForTeams(
      ALL_TEAMS,
      `Join date updated: ${existing.name}`,
      `${existing.name}'s join date has been changed to ${newJoinDate.toLocaleDateString()} by ${session.name}.`,
      `/new-hire/${newHireId}`
    );
  }

  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}

export async function updatePosId(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const actor = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (session.team !== "RTA" && !actor?.isAdmin) {
    return { error: "Permission denied" };
  }

  const newHireId = formData.get("newHireId") as string;
  const posId = formData.get("posId") as string;

  await prisma.newHire.update({
    where: { id: newHireId },
    data: { posId: posId || null },
  });

  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}

export async function updateCertNextAttemptDate(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };
  const actor = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
  if (session.team !== "COS_TRAINING" && session.team !== "GD_TRAINING" && !actor?.isAdmin) {
    return { error: "Permission denied" };
  }

  const attemptId = formData.get("attemptId") as string;
  const phaseId = formData.get("phaseId") as string;
  const newHireId = formData.get("newHireId") as string;
  const dateStr = formData.get("nextAttemptDate") as string;
  const nextAttemptDate = dateStr ? new Date(dateStr + "T00:00:00") : null;

  await prisma.certAttempt.update({ where: { id: attemptId }, data: { nextAttemptDate } });

  if (nextAttemptDate) {
    await prisma.trainingPhase.update({ where: { id: phaseId }, data: { endDate: nextAttemptDate } });
  }

  revalidatePath(`/new-hire/${newHireId}`);
  return { success: true };
}

export async function requestJoinDate(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const dateStr = formData.get("date") as string;
  const reason = formData.get("reason") as string;

  if (!dateStr || !reason) return { error: "Date and reason are required" };

  await prisma.joinDateRequest.create({
    data: {
      requestedDate: parseLocalDate(dateStr),
      reason,
      requestedById: session.id,
    },
  });

  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  for (const admin of admins) {
    await createNotificationForUser(
      admin.id,
      "New Join Date Request",
      `${session.name} requested ${parseLocalDate(dateStr).toLocaleDateString()}. Reason: ${reason}`,
      "/admin"
    );
  }

  return { success: true };
}
