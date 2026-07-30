"use server";

import { google } from "googleapis";

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.GLOSSARY_SHEET_ID;

  if (!clientEmail || !privateKey || !sheetId) return null;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return { sheets: google.sheets({ version: "v4", auth }), sheetId };
}

async function upsertTab(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  tabName: string
) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const exists = meta.data.sheets?.some(s => s.properties?.title === tabName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
  }
}

async function writeTab(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  tabName: string,
  rows: string[][]
) {
  await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: `${tabName}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}

export async function pushGlossaryToSheet(
  terms: { termEn: string; termZh: string; note: string | null; updatedAt: Date }[]
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const client = getSheetsClient();
  if (!client) return { ok: false, error: "Google Sheets not configured. Add GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GLOSSARY_SHEET_ID to .env." };

  const { sheets, sheetId } = client;
  try {
    await upsertTab(sheets, sheetId, "Glossary");
    await writeTab(sheets, sheetId, "Glossary", [
      ["EN Term (variants)", "CN Override", "Note", "Last Updated"],
      ...terms.map(t => [
        t.termEn,
        t.termZh,
        t.note ?? "",
        t.updatedAt.toISOString().slice(0, 16).replace("T", " "),
      ]),
    ]);
    return { ok: true, url: `https://docs.google.com/spreadsheets/d/${sheetId}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GSheets glossary sync error]", msg);
    return { ok: false, error: msg };
  }
}

export async function pushTranslationMemoryToSheet(
  memories: {
    publishedAt: Date;
    aiTitleZh: string;
    pubTitleZh: string;
    aiContentZh?: string | null;
    pubContentZh?: string | null;
    article: { title: string; articleNo: number | null };
  }[]
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const client = getSheetsClient();
  if (!client) return { ok: false, error: "Google Sheets not configured." };

  const { sheets, sheetId } = client;
  try {
    await upsertTab(sheets, sheetId, "Translation Memory");
    await writeTab(sheets, sheetId, "Translation Memory", [
      ["Article No", "Article Title", "Published At", "AI Title (ZH)", "Approved Title (ZH)", "Title Changed", "AI Content (ZH)", "Approved Content (ZH)"],
      ...memories.map(m => [
        m.article.articleNo ? String(m.article.articleNo) : "",
        m.article.title,
        m.publishedAt.toISOString().slice(0, 16).replace("T", " "),
        m.aiTitleZh,
        m.pubTitleZh,
        m.aiTitleZh !== m.pubTitleZh ? "Yes" : "No",
        m.aiContentZh ?? "",
        m.pubContentZh ?? "",
      ]),
    ]);
    return { ok: true, url: `https://docs.google.com/spreadsheets/d/${sheetId}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GSheets memory sync error]", msg);
    return { ok: false, error: msg };
  }
}

export async function pushTalkTrackMemoryToSheet(
  memories: {
    savedAt: Date;
    language: string;
    aiDraft: string;
    savedContent: string;
  }[]
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const client = getSheetsClient();
  if (!client) return { ok: false, error: "Google Sheets not configured." };

  const { sheets, sheetId } = client;
  try {
    await upsertTab(sheets, sheetId, "Talk Track Memory");
    await writeTab(sheets, sheetId, "Talk Track Memory", [
      ["Language", "Saved At", "AI Draft", "Trainer Preferred", "Changed"],
      ...memories.map(m => [
        m.language,
        m.savedAt.toISOString().slice(0, 16).replace("T", " "),
        m.aiDraft,
        m.savedContent,
        m.aiDraft !== m.savedContent ? "Yes" : "No",
      ]),
    ]);
    return { ok: true, url: `https://docs.google.com/spreadsheets/d/${sheetId}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GSheets talk track memory sync error]", msg);
    return { ok: false, error: msg };
  }
}

export async function isGlossarySheetConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GLOSSARY_SHEET_ID
  );
}
