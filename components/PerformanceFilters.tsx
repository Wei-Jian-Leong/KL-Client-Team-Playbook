"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

type Props = {
  waves: number[];
  prefix: "k" | "c"; // "k" for KPI tab, "c" for Cert tab
  sort?: string;
  name?: string;
};

export default function PerformanceFilters({ waves, prefix, sort, name }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const waveKey = `${prefix}wave`;
  const sortKey = `${prefix}sort`;
  const nameKey = `${prefix}name`;

  const wave = searchParams.get(waveKey) || "";
  const currentSort = searchParams.get(sortKey) || "";
  const currentName = searchParams.get(nameKey) || "";

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(waveKey);
    params.delete(sortKey);
    params.delete(nameKey);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams, waveKey, sortKey, nameKey]);

  const hasFilters = wave || currentSort || currentName;

  return (
    <div className="flex items-center gap-3 flex-wrap mb-6">
      {/* Name search */}
      <input
        type="text"
        value={currentName}
        onChange={(e) => update(nameKey, e.target.value)}
        placeholder="Search by name..."
        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
      />

      <select
        value={wave}
        onChange={(e) => update(waveKey, e.target.value)}
        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">All Waves</option>
        {waves.map((w) => (
          <option key={w} value={String(w)}>
            Wave {w}
          </option>
        ))}
      </select>

      <select
        value={currentSort}
        onChange={(e) => update(sortKey, e.target.value)}
        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">A-Z</option>
        <option value="desc">Z-A</option>
      </select>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}
