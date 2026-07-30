"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  getGlossaryTerms,
  addGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  getTranslationMemories,
  getTalkTrackMemories,
  syncGlossaryToSheet,
  syncTranslationMemoryToSheet,
  syncTalkTrackMemoryToSheet,
  getGlossarySheetConfigured,
} from "@/app/actions/knowledge";

type GlossaryTerm = { id: string; termEn: string; termZh: string; note: string | null };
type Memory = {
  id: string;
  publishedAt: Date;
  aiTitleZh: string;
  pubTitleZh: string;
  article: { title: string; articleNo: number | null };
};
type TalkTrackMemoryEntry = {
  id: string;
  language: string;
  aiDraft: string;
  savedContent: string;
  savedAt: Date;
};

export default function TranslationGlossaryPanel({ onClose }: { onClose: () => void }) {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [talkTrackMemories, setTalkTrackMemories] = useState<TalkTrackMemoryEntry[]>([]);
  const [tab, setTab] = useState<"glossary" | "memory" | "trackMemory">("glossary");
  const [isPending, startTransition] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [editEn, setEditEn] = useState("");
  const [editZh, setEditZh] = useState("");
  const [editNote, setEditNote] = useState("");
  const [newEn, setNewEn] = useState("");
  const [newZh, setNewZh] = useState("");
  const [newNote, setNewNote] = useState("");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const [syncMsg, setSyncMsg] = useState("");
  const [memorySyncStatus, setMemorySyncStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const [memorySyncMsg, setMemorySyncMsg] = useState("");
  const [trackMemSyncStatus, setTrackMemSyncStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const [trackMemSyncMsg, setTrackMemSyncMsg] = useState("");
  const [sheetConfigured, setSheetConfigured] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startTransition(async () => {
      const [g, m, tt, configured] = await Promise.all([
        getGlossaryTerms(),
        getTranslationMemories(10),
        getTalkTrackMemories(20),
        getGlossarySheetConfigured(),
      ]);
      setTerms(g);
      setMemories(m as Memory[]);
      setTalkTrackMemories(tt as TalkTrackMemoryEntry[]);
      setSheetConfigured(configured);
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function startEdit(t: GlossaryTerm) {
    setEditId(t.id); setEditEn(t.termEn); setEditZh(t.termZh); setEditNote(t.note ?? "");
  }

  function handleAdd() {
    if (!newEn.trim() || !newZh.trim()) { setError("Both EN and CN fields are required."); return; }
    setError("");
    startTransition(async () => {
      try {
        await addGlossaryTerm(newEn, newZh, newNote || undefined);
        const g = await getGlossaryTerms();
        setTerms(g); setNewEn(""); setNewZh(""); setNewNote("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add term.");
      }
    });
  }

  function handleUpdate() {
    if (!editId || !editEn.trim() || !editZh.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        await updateGlossaryTerm(editId, editEn, editZh, editNote || undefined);
        const g = await getGlossaryTerms();
        setTerms(g); setEditId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update term.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteGlossaryTerm(id);
      setTerms(prev => prev.filter(t => t.id !== id));
      if (editId === id) setEditId(null);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" onClick={onClose} />
      <div ref={panelRef} className="relative z-10 w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Translation Settings</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Glossary overrides and AI learning history</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
          {(["glossary", "memory", "trackMemory"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 text-xs font-medium py-2.5 border-b-2 transition-colors ${tab === t ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
              {t === "glossary" ? "Glossary" : t === "memory" ? "CN Memory" : "Talk Track Memory"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* GLOSSARY TAB */}
          {tab === "glossary" && (
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Define fixed term overrides. These are injected into every AI translation prompt. Use comma-separated EN variants (e.g. <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">client,clients</code>).
              </p>

              {/* Add form */}
              {/* Google Sheets sync */}
            <div className="flex items-center justify-between">
              {sheetConfigured ? (
                <button
                  onClick={async () => {
                    setSyncStatus("syncing"); setSyncMsg("");
                    const res = await syncGlossaryToSheet();
                    if (res.ok) {
                      setSyncStatus("ok");
                      setSyncMsg(res.url ?? "");
                    } else {
                      setSyncStatus("error");
                      setSyncMsg(res.error ?? "Unknown error");
                    }
                  }}
                  disabled={syncStatus === "syncing" || isPending}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 font-medium transition-colors disabled:opacity-50"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  {syncStatus === "syncing" ? "Syncing…" : "Backup to Google Sheet"}
                </button>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  Google Sheets backup not configured. Add <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">GOOGLE_CLIENT_EMAIL</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">GOOGLE_PRIVATE_KEY</code>, and <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">GLOSSARY_SHEET_ID</code> to .env to enable.
                </p>
              )}
              {syncStatus === "ok" && syncMsg && (
                <a href={syncMsg} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-green-600 dark:text-green-400 underline">
                  View sheet ↗
                </a>
              )}
            </div>
            {syncStatus === "error" && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{syncMsg}</p>
            )}
            {syncStatus === "ok" && (
              <p className="text-xs text-green-600 dark:text-green-400">✓ Synced to Google Sheet successfully.</p>
            )}

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Add term override</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 block">English (variants)</label>
                    <input value={newEn} onChange={e => setNewEn(e.target.value)}
                      placeholder="client,clients"
                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 block">Chinese override</label>
                    <input value={newZh} onChange={e => setNewZh(e.target.value)}
                      placeholder="老板"
                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-chinese" />
                  </div>
                </div>
                <input value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="Optional note (e.g. context for when to use)"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button onClick={handleAdd} disabled={isPending}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors disabled:opacity-50">
                  Add term
                </button>
              </div>

              {/* Terms table */}
              {isPending && !terms.length ? (
                <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
              ) : terms.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No glossary terms yet. Add one above.</p>
              ) : (
                <div className="space-y-2">
                  {terms.map(t => (
                    <div key={t.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      {editId === t.id ? (
                        <div className="p-3 space-y-2 bg-indigo-50 dark:bg-indigo-900/10">
                          <div className="flex gap-2">
                            <input value={editEn} onChange={e => setEditEn(e.target.value)}
                              className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <input value={editZh} onChange={e => setEditZh(e.target.value)}
                              className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                          <input value={editNote} onChange={e => setEditNote(e.target.value)}
                            placeholder="Note (optional)"
                            className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          <div className="flex gap-2">
                            <button onClick={handleUpdate} disabled={isPending}
                              className="text-xs px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">Save</button>
                            <button onClick={() => setEditId(null)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center px-3 py-2.5 gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.termEn}</span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{t.termZh}</span>
                            </div>
                            {t.note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{t.note}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => startEdit(t)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={() => handleDelete(t.id)} disabled={isPending}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MEMORY TAB */}
          {tab === "memory" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex-1 mr-4">
                  Each time an admin publishes a CN translation, the original AI draft vs the approved version is saved here. These examples are automatically fed back into future translations to improve quality.
                </p>
                {sheetConfigured && (
                  <button
                    onClick={async () => {
                      setMemorySyncStatus("syncing"); setMemorySyncMsg("");
                      const res = await syncTranslationMemoryToSheet();
                      if (res.ok) { setMemorySyncStatus("ok"); setMemorySyncMsg(res.url ?? ""); }
                      else { setMemorySyncStatus("error"); setMemorySyncMsg(res.error ?? "Unknown error"); }
                    }}
                    disabled={memorySyncStatus === "syncing" || isPending}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 font-medium transition-colors disabled:opacity-50"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    {memorySyncStatus === "syncing" ? "Syncing…" : "Backup to Sheet"}
                  </button>
                )}
              </div>
              {memorySyncStatus === "ok" && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
                  ✓ Synced to Google Sheet.
                  {memorySyncMsg && <a href={memorySyncMsg} target="_blank" rel="noopener noreferrer" className="underline">View sheet ↗</a>}
                </p>
              )}
              {memorySyncStatus === "error" && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{memorySyncMsg}</p>
              )}
              {isPending && !memories.length ? (
                <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
              ) : memories.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No correction history yet. Publish a CN translation to start learning.</p>
              ) : (
                <div className="space-y-3">
                  {memories.map(m => {
                    const same = m.aiTitleZh === m.pubTitleZh;
                    return (
                      <div key={m.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                            {m.article.articleNo ? `#${m.article.articleNo} ` : ""}{m.article.title}
                          </span>
                          <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                            {new Date(m.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <div className="px-3 py-2.5 space-y-2">
                          {same ? (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              AI translation accepted without changes
                            </p>
                          ) : (
                            <>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">AI draft</p>
                                <p className="text-xs text-gray-600 dark:text-gray-300">{m.aiTitleZh}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-0.5">Human-approved</p>
                                <p className="text-xs text-gray-900 dark:text-white font-medium">{m.pubTitleZh}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* TALK TRACK MEMORY TAB */}
          {tab === "trackMemory" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex-1">
                  When an admin edits an AI-generated talk track draft, the original AI version vs the saved version is stored here. These correction pairs are fed back into future AI draft generation to improve quality.
                </p>
                {sheetConfigured && (
                  <button
                    onClick={async () => {
                      setTrackMemSyncStatus("syncing"); setTrackMemSyncMsg("");
                      const res = await syncTalkTrackMemoryToSheet();
                      if (res.ok) { setTrackMemSyncStatus("ok"); setTrackMemSyncMsg(res.url ?? ""); }
                      else { setTrackMemSyncStatus("error"); setTrackMemSyncMsg(res.error ?? "Unknown error"); }
                    }}
                    disabled={trackMemSyncStatus === "syncing" || isPending}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 font-medium transition-colors disabled:opacity-50"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    {trackMemSyncStatus === "syncing" ? "Syncing…" : "Backup to Sheet"}
                  </button>
                )}
              </div>
              {trackMemSyncStatus === "ok" && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
                  ✓ Synced to Google Sheet.
                  {trackMemSyncMsg && <a href={trackMemSyncMsg} target="_blank" rel="noopener noreferrer" className="underline">View sheet ↗</a>}
                </p>
              )}
              {trackMemSyncStatus === "error" && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{trackMemSyncMsg}</p>
              )}
              {isPending && !talkTrackMemories.length ? (
                <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
              ) : talkTrackMemories.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No corrections recorded yet. Generate an AI talk track draft, edit it, and save to start learning.</p>
              ) : (
                <div className="space-y-3">
                  {talkTrackMemories.map(m => {
                    const same = m.aiDraft === m.savedContent;
                    return (
                      <div key={m.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${m.language === "CN" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"}`}>{m.language}</span>
                          <span className="text-[10px] text-gray-400 ml-2">
                            {new Date(m.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <div className="px-3 py-2.5 space-y-2">
                          {same ? (
                            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              AI draft accepted without changes
                            </p>
                          ) : (
                            <>
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">AI draft</p>
                                <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap line-clamp-3">{m.aiDraft}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-teal-500 uppercase tracking-wide mb-0.5">Trainer preferred</p>
                                <p className="text-xs text-gray-900 dark:text-white font-medium whitespace-pre-wrap line-clamp-3">{m.savedContent}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
