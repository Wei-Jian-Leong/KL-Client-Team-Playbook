"use client";

import { useState } from "react";
import { addComment } from "@/app/actions/newhire";
import { SessionUser } from "@/lib/session";

type Comment = {
  id: string;
  content: string;
  createdAt: Date;
  author: { name: string; team: string };
};

export default function CommentSection({
  newHireId,
  hireName,
  comments,
  session,
}: {
  newHireId: string;
  hireName?: string;
  comments: Comment[];
  session: SessionUser;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append("content", text);
    fd.append("newHireId", newHireId);
    if (hireName) fd.append("hireName", hireName);
    await addComment(fd);
    setText("");
    setSubmitting(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
      {/* Comment input */}
      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a general comment or update..."
          rows={3}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="self-end text-xs bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>

      {/* Comments list */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No comments yet.</p>
        ) : (
          [...comments].reverse().map((c) => (
            <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-800">{c.author.name}</span>
                <span className="text-xs text-gray-300 ml-auto">
                  {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
