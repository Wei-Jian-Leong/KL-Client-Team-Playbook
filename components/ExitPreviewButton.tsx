"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPreviewUser } from "@/app/actions/auth";

export default function ExitPreviewButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      onClick={() => startTransition(async () => { await setPreviewUser(null); router.refresh(); })}
      disabled={pending}
      title="Exit preview"
      className="flex items-center justify-center w-6 h-6 rounded border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-colors disabled:opacity-50"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );
}
