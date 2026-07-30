"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "New Hires", href: "/dashboard" },
  { label: "Training Schedule", href: "/schedule" },
  { label: "Performance", href: "/performance" },
];

export default function NewHireTabBar() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 -mt-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              active
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
