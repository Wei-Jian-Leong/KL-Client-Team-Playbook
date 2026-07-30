import { prisma } from "@/lib/prisma";

export const ALL_PAGES = ["dashboard", "schedule", "knowledge", "announcements", "training", "admin"] as const;
export type Page = typeof ALL_PAGES[number];

export const COS_ROLES = ["USER", "SUPPORT", "ADMIN"] as const;
export type CosRole = typeof COS_ROLES[number];

export const PAGE_LABELS: Record<Page, string> = {
  dashboard: "New Hire Info",
  schedule: "Training Schedule",
  knowledge: "Knowledge Base",
  announcements: "Updates",
  training: "Training Materials",
  admin: "Admin Page",
};

export const ROLE_LABELS: Record<CosRole, string> = {
  USER: "User",
  SUPPORT: "Support",
  ADMIN: "Admin",
};

export async function getRoleAccessMap(role: string): Promise<Record<string, boolean>> {
  if (!role) return {};
  const rows = await prisma.roleAccess.findMany({ where: { role } });
  const map: Record<string, boolean> = {};
  for (const r of rows) map[r.page] = r.enabled;
  return map;
}

export async function getFullRoleAccessConfig(): Promise<Record<string, Record<string, boolean>>> {
  const rows = await prisma.roleAccess.findMany();
  const config: Record<string, Record<string, boolean>> = {};
  for (const r of rows) {
    if (!config[r.role]) config[r.role] = {};
    config[r.role][r.page] = r.enabled;
  }
  return config;
}
