"use server";

/**
 * Google Calendar helpers for HR Onboarding.
 * All event times are in America/New_York (EST/EDT, shown as EST GMT-4).
 *
 * Required env vars:
 *   GOOGLE_CLIENT_EMAIL    — service account email
 *   GOOGLE_PRIVATE_KEY     — service account private key (replace \n with actual newlines)
 *   GOOGLE_CALENDAR_ID     — calendar to create events on (default: primary)
 *   GCAL_HOST_EMAIL        — organiser/host email (default: wei.leong@wondersco.com)
 *   GCAL_ATTENDEE_CALLIE   — Callie's email
 *   GCAL_ATTENDEE_JIVANISH — Jivanish's email
 *
 * Missing required vars → warning logged, function returns null (never blocks hire creation).
 */

import { google } from "googleapis";
import { addWorkingDays } from "@/lib/training";

function getCalendarClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const hostEmail = process.env.GCAL_HOST_EMAIL ?? "wei.leong@wondersco.com";

  if (!clientEmail || !privateKey) return null;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: hostEmail,
  });
  return { calendar: google.calendar({ version: "v3", auth }), hostEmail };
}

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Day 1 Orientation — 4pm–5:30pm EST on join date
// ---------------------------------------------------------------------------
export async function createDay1GMeet(params: {
  hireName: string;
  hireEmail: string | null;
  joinDate: Date;
  newHireId: string;
}): Promise<string | null> {
  const client = getCalendarClient();
  if (!client) {
    console.warn("[gcal] GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY not set — skipping Day 1 GMeet");
    return null;
  }

  try {
    const { calendar, hostEmail } = client;
    const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
    const callieEmail = process.env.GCAL_ATTENDEE_CALLIE;
    const jivanishEmail = process.env.GCAL_ATTENDEE_JIVANISH;

    const dateStr = toDateStr(params.joinDate);
    const attendees: { email: string }[] = [{ email: hostEmail }];
    if (callieEmail) attendees.push({ email: callieEmail });
    if (jivanishEmail) attendees.push({ email: jivanishEmail });
    if (params.hireEmail) attendees.push({ email: params.hireEmail });

    const response = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Day 1 Orientation — ${params.hireName}`,
        description: `New hire onboarding orientation for ${params.hireName}.\n\nOnboarding tracker: ${process.env.NEXTAUTH_URL ?? ""}/new-hire/${params.newHireId}`,
        start: { dateTime: `${dateStr}T16:00:00`, timeZone: "America/New_York" },
        end:   { dateTime: `${dateStr}T17:30:00`, timeZone: "America/New_York" },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `orientation-${params.newHireId}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 30 },
          ],
        },
      },
    });

    const meetLink = response.data.hangoutLink ?? null;
    console.log(`[gcal] Day 1 GMeet for ${params.hireName}: ${meetLink}`);
    return meetLink;
  } catch (err) {
    console.error("[gcal] Failed to create Day 1 GMeet:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Meet & Greet — 6pm–6:30pm EST on day 10 of training, grouped by wave+role
// Returns the Google Calendar event ID (to store for deduplication).
// ---------------------------------------------------------------------------
export async function createMeetAndGreetSession(params: {
  waveNumber: number;
  role: string;
  trainingStartDate: Date;
  hires: { id: string; name: string; email: string | null; teamLeadEmail: string | null }[];
}): Promise<string | null> {
  const client = getCalendarClient();
  if (!client) {
    console.warn("[gcal] Missing credentials — skipping Meet & Greet creation");
    return null;
  }

  try {
    const { calendar, hostEmail } = client;
    const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

    // Day 10 of training (10th working day from training start)
    const day10 = addWorkingDays(params.trainingStartDate, 10);
    const dateStr = toDateStr(day10);

    const uniqueEmails = new Set<string>([hostEmail]);
    for (const h of params.hires) {
      if (h.email) uniqueEmails.add(h.email);
      if (h.teamLeadEmail) uniqueEmails.add(h.teamLeadEmail);
    }
    const attendees = Array.from(uniqueEmails).map((email) => ({ email }));

    const hireNames = params.hires.map((h) => h.name).join(", ");

    const response = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      requestBody: {
        summary: `Meet & Greet — Wave ${params.waveNumber} ${params.role}`,
        description: `Meet & Greet session for Wave ${params.waveNumber} ${params.role} new hires.\n\nHires: ${hireNames}\n\nOnboarding tracker: ${process.env.NEXTAUTH_URL ?? ""}`,
        start: { dateTime: `${dateStr}T18:00:00`, timeZone: "America/New_York" },
        end:   { dateTime: `${dateStr}T18:30:00`, timeZone: "America/New_York" },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `meetgreet-w${params.waveNumber}-${params.role}-${dateStr}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 15 },
          ],
        },
      },
    });

    const eventId = response.data.id ?? null;
    console.log(`[gcal] Meet & Greet created for Wave ${params.waveNumber} ${params.role}: ${eventId}`);
    return eventId;
  } catch (err) {
    console.error("[gcal] Failed to create Meet & Greet:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Add attendees to an existing Google Calendar event (for late-joining hires)
// ---------------------------------------------------------------------------
export async function addAttendeeToEvent(params: {
  eventId: string;
  emails: string[];
}): Promise<void> {
  const client = getCalendarClient();
  if (!client) return;

  try {
    const { calendar } = client;
    const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

    const existing = await calendar.events.get({ calendarId, eventId: params.eventId });
    const current = (existing.data.attendees ?? []).map((a) => ({ email: a.email! }));
    const currentEmails = new Set(current.map((a) => a.email));
    const toAdd = params.emails
      .filter((e) => e && !currentEmails.has(e))
      .map((e) => ({ email: e }));

    if (toAdd.length === 0) return;

    await calendar.events.patch({
      calendarId,
      eventId: params.eventId,
      requestBody: { attendees: [...current, ...toAdd] },
    });
    console.log(`[gcal] Added ${toAdd.map((a) => a.email).join(", ")} to event ${params.eventId}`);
  } catch (err) {
    console.error("[gcal] Failed to add attendee to event:", err);
  }
}

// ---------------------------------------------------------------------------
// 1:1 Session — 4pm–5pm EST, individual per COS hire after cert
// ---------------------------------------------------------------------------
export async function createOneOnOneSession(params: {
  hireName: string;
  hireEmail: string | null;
  teamLeadEmail: string | null;
  newHireId: string;
}): Promise<void> {
  const client = getCalendarClient();
  if (!client) {
    console.warn("[gcal] Missing credentials — skipping 1:1 session creation");
    return;
  }

  try {
    const { calendar, hostEmail } = client;
    const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

    // Schedule for next working day
    const now = new Date();
    const nextDay = addWorkingDays(now, 2); // +2 ensures we land on a working day
    const dateStr = toDateStr(nextDay);

    const uniqueEmails = new Set<string>([hostEmail]);
    if (params.hireEmail) uniqueEmails.add(params.hireEmail);
    if (params.teamLeadEmail) uniqueEmails.add(params.teamLeadEmail);
    const attendees = Array.from(uniqueEmails).map((email) => ({ email }));

    await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      requestBody: {
        summary: `1:1 Session — ${params.hireName}`,
        description: `Post-certification 1:1 session for ${params.hireName}.\n\nOnboarding tracker: ${process.env.NEXTAUTH_URL ?? ""}/new-hire/${params.newHireId}`,
        start: { dateTime: `${dateStr}T16:00:00`, timeZone: "America/New_York" },
        end:   { dateTime: `${dateStr}T17:00:00`, timeZone: "America/New_York" },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `oneonone-${params.newHireId}-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 15 },
          ],
        },
      },
    });

    console.log(`[gcal] 1:1 session created for ${params.hireName} on ${dateStr}`);
  } catch (err) {
    console.error("[gcal] Failed to create 1:1 session:", err);
  }
}
