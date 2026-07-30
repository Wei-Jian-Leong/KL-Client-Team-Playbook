"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAnnouncement,
  approveAnnouncementQuizQuestion,
  deleteAnnouncementQuizQuestion,
  updateAnnouncementQuizQuestion,
  deleteAnnouncement,
} from "@/app/actions/announcements";

type QuizQuestion = {
  id: string;
  question: string;
  type: string;
  options: string | null;
  correctAnswer: string | null;
  isDraft: boolean;
  order: number;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  createdBy: { name: string };
  quizzes: QuizQuestion[];
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type EditQuizState = {
  questionId: string;
  question: string;
  type: string;
  options: string[];
  correctAnswer: string;
  multiCorrect: string[];
};

function QuizEditForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: EditQuizState;
  onSave: (data: EditQuizState) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState(initial);

  function toggleMultiCorrect(opt: string) {
    setState(s => ({
      ...s,
      multiCorrect: s.multiCorrect.includes(opt)
        ? s.multiCorrect.filter(o => o !== opt)
        : [...s.multiCorrect, opt],
    }));
  }

  function updateOption(idx: number, val: string) {
    const opts = [...state.options];
    opts[idx] = val;
    setState(s => ({ ...s, options: opts }));
  }

  function handleSave() {
    onSave(state);
  }

  return (
    <div className="space-y-3 pt-1">
      <textarea
        value={state.question}
        onChange={e => setState(s => ({ ...s, question: e.target.value }))}
        rows={2}
        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        placeholder="Question text…"
      />
      <div className="flex gap-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
          <input type="radio" checked={state.type === "SELECT"} onChange={() => setState(s => ({ ...s, type: "SELECT", multiCorrect: [] }))} />
          Single choice
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
          <input type="radio" checked={state.type === "MULTI_SELECT"} onChange={() => setState(s => ({ ...s, type: "MULTI_SELECT", correctAnswer: "" }))} />
          Multi choice
        </label>
      </div>
      <div className="space-y-1">
        {state.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            {state.type === "SELECT" ? (
              <input type="radio" checked={state.correctAnswer === opt} onChange={() => setState(s => ({ ...s, correctAnswer: opt }))} />
            ) : (
              <input type="checkbox" checked={state.multiCorrect.includes(opt)} onChange={() => toggleMultiCorrect(opt)} />
            )}
            <input
              value={opt}
              onChange={e => updateOption(i, e.target.value)}
              className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            {state.options.length > 2 && (
              <button onClick={() => setState(s => ({ ...s, options: s.options.filter((_, idx) => idx !== i) }))} className="text-xs text-red-400 hover:text-red-600">✕</button>
            )}
          </div>
        ))}
        {state.options.length < 6 && (
          <button onClick={() => setState(s => ({ ...s, options: [...s.options, ""] }))} className="text-xs text-gray-400 hover:text-amber-600 mt-1">+ Add option</button>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors">Save</button>
        <button onClick={onCancel} className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

function AnnouncementCard({ announcement: a, isAdmin }: { announcement: Announcement; isAdmin: boolean }) {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>(a.quizzes);
  const [pending, startTransition] = useTransition();
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const draftCount = quizzes.filter(q => q.isDraft).length;
  const approvedQuizzes = quizzes.filter(q => !q.isDraft);

  function handleApprove(id: string) {
    startTransition(async () => {
      await approveAnnouncementQuizQuestion(id);
      setQuizzes(prev => prev.map(q => q.id === id ? { ...q, isDraft: false } : q));
    });
  }

  function handleDeleteQuiz(id: string) {
    startTransition(async () => {
      await deleteAnnouncementQuizQuestion(id);
      setQuizzes(prev => prev.filter(q => q.id !== id));
    });
  }

  function handleDeleteAnnouncement() {
    if (!confirm("Delete this announcement?")) return;
    startTransition(async () => {
      await deleteAnnouncement(a.id);
      router.refresh();
    });
  }

  function handleSaveQuizEdit(state: EditQuizState) {
    const options = JSON.stringify(state.options.filter(Boolean));
    const correctAnswer = state.type === "MULTI_SELECT"
      ? JSON.stringify(state.multiCorrect)
      : state.correctAnswer;
    startTransition(async () => {
      await updateAnnouncementQuizQuestion(state.questionId, {
        question: state.question,
        type: state.type,
        options,
        correctAnswer,
      });
      setQuizzes(prev => prev.map(q => q.id === state.questionId
        ? { ...q, question: state.question, type: state.type, options, correctAnswer }
        : q
      ));
      setEditingQuizId(null);
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-4 py-3.5"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{a.title}</p>
              {isAdmin && draftCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full font-medium">
                  {draftCount} draft quiz
                </span>
              )}
              {approvedQuizzes.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                  {approvedQuizzes.length}Q quiz
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {formatDate(a.createdAt)} · {a.createdBy.name}
            </p>
          </div>
          <svg className={`w-4 h-4 text-gray-400 shrink-0 mt-1 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-3">
          {/* Content */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300"
            dangerouslySetInnerHTML={{ __html: a.content }}
          />

          {/* Admin draft quiz panel */}
          {isAdmin && draftCount > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  AI Draft Quiz — {draftCount} question{draftCount !== 1 ? "s" : ""} pending review
                </p>
              </div>
              <div className="space-y-2">
                {quizzes.filter(q => q.isDraft).map(q => {
                  let parsedOptions: string[] = [];
                  try { parsedOptions = q.options ? JSON.parse(q.options) : []; } catch { parsedOptions = []; }
                  let correctArr: string[] = [];
                  try { correctArr = q.type === "MULTI_SELECT" && q.correctAnswer ? JSON.parse(q.correctAnswer) : []; } catch { correctArr = []; }

                  return (
                    <div key={q.id} className="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-700 p-3">
                      {editingQuizId === q.id ? (
                        <QuizEditForm
                          initial={{
                            questionId: q.id,
                            question: q.question,
                            type: q.type,
                            options: parsedOptions,
                            correctAnswer: q.type === "SELECT" ? (q.correctAnswer ?? "") : "",
                            multiCorrect: correctArr,
                          }}
                          onSave={handleSaveQuizEdit}
                          onCancel={() => setEditingQuizId(null)}
                        />
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 flex-1">{q.question}</p>
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full">
                              {q.type === "SELECT" ? "Single Choice" : "Multi Choice"}
                            </span>
                          </div>
                          {parsedOptions.length > 0 && (
                            <ul className="mb-2 space-y-0.5 pl-2">
                              {parsedOptions.map((opt, oi) => {
                                const isCorrect = q.type === "SELECT" ? opt === q.correctAnswer : correctArr.includes(opt);
                                return (
                                  <li key={oi} className={`text-xs flex items-center gap-1.5 ${isCorrect ? "text-green-700 dark:text-green-400 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
                                    <span>{isCorrect ? "✓" : "·"}</span>{opt}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={() => handleApprove(q.id)} disabled={pending}
                              className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-40">
                              ✓ Approve
                            </button>
                            <button onClick={() => setEditingQuizId(q.id)} disabled={pending}
                              className="text-xs px-3 py-1 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors disabled:opacity-40">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteQuiz(q.id)} disabled={pending}
                              className="text-xs px-3 py-1 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40">
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Approved quiz (all users) */}
          {approvedQuizzes.length > 0 && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-3">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
                Knowledge Check — {approvedQuizzes.length} question{approvedQuizzes.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-2">
                {approvedQuizzes.map(q => {
                  let parsedOptions: string[] = [];
                  try { parsedOptions = q.options ? JSON.parse(q.options) : []; } catch { parsedOptions = []; }
                  let correctArr: string[] = [];
                  try { correctArr = q.type === "MULTI_SELECT" && q.correctAnswer ? JSON.parse(q.correctAnswer) : []; } catch { correctArr = []; }
                  return (
                    <div key={q.id} className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 p-3">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-2">{q.question}</p>
                      <ul className="space-y-0.5 pl-1">
                        {parsedOptions.map((opt, oi) => {
                          const isCorrect = q.type === "SELECT" ? opt === q.correctAnswer : correctArr.includes(opt);
                          return (
                            <li key={oi} className={`text-xs flex items-center gap-1.5 ${isCorrect ? "text-green-700 dark:text-green-400 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
                              <span>{isCorrect ? "✓" : "·"}</span>{opt}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="flex justify-end pt-1">
              <button onClick={handleDeleteAnnouncement} disabled={pending}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnnouncementsView({
  announcements: initialAnnouncements,
  isAdmin,
}: {
  announcements: Announcement[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [announcements] = useState(initialAnnouncements);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    if (!title.trim() || !content.trim()) return;
    startTransition(async () => {
      const res = await createAnnouncement({ title, content });
      if (res.error) { alert(res.error); return; }
      setTitle("");
      setContent("");
      setCreating(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Updates</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{announcements.length} announcement{announcements.length !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors shadow-sm"
          >
            + New Update
          </button>
        )}
      </div>

      {/* Create form */}
      {isAdmin && creating && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">New Announcement</h3>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Announcement title…"
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              placeholder="Write the announcement…"
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            A draft quiz will be auto-generated and all COS members will receive a notification.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={pending || !title.trim() || !content.trim()}
              className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors disabled:opacity-50"
            >
              {pending ? "Publishing…" : "Publish"}
            </button>
            <button
              onClick={() => { setCreating(false); setTitle(""); setContent(""); }}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Announcement list */}
      {announcements.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">
          No announcements yet.
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <AnnouncementCard key={a.id} announcement={a} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
