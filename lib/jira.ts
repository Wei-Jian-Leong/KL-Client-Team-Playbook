const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "https://wondersco.atlassian.net";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const SERVICE_DESK_ID = process.env.JIRA_SERVICE_DESK_ID || "2";
const REQUEST_TYPE_ID = process.env.JIRA_ONBOARDING_REQUEST_TYPE_ID || "267";

function authHeader() {
  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  return `Basic ${credentials}`;
}

const ROLE_TITLES: Record<string, string> = {
  COS: "Client Operations Specialist",
  PIS: "Product Implementation Specialist",
  OSM: "Onboarding Success Manager",
  AE: "Account Executive",
  BILLING_COLLECTION: "Billing & Collection",
};

function buildComments(hire: {
  bambooEid: string;
  name: string;
  site?: string;
  employeeType?: string;
  employeeTeam?: string;
  role: string;
  roleDescription?: string;
}): string {
  const firstName = hire.name.split(" ")[0];
  const lastName = hire.name.split(" ").slice(1).join(" ");
  const employeeTitle = ROLE_TITLES[hire.role] ?? hire.roleDescription ?? "Other";
  const siteSlug = (hire.site ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  return [
    "Hi Team,",
    `EID: ${hire.bambooEid}`,
    `There is 1 new hire, kindly create email and slack access (please add to channels #kudos, #tarroific-life, #office-${siteSlug}, #tarro-global).`,
    "Include to group email / department email and my@wondersco.com",
    "",
    "Hi IT team,",
    "Appreciate your support in preparing the laptops and necessary peripherals (e.g., headsets) for the following new hires. Thank you in advance!",
    "",
    "Hello Capplan,",
    `Kindly create necessary access for upcoming 1 ${(hire.employeeType ?? "").toLowerCase()} and ping me the login name & password once done.`,
    "",
    `1. First Name: ${firstName}  Last Name: ${lastName}`,
    `2. Preferred Name: ${firstName}`,
    `3. Job Title: ${employeeTitle}  Team: ${hire.employeeTeam ?? ""}`,
  ].join("\n");
}

export async function discoverJiraFields(): Promise<Record<string, string>[]> {
  const res = await fetch(
    `${JIRA_BASE_URL}/rest/servicedeskapi/servicedesk/${SERVICE_DESK_ID}/requesttype/${REQUEST_TYPE_ID}/field`,
    {
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
        "X-Atlassian-Token": "no-check",
      },
    }
  );
  if (!res.ok) throw new Error(`Jira fields fetch failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.requestTypeFields ?? [];
}

export async function createOnboardingTicket(hire: {
  name: string;
  nric: string;
  bambooEid: string;
  role: string;
  roleDescription?: string;
  joinDate: Date;
  itTicketId?: string | null;
  email?: string;
  personalEmail?: string;
  managerEmail?: string;
  location?: string;
  site?: string;
  division?: string;
  department?: string;
  employeeTeam?: string;
  employmentType?: string;
  employeeType?: string;
  laptopNeeded?: string;
  equipmentDelivery?: string;
}): Promise<{ ticketId: string; ticketUrl: string } | null> {
  if (!JIRA_API_TOKEN) {
    console.warn("JIRA_API_TOKEN not set — skipping Jira ticket creation");
    return null;
  }

  try {
    const employeeTitle = ROLE_TITLES[hire.role] ?? hire.roleDescription ?? "Other";
    const comments = buildComments(hire);

    // Step 1: create ticket via Service Desk API (only summary is customer-visible)
    const createRes = await fetch(`${JIRA_BASE_URL}/rest/servicedeskapi/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
        "X-Atlassian-Token": "no-check",
      },
      body: JSON.stringify({
        serviceDeskId: SERVICE_DESK_ID,
        requestTypeId: REQUEST_TYPE_ID,
        requestFieldValues: {
          summary: `Employee On-boarding Request - ${hire.name}`,
        },
      }),
    });

    if (!createRes.ok) {
      console.error("Jira ticket creation failed:", await createRes.text());
      return null;
    }

    const created = await createRes.json();
    const ticketId: string = created.issueKey;
    const ticketUrl = `${JIRA_BASE_URL}/servicedesk/customer/portal/2/${ticketId}`;

    // Step 2: update all custom fields via the regular Jira REST API
    // Jira date-time fields expect ISO 8601 with timezone offset
    const startDate = new Date(hire.joinDate);
    startDate.setUTCHours(1, 0, 0, 0); // 09:00 MYT = 01:00 UTC
    const startDateStr = startDate.toISOString().replace("Z", "+0000");

    const customFields: Record<string, unknown> = {
      customfield_10214: hire.name,               // Employee Name
      customfield_10306: employeeTitle,            // Employee Position (title)
      customfield_10212: hire.email ?? "",         // Work Email Address
      customfield_10507: hire.personalEmail ?? "", // Personal Email Address
      customfield_10436: hire.managerEmail ?? "",  // Manager Email
      customfield_10307: hire.location ?? "",      // Location
      customfield_10308: hire.site ?? "",          // Site
      customfield_10579: startDateStr,             // Start date and time
      customfield_10303: hire.department ?? "",    // Department
      customfield_10151: hire.employmentType ?? "", // Employment Type
      customfield_10578: hire.employeeType ?? "",  // Employee Type
      customfield_10683: comments,                 // Comments
      description: [
        `Division: ${hire.division ?? ""}`,
        `Department: ${hire.department ?? ""}`,
        `Team: ${hire.employeeTeam ?? ""}`,
        hire.employeeType === "Non-agent" ? `Laptop needed: ${hire.laptopNeeded ?? ""}` : "",
        hire.employeeType === "Non-agent" ? `Equipment delivery: ${hire.equipmentDelivery ?? ""}` : "",
      ].filter(Boolean).join("\n"),
    };

    if (hire.employeeType === "Non-agent") {
      customFields["customfield_10437"] = hire.laptopNeeded ?? ""; // Laptop
    }

    const updateRes = await fetch(`${JIRA_BASE_URL}/rest/api/2/issue/${ticketId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
        "X-Atlassian-Token": "no-check",
      },
      body: JSON.stringify({ fields: customFields }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error(`Jira ticket ${ticketId} created but field update failed:`, err);
      // Still return the ticket — it exists, fields just need manual fill
    }

    return { ticketId, ticketUrl };
  } catch (e) {
    console.error("Jira API error:", e);
    return null;
  }
}
