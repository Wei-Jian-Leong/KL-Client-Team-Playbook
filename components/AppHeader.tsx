import Link from "next/link";
import { getTeamLabel } from "@/lib/training";
import NotificationBell from "./NotificationBell";
import DarkModeToggle from "./DarkModeToggle";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import ExitPreviewButton from "./ExitPreviewButton";

interface Notification {
  id: string;
  title: string;
  content: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
}

interface NewHire {
  id: string;
  name: string;
  role: string;
}

interface Props {
  session: { id: string; name: string; team: string; position?: string; isNewHire?: boolean };
  isAdmin: boolean;
  notifications: Notification[];
  unread: number;
  activePage?: "dashboard" | "admin" | "performance" | "schedule" | "knowledge" | "training-materials" | "announcements";
  roleAccess?: Record<string, boolean>;
  newHires?: NewHire[];
  previewingAs?: { id: string; name: string } | null;
}

const COS_POSITION_LABELS: Record<string, string> = {
  USER: "User",
  SUPPORT: "Support",
  ADMIN: "Admin",
};

export default function AppHeader({ session, isAdmin, notifications, unread, activePage, roleAccess = {}, newHires = [], previewingAs = null }: Props) {
  const isNewHire = !!session.isNewHire || session.team === "NEW_HIRE";
  const canAccess = (page: string) => isAdmin || !!roleAccess[page];
  const subtitle = session.position ? (COS_POSITION_LABELS[session.position] ?? session.position) : getTeamLabel(session.team);

  const navLink = (href: string, page: typeof activePage, label: string) => (
    <Link
      href={href}
      className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
        activePage === page
          ? "bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-900/40 dark:text-indigo-300"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      {previewingAs && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 px-6 py-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Previewing as <strong className="ml-0.5">{previewingAs.name}</strong>
          </div>
          <ExitPreviewButton />
        </div>
      )}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-6">
          <Link href={isNewHire ? "/training-materials" : canAccess("knowledge") ? "/knowledge" : "/knowledge"}>
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            {!isNewHire && canAccess("dashboard") && navLink("/dashboard", "dashboard", "New Hire")}
            {!isNewHire && canAccess("knowledge") && navLink("/knowledge", "knowledge", "Knowledge Base")}
            {!isNewHire && canAccess("announcements") && navLink("/announcements", "announcements", "Updates")}
            {canAccess("training") && navLink("/training-materials", "training-materials", "Training Materials")}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <DarkModeToggle />
          <NotificationBell userId={session.id} initialNotifications={notifications} initialUnread={unread} />
          <UserMenu
            session={session}
            isAdmin={isAdmin}
            newHires={newHires}
            previewingAs={previewingAs}
            subtitle={subtitle}
          />
        </div>
      </header>
    </>
  );
}
