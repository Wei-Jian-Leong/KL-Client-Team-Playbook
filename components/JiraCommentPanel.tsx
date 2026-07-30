"use client";

import { useState, useTransition } from "react";
import { postJiraComment } from "@/app/actions/newhire";

type JiraComment = { author: string; body: string; created: string };

export default function JiraCommentPanel({
  newHireId,
  jiraTicketId,
  initialComments,
  canComment,
}: {
  newHireId: string;
  jiraTicketId: string;
  initialComments: JiraComment[];
  canComment: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<JiraComment[]>(initialComments);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!text.trim()) return;
    setError("");
    startTransition(async () => {
      const res = await postJiraComment(newHireId, text.trim());
      if (res.error) {
        setError(res.error);
      } else {
        setComments((prev) => [
          ...prev,
          { author: "You", body: text.trim(), created: new Date().toISOString() },
        ]);
        setText("");
      }
    });
  }

  return (
    <div className="text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
      >
        <span>💬</span>
        IT Ticket Comments ({comments.length})
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {comments.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-3">No comments yet on {jiraTicketId}.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {comments.map((c, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.author}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(c.created).toLocaleString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
          )}

          {canComment && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment to the Jira ticket..."
                rows={3}
                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSubmit}
                  disabled={isPending || !text.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending ? "Posting…" : "Post Comment"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
