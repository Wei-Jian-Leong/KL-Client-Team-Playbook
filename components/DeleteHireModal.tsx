"use client";

import { useState, useTransition } from "react";
import { deleteNewHire } from "@/app/actions/newhire";

interface Props {
  newHireId: string;
  hireName: string;
}

export default function DeleteHireModal({ newHireId, hireName }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  function handleDelete() {
    if (!reason.trim()) {
      setError("Please provide a reason for deletion.");
      return;
    }
    const fd = new FormData();
    fd.set("newHireId", newHireId);
    fd.set("reason", reason);
    startTransition(async () => {
      const res = await deleteNewHire(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Remove New Hire</h2>
            <p className="text-sm text-gray-500 mb-4">
              You are about to cancel onboarding for <strong>{hireName}</strong>. All teams will be notified.
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for deletion <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(""); }}
              rows={3}
              placeholder="e.g. Candidate withdrew offer, Position cancelled..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-2"
            />
            {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setOpen(false); setReason(""); setError(""); }}
                className="text-gray-600 hover:text-gray-800 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
