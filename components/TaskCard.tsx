"use client";

import { useState } from "react";
import { updateTaskStatus, addComment } from "@/app/actions/newhire";
import { renameTask } from "@/app/actions/admin";
import { getTeamLabel } from "@/lib/training";
import { SessionUser } from "@/lib/session";

type Comment = {
  id: string;
  content: string;
  createdAt: Date;
  author: { name: string; team: string };
};

type HistoryEntry = {
  id: string;
  userName: string;
  fromStatus: string | null;
  toStatus: string;
  createdAt: Date;
};

type Task = {
  id: string;
  team: string;
  title: string;
  status: string;
  completedAt: Date | null;
  completedBy: { name: string } | null;
  comments: Comment[];
  history: HistoryEntry[];
};

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  PENDING:     { label: "Pending",     color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",    dot: "bg-gray-400" },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", dot: "bg-blue-500" },
  COMPLETED:   { label: "Completed",   color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", dot: "bg-green-500" },
};

const statusIcon: Record<string, string> = {
  PENDING: "○",
  IN_PROGRESS: "⏳",
  COMPLETED: "✓",
};

const teamColors: Record<string, string> = {
  IT:           "border-l-purple-400",
  RTA:          "border-l-cyan-400",
  HR:           "border-l-pink-400",
  GD_TRAINING:  "border-l-blue-400",
  COS_TRAINING: "border-l-indigo-400",
  MENU_TRAINING:"border-l-orange-400",
};

export default function TaskCard({
  task,
  newHireId,
  session,
  isAdmin = false,
}: {
  task: Task;
  newHireId: string;
  session: SessionUser;
  isAdmin?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(task.title);

  const isMyTask = session.team === task.team || session.team === "ADMIN" || isAdmin;
  const config = statusConfig[task.status] ?? statusConfig.PENDING;

  async function handleRename() {
    if (!newTitle.trim() || newTitle === task.title) { setRenaming(false); return; }
    const fd = new FormData();
    fd.set("taskId", task.id);
    fd.set("title", newTitle);
    fd.set("newHireId", newHireId);
    await renameTask(fd);
    setRenaming(false);
  }

  async function handleStatusChange(status: string) {
    const fd = new FormData();
    fd.append("taskId", task.id);
    fd.append("status", status);
    fd.append("newHireId", newHireId);
    await updateTaskStatus(fd);
  }

  async function handleComment() {
    if (!comment.trim()) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append("content", comment);
    fd.append("newHireId", newHireId);
    fd.append("taskId", task.id);
    await addComment(fd);
    setComment("");
    setCommenting(false);
    setSubmitting(false);
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 ${teamColors[task.team] || "border-l-gray-300"} overflow-hidden shadow-sm`}>
      {/* Header row */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`} />
          <div className="min-w-0">
            {renaming ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
                  className="text-sm border border-indigo-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                  autoFocus
                />
                <button onClick={handleRename} className="text-xs text-green-600 dark:text-green-400 font-medium">Save</button>
                <button onClick={() => setRenaming(false)} className="text-xs text-gray-400">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</p>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenaming(true); setNewTitle(task.title); }}
                    className="text-xs text-gray-300 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400 shrink-0"
                    title="Rename task"
                  >
                    ✏
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">{getTeamLabel(task.team)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {task.history.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{task.history.length} update{task.history.length > 1 ? "s" : ""}</span>
          )}
          {task.comments.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{task.comments.length} comment{task.comments.length > 1 ? "s" : ""}</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
            {config.label}
          </span>
          <span className="text-gray-400 dark:text-gray-500 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4">
          {/* Status actions */}
          {isMyTask && task.status !== "COMPLETED" && (
            <div className="flex gap-2 mt-3">
              {task.status === "PENDING" && (
                <button
                  onClick={() => handleStatusChange("IN_PROGRESS")}
                  className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                >
                  ⏳ Mark In Progress
                </button>
              )}
              {(task.status === "PENDING" || task.status === "IN_PROGRESS") && (
                <button
                  onClick={() => handleStatusChange("COMPLETED")}
                  className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 px-3 py-1.5 rounded-lg transition-colors border border-green-200 dark:border-green-800"
                >
                  ✓ Mark Complete
                </button>
              )}
            </div>
          )}

          {/* Change History */}
          {task.history.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
              >
                <span>🕐</span> {showHistory ? "Hide" : "Show"} change history ({task.history.length})
              </button>
              {showHistory && (
                <div className="mt-2 space-y-1 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
                  {task.history.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{h.userName}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">changed</span>
                        {h.fromStatus && (
                          <>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                              {statusIcon[h.fromStatus]} {statusConfig[h.fromStatus]?.label ?? h.fromStatus}
                            </span>
                            <span className="text-xs text-gray-400">→</span>
                          </>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusConfig[h.toStatus]?.color ?? ""}`}>
                          {statusIcon[h.toStatus]} {statusConfig[h.toStatus]?.label ?? h.toStatus}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          · {new Date(h.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          {task.comments.length > 0 && (
            <div className="space-y-2 mt-3">
              {task.comments.map((c) => (
                <div key={c.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{c.author.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{getTeamLabel(c.author.team)}</span>
                    <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{c.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          {!commenting ? (
            <button
              onClick={() => setCommenting(true)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mt-3 block transition-colors"
            >
              + Add comment
            </button>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400"
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
              />
              <button
                onClick={handleComment}
                disabled={submitting}
                className="text-xs bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Post
              </button>
              <button
                onClick={() => { setCommenting(false); setComment(""); }}
                className="text-xs text-gray-500 dark:text-gray-400 px-2 py-2 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
