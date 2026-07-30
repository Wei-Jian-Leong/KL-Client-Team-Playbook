"use client";

import { useState, useTransition } from "react";
import { updatePosId } from "@/app/actions/newhire";

interface Props {
  newHireId: string;
  currentPosId: string | null;
}

export default function EditPosId({ newHireId, currentPosId }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentPosId ?? "");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  function handleSave() {
    const fd = new FormData();
    fd.set("newHireId", newHireId);
    fd.set("posId", value);
    startTransition(async () => {
      const res = await updatePosId(fd);
      if (res?.error) setError(res.error);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-3 py-1.5 rounded-lg">
        <span>🟢</span>
        <span className="text-gray-400 dark:text-gray-500">POS ID:</span>
        <span className="font-medium">{currentPosId || "—"}</span>
        <button
          onClick={() => setEditing(true)}
          className="ml-1 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          title="Edit POS ID"
        >
          ✏️
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-xs px-3 py-1.5 rounded-lg">
      <span>🟢</span>
      <span className="text-gray-400 dark:text-gray-500">POS ID:</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        placeholder="Enter POS ID"
        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-xs bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32"
      />
      <button
        onClick={handleSave}
        className="text-green-600 hover:text-green-800 dark:text-green-400 font-medium"
      >
        Save
      </button>
      <button
        onClick={() => { setEditing(false); setValue(currentPosId ?? ""); setError(""); }}
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
      >
        ✕
      </button>
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
