export type DisplayStatus = "UPCOMING" | "ONGOING" | "COMPLETED" | "RESIGNED" | "DELETED";

export interface HireForStatus {
  status: string;
  joinDate: Date;
  deleteReason?: string | null;
  trainingPhases: { endDate: Date; status?: string }[];
}

export function getDisplayStatus(hire: HireForStatus): DisplayStatus {
  if (hire.status === "DELETED") {
    const reason = (hire.deleteReason || "").toLowerCase();
    if (reason.includes("resign")) return "RESIGNED";
    return "DELETED";
  }

  const now = new Date();
  const joinDate = new Date(hire.joinDate);

  if (now < joinDate) return "UPCOMING";

  // If every phase has an explicit COMPLETED status, mark as completed regardless of date
  if (
    hire.trainingPhases.length > 0 &&
    hire.trainingPhases.every((p) => p.status === "COMPLETED")
  ) {
    return "COMPLETED";
  }

  const lastEnd = hire.trainingPhases.length > 0
    ? new Date(Math.max(...hire.trainingPhases.map((p) => new Date(p.endDate).getTime())))
    : joinDate;

  // Compare by date only (ignore time) so end-of-training-day counts as completed
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastEndDate = new Date(lastEnd.getFullYear(), lastEnd.getMonth(), lastEnd.getDate());

  if (nowDate >= lastEndDate) return "COMPLETED";
  return "ONGOING";
}

export const STATUS_STYLES: Record<DisplayStatus, { label: string; badge: string; card: string }> = {
  UPCOMING:  { label: "Upcoming",  badge: "bg-purple-100 text-purple-700", card: "border-gray-200 bg-white" },
  ONGOING:   { label: "Ongoing",   badge: "bg-blue-100 text-blue-700",     card: "border-blue-200 bg-white" },
  COMPLETED: { label: "Completed", badge: "bg-green-100 text-green-700",   card: "border-green-200 bg-white" },
  RESIGNED:  { label: "Resigned",  badge: "bg-orange-100 text-orange-700", card: "border-orange-200 bg-orange-50" },
  DELETED:   { label: "Deleted",   badge: "bg-red-100 text-red-700",       card: "border-red-200 bg-red-50" },
};
