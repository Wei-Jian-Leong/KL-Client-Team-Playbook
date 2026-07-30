"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function PerformanceTabs({ activeTab }: { activeTab: "kpi" | "cert" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={() => switchTab("cert")}
        className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 ${
          activeTab === "cert"
            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800"
            : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500"
        }`}
      >
        Certification Results
      </button>
      <button
        onClick={() => switchTab("kpi")}
        className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 ${
          activeTab === "kpi"
            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800"
            : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500"
        }`}
      >
        First 4 Month KPI
      </button>
    </div>
  );
}
