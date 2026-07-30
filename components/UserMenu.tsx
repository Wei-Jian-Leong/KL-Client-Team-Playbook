"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { logout, setPreviewUser } from "@/app/actions/auth";

interface NewHire {
  id: string;
  name: string;
  role: string;
}

interface Props {
  session: { name: string; team: string; position?: string };
  isAdmin: boolean;
  newHires: NewHire[];
  previewingAs: { id: string; name: string } | null;
  subtitle: string;
}

export default function UserMenu({ session, isAdmin, newHires, previewingAs, subtitle }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handlePreviewChange(newHireId: string) {
    startTransition(async () => {
      await setPreviewUser(newHireId || null);
      setOpen(false);
      router.refresh();
    });
  }

  function handleExitPreview() {
    startTransition(async () => {
      await setPreviewUser(null);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative ml-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-right hover:opacity-75 transition-opacity focus:outline-none"
      >
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{session.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
          {isAdmin && (
            <>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gray-400"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                Admin
              </Link>
              <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
            </>
          )}

          {isAdmin && newHires.length > 0 && (
            <>
              <div className="px-4 pt-1 pb-1">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Preview as</p>
                {previewingAs && (
                  <button
                    onClick={handleExitPreview}
                    disabled={pending}
                    title="Exit preview"
                    className="flex items-center justify-center w-7 h-7 mb-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-colors disabled:opacity-50"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
                <select
                  value={previewingAs?.id ?? ""}
                  onChange={e => handlePreviewChange(e.target.value)}
                  disabled={pending}
                  className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                >
                  <option value="">Select user…</option>
                  {newHires.map(nh => (
                    <option key={nh.id} value={nh.id}>{nh.name} ({nh.role})</option>
                  ))}
                </select>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
            </>
          )}

          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gray-400"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
