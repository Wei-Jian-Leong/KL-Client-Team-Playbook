import { NextResponse } from "next/server";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "https://wondersco.atlassian.net";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

function authHeader() {
  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  return `Basic ${credentials}`;
}

async function jiraGet(path: string) {
  const res = await fetch(`${JIRA_BASE_URL}${path}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const issue = searchParams.get("issue");
  const sdId = searchParams.get("sd");
  const rtId = searchParams.get("rt");

  // Fetch a specific issue to discover its custom field IDs
  if (issue) {
    const r = await jiraGet(`/rest/api/2/issue/${issue}`);
    if (r.status === 200) {
      const fields = r.body.fields as Record<string, unknown>;
      const summary = Object.entries(fields)
        .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
        .map(([k, v]) => ({ fieldId: k, value: typeof v === "object" ? JSON.stringify(v).slice(0, 120) : v }));
      return NextResponse.json({ issueKey: r.body.key, fields: summary });
    }
    return NextResponse.json(r);
  }

  // Fetch all custom fields defined in the Jira instance
  const meta = searchParams.get("meta");
  if (meta === "fields") {
    const r = await jiraGet("/rest/api/2/field");
    if (r.status === 200) {
      const custom = (r.body as Array<{id: string; name: string; custom: boolean}>)
        .filter(f => f.custom)
        .map(f => ({ fieldId: f.id, name: f.name }));
      return NextResponse.json(custom);
    }
    return NextResponse.json(r);
  }

  if (sdId && rtId) {
    const r = await jiraGet(`/rest/servicedeskapi/servicedesk/${sdId}/requesttype/${rtId}/field`);
    return NextResponse.json(r);
  }

  if (sdId) {
    const r = await jiraGet(`/rest/servicedeskapi/servicedesk/${sdId}/requesttype`);
    return NextResponse.json(r);
  }

  const r = await jiraGet("/rest/servicedeskapi/servicedesk");
  return NextResponse.json(r);
}
