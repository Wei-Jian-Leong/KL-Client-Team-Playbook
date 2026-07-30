// Maps known email addresses to their team
const EMAIL_TEAM_MAP: Record<string, string> = {
  "wei.leong@wondersco.com": "COS_TRAINING",
  "cassandra.yap@wondersco.com": "HR",
  "callie.foo@wondersco.com": "HR",
  "jivanish.sures@wondersco.com": "IT",
  "kyll.delrosario@wondersco.com": "RTA",
  "jalyn.bael@wondersco.com": "RTA",
};

// Admin emails
const ADMIN_EMAILS = new Set(["wei.leong@wondersco.com"]);

export function getTeamFromEmail(email: string): string | null {
  return EMAIL_TEAM_MAP[email.toLowerCase()] || null;
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}

export const TEAM_OPTIONS = [
  { value: "HR", label: "HR" },
  { value: "IT", label: "IT" },
  { value: "RTA", label: "RTA (Workforce)" },
  { value: "GD_TRAINING", label: "GD Training" },
  { value: "COS_TRAINING", label: "COS Training" },
  { value: "MENU_TRAINING", label: "Menu Training" },
];
