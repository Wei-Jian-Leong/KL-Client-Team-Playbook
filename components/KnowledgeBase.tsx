"use client";

import { useState, useMemo, useRef, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { updateKnowledgeArticle, deleteKnowledgeFile, createKnowledgeArticle, approveKnowledgeQuizQuestion, deleteKnowledgeQuizQuestion, updateKnowledgeQuizQuestion, submitQuizAttempt, getQuizCompletionList, publishKnowledgeArticle, triggerKnowledgeQuizDraft, addKnowledgeQuizQuestion, markArticleRead, addArticleFAQ, updateArticleFAQ, deleteArticleFAQ, publishZhTranslation, updateZhTranslation, updatePublishedZhTranslation, retranslateArticle, addTalkTrack, updateTalkTrack, deleteTalkTrack, generateTalkTrack, getTalkTrackMemories, checkTermSubstitutions, addGlossaryTerm } from "@/app/actions/knowledge";
import TranslationGlossaryPanel from "@/components/TranslationGlossaryPanel";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Mark, Node as TiptapNode, Editor, InputRule, markInputRule } from "@tiptap/core";

type SlackFile = { id: string; name: string; mimeType: string };

type FAQ = { id: string; question: string; answer: string; order: number };
type TalkTrack = { id: string; content: string; aiDraft: string | null; language: string; order: number };

type QuizQuestion = {
  id: string;
  question: string;
  type: string;
  options: string | null;
  correctAnswer: string | null;
  gradingType: string;
  isDraft: boolean;
  order: number;
};

type Article = {
  id: string;
  articleNo: number | null;
  category: string;
  title: string;
  date: string;
  slackLink: string | null;
  altLink: string | null;
  isArchived: boolean;
  isDraft: boolean;
  content: string | null;
  files: string | null;
  titleZh: string | null;
  contentZh: string | null;
  zhDraft: boolean;
  updatedAt: Date | null;
  updateHistory: string | null;
  changeNotes: string | null;
  changeNotesZh: string | null;
  quizQuestions: QuizQuestion[];
  faqs: FAQ[];
  talkTracks: TalkTrack[];
};

const ALL_CATS = ["ALL", "GD", "COS", "CMA", "DE"];
const CAT_LABEL: Record<string, string> = { DE: "Tarro Delivery" };

type CompletionAttempt = {
  id: string;
  score: number;
  total: number;
  completedAt: Date;
  user: { id: string; name: string; position: string | null };
  article: { id: string; title: string; articleNo: number | null };
};

function toPlainText(content: string): string {
  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/:[a-z0-9_+-]+:/g, "")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~([^~]+)~/g, "$1")
    .replace(/`[^`]+`/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function CompletionList({ articles }: { articles: Article[] }) {
  const [attempts, setAttempts] = useState<CompletionAttempt[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [exportArticleId, setExportArticleId] = useState("");

  const COS_POSITIONS: Record<string, string> = { USER: "User", SUPPORT: "Support", ADMIN: "Admin" };

  // Articles that have at least one approved quiz question
  const quizArticles = articles.filter(a => a.quizQuestions.some(q => !q.isDraft));

  useEffect(() => {
    getQuizCompletionList().then(res => {
      if ("attempts" in res) setAttempts(res.attempts as CompletionAttempt[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!attempts) return [];
    let list = attempts;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(a =>
        a.user.name.toLowerCase().includes(q) ||
        a.article.title.toLowerCase().includes(q)
      );
    }
    if (posFilter !== "ALL") {
      list = list.filter(a => a.user.position === posFilter);
    }
    return list;
  }, [attempts, filter, posFilter]);

  if (loading) return <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-12">Loading…</p>;
  if (!attempts) return <p className="text-sm text-red-500 text-center py-12">Failed to load.</p>;

  const uniqueUsers = new Set(attempts.map(a => a.user.id)).size;

  return (
    <div className="space-y-4">
      {/* Export quiz report section */}
      {quizArticles.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">Export quiz report:</span>
          <select
            value={exportArticleId}
            onChange={e => setExportArticleId(e.target.value)}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 min-w-0"
          >
            <option value="">Select article…</option>
            {quizArticles.map(a => (
              <option key={a.id} value={a.id}>
                {a.articleNo ? `#${String(a.articleNo).padStart(3, "0")} ` : ""}{a.title}
              </option>
            ))}
          </select>
          {exportArticleId ? (
            <a
              href={`/api/knowledge/non-completers?articleId=${exportArticleId}`}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
            >
              Download ↓
            </a>
          ) : (
            <span className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed">Download ↓</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search by name or article…"
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 min-w-[180px]"
        />
        <select
          value={posFilter}
          onChange={e => setPosFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">All positions</option>
          {Object.entries(COS_POSITIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{uniqueUsers} user{uniqueUsers !== 1 ? "s" : ""} · {attempts.length} attempt{attempts.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-12">No completions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Position</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Article</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Score</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 font-medium">{a.user.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                    {a.user.position ? (COS_POSITIONS[a.user.position] ?? a.user.position) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 max-w-[220px] truncate">
                    {a.article.articleNo ? <span className="font-mono text-gray-400 mr-1">#{String(a.article.articleNo).padStart(3, "0")}</span> : null}
                    {a.article.title}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.score === a.total ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`}>
                      {a.score}/{a.total}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 dark:text-gray-500 text-xs">
                    {new Date(a.completedAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export type UserAttempt = { articleId: string; score: number; total: number; completedAt: Date };
export type { Article };

export default function KnowledgeBase({ articles, isAdmin, userAttempts = [], userReads = [] }: { articles: Article[]; isAdmin: boolean; userAttempts?: UserAttempt[]; userReads?: string[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"number" | "date">("number");
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [activeTab, setActiveTab] = useState<"articles" | "completions">("articles");

  // View mode — default to "list" on server; sync from localStorage after mount to avoid hydration mismatch
  const [view, setView] = useState<"list" | "card" | "table">("list");
  const [density, setDensity] = useState<"3" | "5">("3");
  useEffect(() => {
    const v = localStorage.getItem("kb-view") as "list" | "card" | "table" | null;
    if (v) setView(v);
    const d = localStorage.getItem("kb-card-density") as "3" | "5" | null;
    if (d) setDensity(d);
  }, []);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const openArticle = openArticleId ? articles.find(a => a.id === openArticleId) ?? null : null;

  // On load: if URL has #article-NNN hash, open that article in the modal
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#article-")) return;
    const no = parseInt(hash.replace("#article-", ""), 10);
    const match = articles.find(a => a.articleNo === no);
    if (match) setOpenArticleId(match.id);
  }, []);

  // Sync URL hash and body scroll with modal state
  useEffect(() => {
    if (openArticleId) {
      const article = articles.find(a => a.id === openArticleId);
      if (article?.articleNo) {
        const noStr = String(article.articleNo).padStart(3, "0");
        window.history.replaceState(null, "", `/knowledge#article-${noStr}`);
      }
      document.body.style.overflow = "hidden";
    } else {
      window.history.replaceState(null, "", "/knowledge");
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [openArticleId, articles]);

  function setViewPersisted(v: "list" | "card" | "table") {
    localStorage.setItem("kb-view", v);
    setView(v);
  }
  function setDensityPersisted(d: "3" | "5") {
    localStorage.setItem("kb-card-density", d);
    setDensity(d);
  }

  // AI search state
  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ answer: string; articleIds: string[] } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [openedArticleId, setOpenedArticleId] = useState<string | null>(null);

  async function runAiSearch() {
    const q = aiQuery.trim();
    if (!q) return;
    setAiLoading(true);
    setAiResult(null);
    setAiError(null);
    try {
      const res = await fetch(`/api/knowledge/ai-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setAiResult(data);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI search failed");
    } finally {
      setAiLoading(false);
    }
  }

  function exitAiMode() {
    setAiMode(false);
    setAiQuery("");
    setAiResult(null);
    setAiError(null);
  }

  // Unread modal — count published articles not yet read (tracked in DB via userReads)
  const unreadCount = isAdmin ? 0 : articles.filter(a => !a.isDraft && !a.isArchived && !userReads.includes(a.id)).length;
  const [showUnreadModal, setShowUnreadModal] = useState(false);
  useEffect(() => {
    if (!isAdmin && unreadCount > 0) setShowUnreadModal(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function dismissUnread() {
    setShowUnreadModal(false);
  }

  const fuse = useMemo(
    () =>
      new Fuse(articles, {
        keys: [
          { name: "title",    weight: 3 },
          { name: "category", weight: 1 },
          { name: "content",  weight: 1 },
        ],
        threshold: 0.3,
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [articles]
  );

  const results = useMemo(() => {
    // When AI result is active, filter to AI-selected articles
    if (aiResult && aiResult.articleIds.length > 0) {
      const ids = new Set(aiResult.articleIds);
      return articles.filter(a => ids.has(a.id));
    }

    const q = query.trim();
    let list: Article[];

    if (!q) {
      list = [...articles];
    } else {
      // Fuse fuzzy search across title + content
      const fuseHits = new Set(fuse.search(q).map((r) => r.item.id));

      // Keyword fallback: split query into words ≥3 chars and match any word
      // against title/content substring (case-insensitive)
      const stopWords = new Set(["how", "to", "set", "up", "the", "a", "an", "in", "for", "of", "and", "or", "is", "are", "can", "do", "we", "i", "new", "update", "check", "checking"]);
      const words = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w));
      const keywordHits = words.length > 0
        ? articles.filter((a) => {
            const haystack = `${a.title} ${a.content ?? ""}`.toLowerCase();
            return words.every((w) => haystack.includes(w));
          })
        : [];

      // Merge: fuse results first (scored), then any keyword-only hits appended
      const merged = fuse.search(q).map((r) => r.item);
      for (const a of keywordHits) {
        if (!fuseHits.has(a.id)) merged.push(a);
      }
      list = merged;
    }

    if (category !== "ALL") list = list.filter((a) => a.category === category);
    if (unreadOnly) list = list.filter((a) => !userReads.includes(a.id) && !a.isDraft && !a.isArchived);

    if (sortBy === "date") {
      list = [...list].sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : new Date(a.date).getTime();
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : new Date(b.date).getTime();
        return tb - ta;
      });
    }

    return list;
  }, [query, category, unreadOnly, sortBy, articles, fuse, userReads]);

  const noMatch = query.trim().length > 0 && results.length === 0;

  return (
    <div className="space-y-0">
      {/* Unread articles modal */}
      {showUnreadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center border border-gray-200 dark:border-gray-700">
            <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">New articles available</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
              You have <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-lg">{unreadCount}</span> unread article{unreadCount !== 1 ? "s" : ""} in the Knowledge Base.
            </p>
            <button
              onClick={dismissUnread}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Tab bar (admin only) */}
      {isAdmin && (
        <div className="flex gap-1 mb-5 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("articles")}
            className={`text-sm px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${activeTab === "articles" ? "border-indigo-600 text-indigo-700 dark:text-indigo-300" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            Articles
          </button>
          <button
            onClick={() => setActiveTab("completions")}
            className={`text-sm px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${activeTab === "completions" ? "border-indigo-600 text-indigo-700 dark:text-indigo-300" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            Quiz Completions
          </button>
        </div>
      )}

      {isAdmin && activeTab === "completions" && <CompletionList articles={articles} />}

      <div style={{ display: activeTab === "articles" ? undefined : "none" }}>
      {/* Sticky search + filter bar */}
      <div className="-mx-6 px-6 pt-3 pb-2.5 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 mb-5 flex flex-col gap-2">

        {/* Row 1 — search + view controls */}
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative shrink-0 w-56">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs transition-colors">✕</button>
            )}
          </div>

          <div className="flex-1" />

          {/* Language toggle */}
          <div className="flex items-center">
            <button
              onClick={() => setLang("en")}
              className={`text-xs px-2.5 py-1 rounded-l-lg border font-medium transition-all ${lang === "en" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600"}`}
            >EN</button>
            <button
              onClick={() => setLang("zh")}
              className={`text-xs px-2.5 py-1 rounded-r-lg border-t border-b border-r font-medium transition-all ${lang === "zh" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600"}`}
            >中文</button>
          </div>

          {/* Glossary (admin only) */}
          {isAdmin && (
            <button
              onClick={() => setShowGlossary(true)}
              title="Translation glossary & memory"
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          )}

          {/* View switcher */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setViewPersisted("list")} title="List view"
              className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor" opacity=".8"/><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" opacity=".8"/><rect x="1" y="12" width="14" height="2" rx="1" fill="currentColor" opacity=".8"/></svg>
            </button>
            <button onClick={() => setViewPersisted("card")} title="Card view"
              className={`p-1.5 rounded-md transition-colors ${view === "card" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".8"/></svg>
            </button>
            <button onClick={() => setViewPersisted("table")} title="Table view"
              className={`p-1.5 rounded-md transition-colors ${view === "table" ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="3" rx="1" fill="currentColor" opacity=".8"/><rect x="1" y="6" width="14" height="2" rx="1" fill="currentColor" opacity=".4"/><rect x="1" y="10" width="14" height="2" rx="1" fill="currentColor" opacity=".4"/><rect x="1" y="14" width="14" height="1" rx=".5" fill="currentColor" opacity=".2"/></svg>
            </button>
          </div>

          {/* Admin New button */}
          {isAdmin && (
            <button onClick={() => setShowNewArticle(true)}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New
            </button>
          )}
        </div>

        {/* Row 2 — filter pills + display options */}
        <div className="flex items-center gap-2">
          {/* Category + Unread pills — scrollable */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {ALL_CATS.map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setUnreadOnly(false); }}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all shrink-0 ${
                  category === cat && !unreadOnly
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600"
                }`}
              >
                {CAT_LABEL[cat] ?? cat}
              </button>
            ))}
            {!isAdmin && unreadCount > 0 && (
              <button
                onClick={() => { setUnreadOnly(v => !v); setCategory("ALL"); }}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all shrink-0 flex items-center gap-1 ${
                  unreadOnly
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 hover:border-blue-500"
                }`}
              >
                Unread
                <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${unreadOnly ? "bg-white/30" : "bg-blue-100 dark:bg-blue-900/40"}`}>
                  {unreadCount}
                </span>
              </button>
            )}
          </div>

          {/* Display options — density, sort, count */}
          <div className="flex items-center gap-2 shrink-0">
            {view === "card" && (
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
                {(["3", "5"] as const).map(d => (
                  <button key={d} onClick={() => setDensityPersisted(d)} title={d === "3" ? "Spacious (3 per row)" : "Compact (5 per row)"}
                    className={`text-xs px-2 py-1 rounded-md font-semibold transition-colors ${density === d ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                    {d}×
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setSortBy(s => s === "number" ? "date" : "number")}
              title={sortBy === "date" ? "Sorted by date — click for default" : "Sort by date"}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border font-medium transition-all ${sortBy === "date" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600"}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M7 12h10M11 18h2"/>
              </svg>
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {query.trim() || category !== "ALL"
                ? `${results.length} result${results.length !== 1 ? "s" : ""}`
                : `${articles.length} articles`}
            </span>
          </div>
        </div>

      </div>

      {showNewArticle && <NewArticleModal onClose={() => setShowNewArticle(false)} onViewArticle={(id) => setOpenArticleId(id)} />}
      {showGlossary && <TranslationGlossaryPanel onClose={() => setShowGlossary(false)} />}

      {/* No results */}
      {noMatch && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-xs mt-1">Try different keywords or browse by category</p>
        </div>
      )}

      {/* Active articles */}
      {results.length > 0 && (() => {
        const gridClass = density === "5"
          ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

        if (view === "list") {
          return (
            <div className="space-y-2">
              {results.map((a) => (
                <ArticleCard key={a.id} article={a} isAdmin={isAdmin} userAttempts={userAttempts} userReads={userReads} autoOpen={a.id === openedArticleId} lang={lang} onOpenModal={() => setOpenArticleId(a.id)} onViewArticle={(id) => setOpenArticleId(id)} />
              ))}
            </div>
          );
        }

        if (view === "card") {
          return (
            <div className={gridClass}>
              {results.map((a) => {
                const badge = CAT_BADGE[a.category] ?? CAT_BADGE.GD;
                const accent = CAT_ACCENT[a.category] ?? CAT_ACCENT.GD;
                const noStr = a.articleNo ? String(a.articleNo).padStart(3, "0") : null;
                const isRead = userReads.includes(a.id);
                const showZh = lang === "zh" && !!a.titleZh && (!a.zhDraft || isAdmin);
                return (
                  <div key={a.id} className={`relative bg-white dark:bg-gray-900 rounded-xl border-l-4 border border-gray-200 dark:border-gray-700 ${accent} hover:shadow-md transition-shadow`}>
                    <button onClick={() => setOpenArticleId(a.id)} className="text-left w-full p-4 flex flex-col gap-2.5 cursor-pointer">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badge}`}>{CAT_LABEL[a.category] ?? a.category}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isAdmin && a.isDraft && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 rounded-full font-semibold">Draft</span>}
                        </div>
                      </div>
                      <p className={`text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug${showZh ? " lang-zh" : ""}`}>
                        {showZh ? a.titleZh : a.title}
                      </p>
                      {density === "3" && (showZh ? a.contentZh : a.content) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                          {toPlainText((showZh ? a.contentZh : a.content) ?? "").slice(0, 120)}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        {a.updatedAt ? (
                          <div className="relative group/dates inline-flex items-center" onClick={e => e.stopPropagation()}>
                            <span className="text-xs text-gray-400 dark:text-gray-500 cursor-default underline decoration-dotted underline-offset-2">
                              {new Date(a.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            <div className="absolute top-full left-0 mt-1 hidden group-hover/dates:block z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2.5 min-w-max text-xs text-gray-600 dark:text-gray-300 space-y-1 pointer-events-none">
                              <div className="font-medium text-gray-500 dark:text-gray-400 pb-1 border-b border-gray-100 dark:border-gray-700">Date history</div>
                              <div>📄 Created: {fmtDate(a.date)}</div>
                              {buildUpdateHistory(a).map(d => <div key={d}>✏️ Updated: {fmtDateIso(d)}</div>)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(a.date)}</span>
                        )}
                        {noStr && <span className="text-[10px] font-mono text-gray-300 dark:text-gray-600">#{noStr}</span>}
                      </div>
                    </button>
                    <a
                      href={`/knowledge/${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in new tab"
                      onClick={e => e.stopPropagation()}
                      className="absolute top-2 right-2 p-1 rounded text-gray-300 dark:text-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  </div>
                );
              })}
            </div>
          );
        }

        // Table view
        return (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 w-12">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Title</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Category</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {results.map((a) => {
                  const badge = CAT_BADGE[a.category] ?? CAT_BADGE.GD;
                  const noStr = a.articleNo ? String(a.articleNo).padStart(3, "0") : null;
                  const isRead = userReads.includes(a.id);
                  const showZh = lang === "zh" && !!a.titleZh && (!a.zhDraft || isAdmin);
                  return (
                    <tr key={a.id} onClick={() => setOpenArticleId(a.id)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                      <td className="px-4 py-2.5 text-xs font-mono text-gray-300 dark:text-gray-600">{noStr ? `#${noStr}` : "—"}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white max-w-xs truncate">
                        <span className={showZh ? "lang-zh" : ""}>{showZh ? a.titleZh : a.title}</span>
                      </td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{CAT_LABEL[a.category] ?? a.category}</span></td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {a.updatedAt ? (
                          <div className="relative group/dates inline-flex items-center">
                            <span className="cursor-default underline decoration-dotted underline-offset-2">
                              {new Date(a.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            <div className="absolute top-full left-0 mt-1 hidden group-hover/dates:block z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2.5 min-w-max text-xs text-gray-600 dark:text-gray-300 space-y-1 pointer-events-none">
                              <div className="font-medium text-gray-500 dark:text-gray-400 pb-1 border-b border-gray-100 dark:border-gray-700">Date history</div>
                              <div>📄 Created: {fmtDate(a.date)}</div>
                              {buildUpdateHistory(a).map(d => <div key={d}>✏️ Updated: {fmtDateIso(d)}</div>)}
                            </div>
                          </div>
                        ) : fmtDate(a.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        {isAdmin && a.isDraft ? <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 rounded-full font-semibold">Draft</span> : null}
                      </td>
                      <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                        <a
                          href={`/knowledge/${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in new tab"
                          className="flex items-center justify-center p-1 rounded text-gray-300 dark:text-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {!noMatch && results.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-12">
          No articles{category !== "ALL" ? ` in ${category}` : ""}
        </p>
      )}
      </div>

      {/* Floating AI button */}
      {!aiMode && !openArticle && (
        <button
          onClick={() => setAiMode(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-medium shadow-lg transition-all"
        >
          <span className="text-base leading-none">✦</span>
          Ask AI
        </button>
      )}

      {/* AI search modal */}
      {aiMode && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm"
          onClick={exitAiMode}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-indigo-500 text-lg">✦</span>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ask AI</span>
              <button onClick={exitAiMode} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
            </div>
            <div className="flex gap-2 p-4">
              <input
                type="text"
                value={aiQuery}
                onChange={e => { setAiQuery(e.target.value); if (!e.target.value) { setAiResult(null); setAiError(null); } }}
                onKeyDown={e => e.key === "Enter" && runAiSearch()}
                placeholder="Ask anything about our processes…"
                autoFocus
                className="flex-1 pl-4 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={runAiSearch}
                disabled={aiLoading || !aiQuery.trim()}
                className="px-4 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors shrink-0"
              >
                {aiLoading ? "…" : "Ask"}
              </button>
            </div>
            {aiResult && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{aiResult.answer}</p>
                {aiResult.articleIds.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Relevant articles</p>
                    {aiResult.articleIds.map(id => {
                      const a = articles.find(x => x.id === id);
                      if (!a) return null;
                      const noStr = a.articleNo ? String(a.articleNo).padStart(3, "0") : null;
                      return (
                        <button key={id} onClick={() => {
                          exitAiMode();
                          setOpenArticleId(id);
                          setTimeout(() => {
                            const el = noStr ? document.getElementById(`article-${noStr}`) : null;
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 50);
                        }}
                          className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors group">
                          <span className="text-xs font-mono text-indigo-400 shrink-0 w-8">{noStr ? `#${noStr}` : "•"}</span>
                          <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 line-clamp-1">{a.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {aiError && (
              <div className="mx-4 mb-4 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-sm text-red-600 dark:text-red-400">{aiError}</div>
            )}
          </div>
        </div>
      )}

      {/* Article modal */}
      {openArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpenArticleId(null)}
        >
          <div
            className="relative bg-transparent w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setOpenArticleId(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shadow transition-colors text-sm"
              aria-label="Close"
            >✕</button>
            <ArticleCard
              article={openArticle}
              isAdmin={isAdmin}
              userAttempts={userAttempts}
              userReads={userReads}
              lang={lang}
              forceExpanded={true}
              inModal={true}
              onViewArticle={(id) => setOpenArticleId(id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const SUBTEAM_MAP: Record<string, string> = {
  S055VEMMUFP: "costl",
  S018R16L079: "cos",
  S02J5DVNE78: "com",
  S0556JVHDNC: "cltrainingteam",
  S0382ATRMK8: "cos_non_voice",
  S01QX9QDUSU: "coa",
  S05BLQTFFB7: "crt",
  S03UTRS3VGW: "csm",
  S09UYBHRZ32: "cltleads",
  S0750B6R732: "menu-livesupport",
  S087S7B1UJG: "menu-livesupport-bilingual",
  S09MXERF30R: "pizzasupport",
  S01PSMA69PH: "cts",
  S01R0PYUXDH: "ph_tl",
  S02HMARH4EL: "ph_oms",
  S08912A4L8N: "menu-leaders",
};

const EMOJI_MAP: Record<string, string> = {
  bell: "🔔", octagonal_sign: "🛑", clipboard: "📋", white_check_mark: "✅",
  x: "❌", warning: "⚠️", point_right: "👉", point_left: "👈", point_up: "☝️",
  point_down: "👇", memo: "📝", phone: "📞", rotating_light: "🚨",
  check: "✔️", heavy_check_mark: "✔️", bangbang: "‼️", exclamation: "❗",
  question: "❓", bulb: "💡", rocket: "🚀", fire: "🔥", star: "⭐",
  eyes: "👀", tada: "🎉", raised_hands: "🙌", pray: "🙏",
  thumbsup: "👍", "+1": "👍", thumbsdown: "👎", "-1": "👎",
  "skin-tone-2": "", "skin-tone-3": "", "skin-tone-4": "", "skin-tone-5": "", "skin-tone-6": "",
  heart: "❤️", speech_balloon: "💬", mega: "📣",
  loudspeaker: "📢", information_source: "ℹ️", no_entry: "⛔",
  stop_sign: "🛑", pushpin: "📌", paperclip: "📎", link: "🔗",
  lock: "🔒", unlock: "🔓", key: "🔑", gear: "⚙️", wrench: "🔧",
  pencil: "✏️", page_facing_up: "📄", books: "📚", book: "📖",
  calendar: "📅", clock1: "🕐", hourglass: "⏳", timer: "⏱️",
  arrows_counterclockwise: "🔄", repeat: "🔁", white_circle: "⚪",
  red_circle: "🔴", large_green_circle: "🟢", large_orange_circle: "🟠",
  large_yellow_circle: "🟡", blue_circle: "🔵",
  number_one: "1️⃣", number_two: "2️⃣", number_three: "3️⃣",
  one: "1️⃣", two: "2️⃣", three: "3️⃣", four: "4️⃣", five: "5️⃣",
  six: "6️⃣", seven: "7️⃣", eight: "8️⃣", nine: "9️⃣", zero: "0️⃣",
};

function resolveEmoji(code: string): string {
  return EMOJI_MAP[code] ?? `:${code}:`;
}

type Segment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "underline"; value: string }
  | { type: "strike"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; url: string; label: string }
  | { type: "subteam"; handle: string };

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  // Groups: 1=bold(**) 2=bold(*) 3=underline 4=italic 5=strike 6=code 7=link-url 8=link-label 9=link-bare 10=bare-https 11=emoji 12=subteam-id 13=subteam-name 14=plain-@mention
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_([^_]+)_|~([^~]+)~|`([^`]+)`|<(https?:[^|>]+)\|([^>]+)>|<(https?:[^>]+)>|(https?:\/\/[^\s<>]+)|:([a-z0-9_+-]+):|<!subteam\^([A-Z0-9]+)(?:\|([^>]+))?>|@([\w-]+))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: "text", value: text.slice(last, m.index) });
    if (m[2] !== undefined)       segments.push({ type: "bold",      value: m[2] });
    else if (m[3] !== undefined)  segments.push({ type: "bold",      value: m[3] });
    else if (m[4] !== undefined)  segments.push({ type: "underline", value: m[4] });
    else if (m[5] !== undefined)  segments.push({ type: "italic",    value: m[5] });
    else if (m[6] !== undefined)  segments.push({ type: "strike",    value: m[6] });
    else if (m[7] !== undefined)  segments.push({ type: "code",      value: m[7] });
    else if (m[9] !== undefined)  segments.push({ type: "link",      url: m[8], label: m[9] });
    else if (m[10] !== undefined) segments.push({ type: "link",      url: m[10], label: m[10] });
    else if (m[11] !== undefined) segments.push({ type: "link",      url: m[11], label: m[11] });
    else if (m[12] !== undefined) segments.push({ type: "text",      value: resolveEmoji(m[12]) });
    else if (m[13] !== undefined) {
      const handle = m[14] ?? SUBTEAM_MAP[m[13]] ?? m[13];
      segments.push({ type: "subteam", handle });
    }
    else if (m[15] !== undefined) segments.push({ type: "subteam",   handle: m[15] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ type: "text", value: text.slice(last) });
  return segments;
}

function renderSegments(segments: Segment[], keyPrefix: string) {
  return segments.map((s, i) => {
    const k = `${keyPrefix}-${i}`;
    if (s.type === "bold")      return <strong key={k} className="font-semibold">{s.value}</strong>;
    if (s.type === "italic")    return <em key={k}>{s.value}</em>;
    if (s.type === "underline") return <span key={k} className="underline">{s.value}</span>;
    if (s.type === "strike")    return <del key={k} className="line-through text-gray-400">{s.value}</del>;
    if (s.type === "code")    return <code key={k} className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono">{s.value}</code>;
    if (s.type === "link") {
      const loomId = loomEmbedId(s.url);
      if (loomId) return <div key={k} className="loom-embed my-2"><iframe src={`https://www.loom.com/embed/${loomId}`} frameBorder={0} allowFullScreen style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} /></div>;
      return <a key={k} href={s.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline break-all">{s.label}</a>;
    }
    if (s.type === "subteam") return <span key={k} className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">#{s.handle}</span>;
    return <span key={k}>{s.value}</span>;
  });
}

function SlackContent({ text }: { text: string }) {
  // Normalize Windows line endings, then strip outer Slack meta references (subteam handled in parseInline)
  const clean = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/<!channel>/g, "@channel")
    .replace(/<!here>/g, "@here")
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<@[A-Z0-9]+\|([^>]+)>/g, "@$1")
    .replace(/<@[A-Z0-9]+>/g, "@user");

  const lines = clean.split("\n");

  return (
    <div className="space-y-0.5">
      {lines.map((line, li) => {
        if (line.startsWith("> ")) {
          const inner = parseInline(line.slice(2));
          return (
            <div key={li} className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 my-0.5 text-gray-500 dark:text-gray-400 italic text-sm leading-relaxed">
              {renderSegments(inner, `l${li}`)}
            </div>
          );
        }
        const segs = parseInline(line);
        return (
          <p key={li} className={line === "" ? "h-2" : "leading-relaxed"}>
            {renderSegments(segs, `l${li}`)}
          </p>
        );
      })}
    </div>
  );
}

// ─── Tag Mention (@ → #) ─────────────────────────────────────────────────────

const TagMention = Mark.create({
  name: "tagMention",
  renderHTML() {
    return ["span", { class: "tag-mention" }, 0];
  },
  parseHTML() {
    return [{ tag: "span.tag-mention" }];
  },
  addInputRules() {
    // Fires when user types @word followed by a space
    return [
      new InputRule({
        find: /@([\w-]+) $/,
        handler({ state, range, match }) {
          const { tr } = state;
          const tag = match[1];
          const start = range.from;
          const end = range.to;
          // Replace "@word " with "#word " and apply the mark
          tr.replaceWith(start, end, state.schema.text(`#${tag} `));
          const markType = state.schema.marks.tagMention;
          if (markType) {
            tr.addMark(start, start + tag.length + 1, markType.create());
          }
        },
      }),
    ];
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CopyLinkButton({ articleNo }: { articleNo: number }) {
  const [copied, setCopied] = useState(false);
  const noStr = String(articleNo).padStart(3, "0");
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/knowledge#article-${noStr}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button onClick={handleCopy} title="Copy link"
      className="px-3 border-l border-gray-100 dark:border-gray-800 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )}
    </button>
  );
}

function fmtDateIso(iso: string) {
  const dt = new Date(iso + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildUpdateHistory(a: Article): string[] {
  const history: string[] = [];
  try { history.push(...JSON.parse(a.updateHistory ?? "[]")); } catch { /* ignore */ }
  if (a.updatedAt) {
    const d = new Date(a.updatedAt).toISOString().slice(0, 10);
    if (!history.includes(d)) history.push(d);
  }
  return [...new Set(history)].sort();
}

function renderChangeNotes(raw: string, _updatedAt: Date | null, label?: string) {
  let entries: { date: string; text: string }[] = [];
  try {
    const p = JSON.parse(raw);
    entries = Array.isArray(p) ? p : [{ date: "", text: raw }];
  } catch { entries = [{ date: "", text: raw }]; }

  const renderEntry = (text: string, date: string, i: number) => {
    const parts = text.split(/(?=\d+\.\s)/).filter(p => p.trim());
    const isList = parts.length > 1;
    const dateLabel = date && date !== "legacy"
      ? new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;
    return (
      <div key={i} className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-1.5">
            <span className="text-blue-500 text-xs">📝</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{label ?? "What’s new"}</span>
          </div>
          {dateLabel && <span className="text-[10px] text-blue-400 dark:text-blue-500">{dateLabel}</span>}
        </div>
        {isList ? (
          <ol className="px-3 py-2 flex flex-col gap-1">
            {parts.map((part, j) => (
              <li key={j} className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                <span className="shrink-0 mt-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-800 text-[9px] font-bold text-blue-700 dark:text-blue-300">{j + 1}</span>
                {part.replace(/^\d+\.\s*/, "")}
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-3 py-2 text-xs text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-wrap">{text}</p>
        )}
      </div>
    );
  };

  return (
    <div className="mx-4 mt-3 space-y-2">
      {[...entries].reverse().map((e, i) => renderEntry(e.text, e.date, i))}
    </div>
  );
}

// ─── Rich Text Editor (with TagMention support for @mentions) ────────────────

const KBVideo = TiptapNode.create({
  name: "kbvideo",
  group: "block",
  atom: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["video", { controls: "", class: "max-w-full rounded-lg my-2", ...HTMLAttributes }];
  },
  addCommands() {
    return {
      setVideo: (attrs: { src: string }) => ({ commands }: { commands: any }) =>
        commands.insertContent({ type: "kbvideo", attrs }),
    } as any;
  },
});

async function handleMediaClipboard(
  editor: Editor | null,
  data: DataTransfer | null,
  articleId?: string,
  onUploaded?: () => void
): Promise<boolean> {
  if (!editor || !data) return false;
  const items = Array.from(data.items);
  const item = items.find(i => i.kind === "file" && (i.type.startsWith("image/") || i.type.startsWith("video/")));
  const file = item?.getAsFile();
  if (!file) return false;

  if (file.type.startsWith("video/")) {
    if (!articleId) {
      alert("Save the article first, then paste or drag videos into the content.");
      return true;
    }
    const res = await fetch(`/api/knowledge/${articleId}/upload`, {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type, "X-Filename": encodeURIComponent(file.name) },
    });
    if (!res.ok) {
      alert(`Video upload failed: HTTP ${res.status}`);
      return true;
    }
    const json = await res.json();
    const ext = mimeToExt(file.type);
    const src = `/knowledge-files/${json.file.id}.${ext}`;
    (editor.chain().focus() as any).setVideo({ src }).run();
    onUploaded?.();
    return true;
  }

  // Image: insert as base64
  const reader = new FileReader();
  reader.onload = e => {
    const src = e.target?.result as string;
    editor.chain().focus().setImage({ src }).run();
  };
  reader.readAsDataURL(file);
  return true;
}

const TB_BTN = "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40";
const TB_ACTIVE = "bg-gray-200 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400";

function mimeToExt(mimeType: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    "video/x-msvideo": "avi",
  };
  return map[mimeType] ?? mimeType.split("/")[1] ?? "bin";
}

function KBRichTextEditor({ value, onChange, imageFiles = [], articleId, onUploaded }: { value: string; onChange: (html: string) => void; imageFiles?: SlackFile[]; articleId?: string; onUploaded?: () => void }) {
  const [, forceEditorUpdate] = useState(0);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-indigo-600 dark:text-indigo-400 underline" } }),
      Image.configure({ allowBase64: true, HTMLAttributes: { class: "rounded-lg my-2" } }),
      KBVideo,
      TagMention,
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    onSelectionUpdate() { forceEditorUpdate(n => n + 1); },
    editorProps: {
      attributes: {
        class: "min-h-[160px] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none",
      },
      handlePaste(_view, event) {
        const hasMedia = Array.from(event.clipboardData?.items ?? [])
          .some(i => i.kind === "file" && (i.type.startsWith("image/") || i.type.startsWith("video/")));
        if (!hasMedia) return false;
        handleMediaClipboard(editorRef.current, event.clipboardData, articleId, onUploaded);
        return true;
      },
      handleDrop(_view, event) {
        const hasMedia = Array.from((event as DragEvent).dataTransfer?.items ?? [])
          .some(i => i.kind === "file" && (i.type.startsWith("image/") || i.type.startsWith("video/")));
        if (!hasMedia) return false;
        event.preventDefault();
        handleMediaClipboard(editorRef.current, (event as DragEvent).dataTransfer, articleId, onUploaded);
        return true;
      },
    },
  });

  editorRef.current = editor;

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  useEffect(() => {
    if (!showImagePicker) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowImagePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showImagePicker]);

  if (!editor) return null;

  const imageItems = imageFiles.filter(f => f.mimeType.startsWith("image/"));
  const videoItems = imageFiles.filter(f => f.mimeType.startsWith("video/"));

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-visible focus-within:ring-2 focus-within:ring-indigo-500">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-t-lg">
        {/* Text style */}
        <button type="button" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${TB_BTN} ${editor.isActive("bold") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </button>
        <button type="button" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${TB_BTN} ${editor.isActive("italic") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </button>
        <button type="button" title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`${TB_BTN} ${editor.isActive("underline") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
        </button>
        <button type="button" title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`${TB_BTN} ${editor.isActive("strike") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.6 0 1.5 1.8 3.3 6 3.9h.9M21 12H3M8.7 19.1c2.3.6 4.4 1 6.2.9 2.7 0 5.3-.7 5.3-3.6 0-1.5-1.8-3.3-6-3.9"/></svg>
        </button>
        <button type="button" title="Code" onClick={() => editor.chain().focus().toggleCode().run()}
          className={`${TB_BTN} ${editor.isActive("code") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* Lists */}
        <button type="button" title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${TB_BTN} ${editor.isActive("bulletList") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></svg>
        </button>
        <button type="button" title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${TB_BTN} ${editor.isActive("orderedList") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* Link */}
        <button type="button" title="Link" onClick={setLink}
          className={`${TB_BTN} ${editor.isActive("link") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </button>

        {/* Image insert */}
        <div className="relative" ref={pickerRef}>
          <button type="button" title="Insert media" disabled={imageItems.length === 0 && videoItems.length === 0}
            onClick={() => setShowImagePicker(v => !v)}
            className={`${TB_BTN} ${showImagePicker ? TB_ACTIVE : ""}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          {showImagePicker && (imageItems.length > 0 || videoItems.length > 0) && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 w-52 flex flex-col gap-2">
              {imageItems.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {imageItems.map(f => {
                    const src = `/knowledge-files/${f.id}.${mimeToExt(f.mimeType)}`;
                    return (
                      <button key={f.id} type="button" title={f.name}
                        onClick={() => {
                          editor.chain().focus().setImage({ src, alt: f.name }).run();
                          setShowImagePicker(false);
                        }}
                        className="aspect-square rounded overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition-colors bg-gray-50 dark:bg-gray-900">
                        <img src={src} alt={f.name} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}
              {videoItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  {videoItems.map(f => {
                    const src = `/knowledge-files/${f.id}.${mimeToExt(f.mimeType)}`;
                    return (
                      <button key={f.id} type="button" title={f.name}
                        onClick={() => {
                          (editor.chain().focus() as any).setVideo({ src }).run();
                          setShowImagePicker(false);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 hover:border-indigo-400 bg-gray-50 dark:bg-gray-900 text-left transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gray-400"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* Clear */}
        <button type="button" title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className={TB_BTN}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><line x1="17" y1="7" x2="7" y2="17"/></svg>
        </button>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}

// Convert @word → <span class="tag-mention">#word</span> in HTML strings
function applyMentionBadges(html: string): string {
  return html.replace(/(^|[\s>])@([\w][\w-]*)/g, '$1<span class="tag-mention">#$2</span>');
}

// Convert Loom share links → embedded iframes in HTML strings.
// Handles both <a href="loom..."> tags and bare URLs in text.
function applyLoomEmbeds(html: string): string {
  // 1. Replace <a href="loom...">...</a>
  let out = html.replace(
    /<a[^>]*href="(https:\/\/(?:www\.)?loom\.com\/share\/([a-zA-Z0-9]+)(?:[?][^"]*)?)"[^>]*>.*?<\/a>/gi,
    (_m, _full, id) => `<div class="loom-embed"><iframe src="https://www.loom.com/embed/${id}" frameborder="0" allowfullscreen></iframe></div>`
  );
  // 2. Replace bare URLs not already inside href="..."
  out = out.replace(
    /(?<!href=["'])https:\/\/(?:www\.)?loom\.com\/share\/([a-zA-Z0-9]+)(?:[?][^\s<"']*)?/gi,
    (_m, id) => `<div class="loom-embed"><iframe src="https://www.loom.com/embed/${id}" frameborder="0" allowfullscreen></iframe></div>`
  );
  return out;
}

function loomEmbedId(url: string): string | null {
  const m = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/i);
  return m ? m[1] : null;
}

// Detect whether stored content is HTML (TipTap) or legacy Slack markdown.
// Must not match Slack's <https://url|label> angle-bracket link syntax.
function ArticleContent({ text }: { text: string }) {
  const isHtml = /<\/?[a-zA-Z][a-zA-Z0-9]*[\s\/>]/.test(text);
  if (isHtml) {
    // When Slack text is pasted into TipTap, it wraps in <p> tags but the
    // content still has Slack markers (*bold*, :emoji:). Detect this case and
    // route to SlackContent so formatting is rendered correctly.
    const hasSlackMarkers = /\*[^*\n]+\*|:[a-z0-9_+\-]+:/.test(text);
    const onlySimpleTags = !/<(?!\/?(?:p|br|ul|ol|li)\b)[a-z]/i.test(text);
    if (hasSlackMarkers && onlySimpleTags) {
      const plain = text
        .replace(/<\/p>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
        .trim();
      return <SlackContent text={plain} />;
    }
    const processed = applyLoomEmbeds(applyMentionBadges(text));
    return (
      <div
        className="rte-content text-sm text-gray-700 dark:text-gray-300"
        dangerouslySetInnerHTML={{ __html: processed }}
      />
    );
  }
  return <SlackContent text={text} />;
}

// ─────────────────────────────────────────────────────────────────────────────

const SLACK_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);

function toInputDate(d: Date) {
  // YYYY-MM-DD for <input type="date">
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inputDateToDisplay(iso: string) {
  // YYYY-MM-DD → M/D/YYYY
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

function NewArticleModal({ onClose, onViewArticle }: { onClose: () => void; onViewArticle: (id: string) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("GD");
  const [dateIso, setDateIso] = useState(toInputDate(new Date()));
  const [content, setContent] = useState("");
  const [altLink, setAltLink] = useState("");
  const [slackLink, setSlackLink] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflictMatches, setConflictMatches] = useState<{ id: string; title: string }[]>([]);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [skipConflict, setSkipConflict] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(force = false) {
    if (!title.trim()) { setError("Title is required"); return; }
    setError("");
    setCheckError(null);
    setSaving(true);
    try {
      const result = await createKnowledgeArticle({
        title, category,
        date: inputDateToDisplay(dateIso),
        content, altLink, slackLink,
        force: force || skipConflict,
      });
      if (result.checkError) { setCheckError(result.checkError); setSaving(false); return; }
      if (result.conflict) { setConflictMatches(result.matches ?? []); setSaving(false); return; }
      if (result.error) { setError(result.error); setSaving(false); return; }

      // Upload any attached files
      if (files.length && result.id) {
        for (const file of files) {
          await fetch(`/api/knowledge/${result.id}/upload`, {
            method: "POST",
            body: file,
            headers: { "Content-Type": file.type, "X-Filename": encodeURIComponent(file.name) },
          });
        }
      }

      onClose();
      router.refresh();
    } catch {
      setError("Unexpected error");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">New Article</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">✕</button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. How to handle special hour requests"
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Category + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {["GD","COS","CMA","DE"].map(c => <option key={c} value={c}>{CAT_LABEL[c] ?? c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Date</label>
              <input type="date" value={dateIso} onChange={e => setDateIso(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Content</label>
            <KBRichTextEditor value={content} onChange={setContent} />
          </div>

          {/* File upload */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Attachments (images / videos)</label>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
              onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Choose files
            </button>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                    <span className="text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">{f.name}</span>
                    <span className="text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} className="ml-2 text-gray-400 hover:text-red-500 transition-colors">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Links */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Slack link (optional)</label>
            <input value={slackLink} onChange={e => setSlackLink(e.target.value)} placeholder="https://wonderscorp.slack.com/archives/…"
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Reference link (optional)</label>
            <input value={altLink} onChange={e => setAltLink(e.target.value)} placeholder="https://…"
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {conflictMatches.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">⚠ Similar articles already exist:</p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc list-inside">
                {conflictMatches.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => onViewArticle(m.id)}
                      className="underline text-left hover:text-amber-900 dark:hover:text-amber-200 transition-colors">
                      {m.title} ↗
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-600 dark:text-amber-500">Review them before creating a duplicate. Click Create Anyway to proceed.</p>
            </div>
          )}
          {checkError && (
            <div className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/40 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">⚠ Duplicate check failed</p>
              <p className="text-xs text-red-600 dark:text-red-400">{checkError}</p>
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={() => handleSave(false)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 font-medium transition-colors">
                  Retry check
                </button>
                <span className="text-xs text-red-400 dark:text-red-500">or click Create Anyway to skip</span>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3">
          <button onClick={() => handleSave(conflictMatches.length > 0 || !!checkError)} disabled={saving}
            className="text-sm px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50 transition-colors">
            {saving ? "Checking…" : (conflictMatches.length > 0 || checkError) ? "Create Anyway" : "Create"}
          </button>
          <button onClick={onClose} disabled={saving}
            className="text-sm px-5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors disabled:opacity-50">
            Cancel
          </button>
          <label className="ml-auto inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={skipConflict} onChange={e => setSkipConflict(e.target.checked)}
              className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Skip duplicate check</span>
          </label>
        </div>
      </div>
    </div>
  );
}

const CAT_ACCENT: Record<string, string> = {
  GD:  "border-l-blue-400 dark:border-l-blue-500",
  COS: "border-l-violet-400 dark:border-l-violet-500",
  CMA: "border-l-amber-400 dark:border-l-amber-500",
  DE:  "border-l-emerald-400 dark:border-l-emerald-500",
};

const CAT_BADGE: Record<string, string> = {
  GD:  "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  COS: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  CMA: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  DE:  "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      onKeyDown={e => e.key === "Escape" && onClose()}
      tabIndex={-1}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors text-lg"
      >✕</button>
    </div>
  );
}

export function ArticleCard({ article: a, isAdmin, userAttempts, autoOpen = false, userReads = [], lang = "en", forceExpanded = false, inModal = false, onOpenModal, onViewArticle }: { article: Article; isAdmin: boolean; userAttempts: UserAttempt[]; autoOpen?: boolean; userReads?: string[]; lang?: "en" | "zh"; forceExpanded?: boolean; inModal?: boolean; onOpenModal?: () => void; onViewArticle?: (id: string) => void }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded || expanded;
  const [quizOpen, setQuizOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"article" | "media" | "faq" | "talktrack" | "quiz">("article");
  const [quizStep, setQuizStep] = useState(0);
  const [faqs, setFaqs] = useState<FAQ[]>(a.faqs);
  const [openFaqIds, setOpenFaqIds] = useState<Set<string>>(new Set());
  const [faqPending, startFaqTransition] = useTransition();
  const [showAddFaq, setShowAddFaq] = useState(false);
  const [newFaqQ, setNewFaqQ] = useState("");
  const [newFaqA, setNewFaqA] = useState("");
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editFaqQ, setEditFaqQ] = useState("");
  const [editFaqA, setEditFaqA] = useState("");

  // Talk Track state
  const [talkTracks, setTalkTracks] = useState<TalkTrack[]>(a.talkTracks ?? []);
  const [trackPending, startTrackTransition] = useTransition();
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [newTrackContent, setNewTrackContent] = useState("");
  const [newTrackAiDraft, setNewTrackAiDraft] = useState<string | null>(null);
  const [trackGenerating, setTrackGenerating] = useState(false);
  const [trackLanguage, setTrackLanguage] = useState<"EN" | "CN">("CN");
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTrackContent, setEditTrackContent] = useState("");
  const [termSuggestions, setTermSuggestions] = useState<{termEn: string; termZh: string}[]>([]);
  const [zhEditOpen, setZhEditOpen] = useState(false);
  const [editTitleZh, setEditTitleZh] = useState(a.titleZh ?? "");
  const [editContentZh, setEditContentZh] = useState(a.contentZh ?? "");
  const [editChangeNotesZh, setEditChangeNotesZh] = useState(a.changeNotesZh ?? "");
  const [zhPending, startZhTransition] = useTransition();
  const [zhOverride, setZhOverride] = useState<{ titleZh: string | null; contentZh: string | null } | null>(null);
  const titleZh = zhOverride?.titleZh ?? a.titleZh;
  const contentZh = zhOverride?.contentZh ?? a.contentZh;
  const showZh = lang === "zh" && !!titleZh && (!a.zhDraft || isAdmin);

  useEffect(() => {
    if (autoOpen) setExpanded(true);
  }, [autoOpen]);
  useEffect(() => {
    if (!isExpanded) {
      setActiveSection("article");
      setQuizStep(0);
    }
  }, [isExpanded]);
  const [editing, setEditing] = useState(false);
  const [saving, startSave] = useTransition();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(a.quizQuestions);
  const [quizPending, startQuizTransition] = useTransition();

  function handleApproveQuiz(questionId: string) {
    startQuizTransition(async () => {
      await approveKnowledgeQuizQuestion(questionId);
      setQuizQuestions(prev => prev.map(q => q.id === questionId ? { ...q, isDraft: false } : q));
    });
  }

  function handleDeleteQuiz(questionId: string) {
    startQuizTransition(async () => {
      await deleteKnowledgeQuizQuestion(questionId);
      setQuizQuestions(prev => prev.filter(q => q.id !== questionId));
    });
  }

  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState<{ question: string; type: string; options: string[]; correctAnswer: string; multiCorrect: string[] } | null>(null);

  function openQuizEdit(q: QuizQuestion) {
    let parsedOptions: string[] = [];
    try { parsedOptions = q.options ? JSON.parse(q.options) : []; } catch { parsedOptions = []; }
    let correctArr: string[] = [];
    try { correctArr = q.type === "MULTI_SELECT" && q.correctAnswer ? JSON.parse(q.correctAnswer) : []; } catch { correctArr = []; }
    setEditQ({ question: q.question, type: q.type, options: parsedOptions, correctAnswer: q.type === "SELECT" ? (q.correctAnswer ?? "") : "", multiCorrect: correctArr });
    setEditingQuizId(q.id);
  }

  function handleSaveQuizEdit(questionId: string) {
    if (!editQ) return;
    const options = JSON.stringify(editQ.options.filter(Boolean));
    const correctAnswer = editQ.type === "MULTI_SELECT" ? JSON.stringify(editQ.multiCorrect) : editQ.correctAnswer;
    startQuizTransition(async () => {
      await updateKnowledgeQuizQuestion(questionId, { question: editQ.question, type: editQ.type, options, correctAnswer });
      setQuizQuestions(prev => prev.map(qq => qq.id === questionId ? { ...qq, question: editQ.question, type: editQ.type, options, correctAnswer } : qq));
      setEditingQuizId(null);
      setEditQ(null);
    });
  }

  // Add quiz manually / generate AI quiz
  const [showAddQuiz, setShowAddQuiz] = useState(false);
  const [newQ, setNewQ] = useState<{ question: string; type: string; options: string[]; correctAnswer: string; multiCorrect: string[] }>({ question: "", type: "SELECT", options: ["", "", "", ""], correctAnswer: "", multiCorrect: [] });
  const [aiGenerating, startAiGenerate] = useTransition();

  function handleAddQuizSubmit() {
    const options = newQ.options.filter(Boolean);
    if (!newQ.question.trim() || options.length < 2) return;
    const correctAnswer = newQ.type === "MULTI_SELECT" ? JSON.stringify(newQ.multiCorrect) : newQ.correctAnswer;
    startQuizTransition(async () => {
      const res = await addKnowledgeQuizQuestion(a.id, { question: newQ.question, type: newQ.type, options, correctAnswer });
      if ("id" in res && res.id) {
        setQuizQuestions(prev => [...prev, { id: res.id, question: newQ.question, type: newQ.type, options: JSON.stringify(options), correctAnswer, isDraft: true, gradingType: "NONE", order: prev.length }]);
      }
      setNewQ({ question: "", type: "SELECT", options: ["", "", "", ""], correctAnswer: "", multiCorrect: [] });
      setShowAddQuiz(false);
    });
  }

  function handleGenerateAIQuiz() {
    startAiGenerate(async () => {
      await triggerKnowledgeQuizDraft(a.id);
      router.refresh();
    });
  }

  // Quiz-taking state (non-admin)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; total: number; results: { questionId: string; isCorrect: boolean }[] } | null>(null);
  const [quizSubmitting, startQuizSubmit] = useTransition();
  const [markingRead, startMarkRead] = useTransition();

  // Edit form state
  const [editTitle, setEditTitle] = useState(a.title);
  const [editCategory, setEditCategory] = useState(a.category);
  const [editDate, setEditDate] = useState(a.date);
  const [editContent, setEditContent] = useState(a.content ?? "");
  const [editAltLink, setEditAltLink] = useState(a.altLink ?? "");
  const [editSlackLink, setEditSlackLink] = useState(a.slackLink ?? "");
  const [editArchived, setEditArchived] = useState(a.isArchived);
  const [editChangeNotes, setEditChangeNotes] = useState("");
  const [editConflicts, setEditConflicts] = useState<{ id: string; title: string }[]>([]);
  const [editCheckError, setEditCheckError] = useState<string | null>(null);
  const [skipConflict, setSkipConflict] = useState(false);
  const [suppressNotif, setSuppressNotif] = useState(false);

  function openEdit() {
    setEditTitle(a.title);
    setEditCategory(a.category);
    setEditDate(a.date);
    setEditContent(a.content ?? "");
    setEditAltLink(a.altLink ?? "");
    setEditSlackLink(a.slackLink ?? "");
    setEditArchived(a.isArchived);
    setEditChangeNotes("");
    setEditConflicts([]);
    setEditCheckError(null);
    setSkipConflict(false);
    setEditing(true);
    setExpanded(true);
  }

  async function handleSave(force = false) {
    startSave(async () => {
      const result = await updateKnowledgeArticle(a.id, {
        title: editTitle,
        category: editCategory,
        date: editDate,
        content: editContent || undefined,
        altLink: editAltLink || null,
        slackLink: editSlackLink || null,
        isArchived: editArchived,
        changeNotes: editChangeNotes.trim() || undefined,
        force: force || skipConflict,
        suppress: suppressNotif,
      });
      if (result && "checkError" in result && result.checkError) {
        setEditCheckError(result.checkError);
        return;
      }
      if (result && "conflict" in result && result.conflict) {
        setEditConflicts((result.matches as { id: string; title: string }[]) ?? []);
        return;
      }
      setSuppressNotif(false);
      setEditing(false);
      router.refresh();
    });
  }


  const accent = CAT_ACCENT[a.category] ?? CAT_ACCENT.GD;
  const badge  = CAT_BADGE[a.category]  ?? CAT_BADGE.GD;
  const noStr  = a.articleNo ? String(a.articleNo).padStart(3, "0") : null;

  let parsedFiles: SlackFile[] = [];
  try { parsedFiles = JSON.parse(a.files ?? "[]"); } catch { /* ignore */ }

  const attempt = userAttempts.find(at => at.articleId === a.id);
  const hasApprovedQuiz = quizQuestions.some(q => !q.isDraft);
  // Quiz is done only when user has achieved a perfect score
  const quizDone = !!(attempt && attempt.score === attempt.total);
  // Article is read: either manually marked or quiz completed at 100%
  const isRead = userReads.includes(a.id);

  return (
    <div id={noStr ? `article-${noStr}` : undefined} className={`rounded-xl border-l-4 border border-gray-200 dark:border-gray-700 transition-all ${
      a.isArchived
        ? "border-l-red-400 dark:border-l-red-600 bg-white dark:bg-gray-900 opacity-75"
        : `${accent} bg-white dark:bg-gray-900 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600`
    }`}>
      {/* Header */}
      <div className="flex items-stretch">
        <button onClick={() => { if (inModal) return; if (onOpenModal) { onOpenModal(); return; } setExpanded((v) => !v); }} className="flex-1 text-left px-4 py-3.5 min-w-0">
          <div className="flex items-start gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${badge}`}>{CAT_LABEL[a.category] ?? a.category}</span>
            <div className="flex-1 min-w-0 space-y-1">
              <p className={`text-sm font-semibold text-gray-900 dark:text-white leading-snug${showZh ? " lang-zh" : ""}`}>
                {showZh ? titleZh : a.title}
              </p>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0">
                {a.updatedAt ? (
                  <div className="relative group/dates inline-flex items-center">
                    <span className="text-xs text-gray-400 dark:text-gray-500 cursor-default underline decoration-dotted underline-offset-2">
                      Updated {new Date(a.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <div className="absolute top-full left-0 mt-1 hidden group-hover/dates:block z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2.5 min-w-max text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      <div className="font-medium text-gray-500 dark:text-gray-400 pb-1 border-b border-gray-100 dark:border-gray-700">Date history</div>
                      <div>📄 Created: {fmtDate(a.date)}</div>
                      {buildUpdateHistory(a).map(d => (
                        <div key={d}>✏️ Updated: {fmtDateIso(d)}</div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(a.date)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {isAdmin && a.isDraft && (
                <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 rounded-full font-semibold uppercase tracking-wide">
                  Draft
                </span>
              )}
              {noStr && (
                <span className="text-[10px] font-mono text-gray-300 dark:text-gray-600 select-none">#{noStr}</span>
              )}
              {!inModal && (
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </div>
          </div>
        </button>
        <div className={`flex items-stretch${inModal ? " mr-10" : ""}`}>
          {!inModal && a.id && (
            <a
              href={`/knowledge/${a.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              onClick={e => e.stopPropagation()}
              className="flex items-center px-2 border-l border-gray-100 dark:border-gray-800 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          )}
          {a.articleNo && <CopyLinkButton articleNo={a.articleNo} />}
          {isAdmin && a.isDraft && (
            <div className="flex items-stretch border-l border-gray-100 dark:border-gray-800">
              <label
                className="flex items-center gap-1 px-2 text-[10px] text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="When checked, no notification is sent to users on publish"
                onClick={e => e.stopPropagation()}
              >
                <input type="checkbox" checked={suppressNotif} onChange={e => setSuppressNotif(e.target.checked)}
                  className="w-3 h-3 accent-gray-500" />
                Silent
              </label>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await publishKnowledgeArticle(a.id, suppressNotif);
                  router.refresh();
                }}
                title="Publish article"
                className="px-3 text-yellow-600 hover:text-green-600 dark:text-yellow-400 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-[10px] font-semibold"
              >
                Publish
              </button>
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => { openEdit(); }}
              title="Edit article"
              className="px-3 border-l border-gray-100 dark:border-gray-800 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors rounded-r-xl"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {/* Open in new tab — visible inside expanded article */}
          {a.id && (
            <div className="flex justify-end px-3 pt-2">
              <a
                href={`/knowledge/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Open
              </a>
            </div>
          )}
          {/* Edit form */}
          {editing ? (
            <div className="px-4 pt-4 pb-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Title</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Category</label>
                  <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {["GD","COS","CMA","DE"].map(c => <option key={c} value={c}>{CAT_LABEL[c] ?? c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Date (MM/DD/YYYY)</label>
                  <input value={editDate} onChange={e => setEditDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Content</label>
                  <KBRichTextEditor value={editContent} onChange={setEditContent} imageFiles={parsedFiles} articleId={a.id} onUploaded={router.refresh} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Reference link (optional)</label>
                  <input value={editAltLink} onChange={e => setEditAltLink(e.target.value)} placeholder="https://…"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Slack link (optional)</label>
                  <input value={editSlackLink} onChange={e => setEditSlackLink(e.target.value)} placeholder="https://wondersco.slack.com/archives/…"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editArchived} onChange={e => setEditArchived(e.target.checked)}
                      className="rounded border-gray-300 text-red-500 focus:ring-red-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Mark as archived (retired process)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={skipConflict} onChange={e => setSkipConflict(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Skip duplicate check</span>
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Update notes <span className="font-normal text-gray-400">(what changed?)</span>
                  </label>
                  <textarea
                    value={editChangeNotes}
                    onChange={e => setEditChangeNotes(e.target.value)}
                    placeholder="e.g. Added step 3, updated fee from $3 to $5"
                    rows={2}
                    className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {editConflicts.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 space-y-1.5">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">⚠ Similar articles already exist</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {editConflicts.map(m => (
                      <li key={m.id} className="text-xs text-amber-700 dark:text-amber-400">
                        <button type="button" onClick={() => onViewArticle?.(m.id)}
                          className="underline text-left hover:text-amber-900 dark:hover:text-amber-200 transition-colors">
                          {m.title} ↗
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 dark:text-amber-500">Review the articles above, then click Save Anyway to proceed.</p>
                </div>
              )}
              {editCheckError && (
                <div className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/40 px-4 py-3 space-y-2">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">⚠ Duplicate check failed</p>
                  <p className="text-xs text-red-600 dark:text-red-400">{editCheckError}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button type="button" onClick={() => handleSave(false)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 font-medium transition-colors">
                      Retry check
                    </button>
                    <span className="text-xs text-red-400 dark:text-red-500">or click Save Anyway to skip</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => handleSave(editConflicts.length > 0 || !!editCheckError)} disabled={saving}
                  className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50 transition-colors">
                  {saving ? "Checking…" : (editConflicts.length > 0 || editCheckError) ? "Save Anyway" : "Save"}
                </button>
                <button onClick={() => setEditing(false)}
                  className="text-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors">
                  Cancel
                </button>
                {!a.isDraft && (
                  <label className="flex items-center gap-1 ml-1 text-[10px] text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="When checked, no Slack notification is sent on save">
                    <input type="checkbox" checked={suppressNotif} onChange={e => setSuppressNotif(e.target.checked)} className="w-3 h-3 accent-gray-500" />
                    Silent
                  </label>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              {(() => {
                const tabs: { key: "article" | "media" | "faq" | "talktrack" | "quiz"; label: string }[] = [
                  { key: "article", label: "Article" },
                ];
                if (isAdmin || faqs.length > 0) {
                  tabs.push({ key: "faq", label: faqs.length > 0 ? `FAQ (${faqs.length})` : "FAQ" });
                }
                if (isAdmin || talkTracks.length > 0) {
                  tabs.push({ key: "talktrack", label: talkTracks.length > 0 ? `Talk Track (${talkTracks.length})` : "Talk Track" });
                }
                if (isAdmin || hasApprovedQuiz) {
                  const quizLabel = quizDone ? "Quiz ✓" : attempt && !quizDone ? `Quiz ${attempt.score}/${attempt.total}` : "Quiz";
                  tabs.push({ key: "quiz", label: quizLabel });
                }
                if (tabs.length <= 1) return null;
                return (
                  <div className="flex border-b border-gray-100 dark:border-gray-800 px-2">
                    {tabs.map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveSection(tab.key)}
                        className={`text-xs font-medium px-3 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                          activeSection === tab.key
                            ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                            : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* ARTICLE TAB */}
              {activeSection === "article" && (
                <>
                  {a.isArchived && (
                    <div className="mx-4 mt-3 flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                      <span>⚠️</span> This process is retired — do not follow
                    </div>
                  )}
                  {(showZh ? (a.changeNotesZh ?? a.changeNotes) : a.changeNotes) &&
                    renderChangeNotes(
                      (showZh ? (a.changeNotesZh ?? a.changeNotes) : a.changeNotes)!,
                      a.updatedAt ?? null,
                      showZh ? "更新" : undefined
                    )
                  }
                  {(showZh ? contentZh : a.content) ? (
                    <div
                      className={`px-4 pt-3 pb-2${showZh ? " lang-zh" : ""}`}
                      onClick={e => { const t = e.target as HTMLElement; if (t.tagName === "IMG") setLightboxSrc((t as HTMLImageElement).src); }}
                    >
                      <ArticleContent text={(showZh ? contentZh : a.content)!} />
                    </div>
                  ) : (
                    <p className="px-4 pt-3 pb-2 text-xs text-gray-400 dark:text-gray-500 italic">No content available.</p>
                  )}

                  {/* Admin translation panel */}
                  {isAdmin && (
                    <div className="mx-4 mt-3 mb-1 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          Chinese Translation{!titleZh ? " — Not generated" : a.zhDraft ? " — Draft (pending review)" : " — Published"}
                        </p>
                        {!zhPending && (
                          <div className="flex gap-1.5">
                            {titleZh && a.zhDraft && (
                              <button
                                onClick={() => startZhTransition(async () => { await publishZhTranslation(a.id); router.refresh(); })}
                                className="text-xs px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                              >
                                Publish
                              </button>
                            )}
                            <button
                              onClick={() => startZhTransition(async () => { const r = await retranslateArticle(a.id); setZhOverride(r); router.refresh(); })}
                              title="Re-translate to Chinese"
                              className="flex items-center justify-center w-7 h-7 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                            </button>
                            {titleZh && (
                              <button
                                onClick={() => { setEditTitleZh(titleZh ?? ""); setEditContentZh(contentZh ?? ""); setZhEditOpen(v => !v); }}
                                title="Edit translation"
                                className="flex items-center justify-center w-7 h-7 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {zhPending ? (
                        <div className="flex items-center gap-2.5 py-1">
                          <svg className="w-4 h-4 animate-spin text-amber-500 dark:text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                          </svg>
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Translating to Chinese…</span>
                        </div>
                      ) : (
                        <>
                          {!titleZh && <p className="text-xs text-amber-600 dark:text-amber-400 italic">No translation yet — will generate automatically on article creation.</p>}
                          {titleZh && !zhEditOpen && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 lang-zh mt-0.5 truncate">{titleZh}</p>
                          )}
                        </>
                      )}
                      {zhEditOpen && (
                        <div className="mt-2 space-y-2">
                          <div>
                            <label className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1 block">Title (Chinese)</label>
                            <input
                              value={editTitleZh}
                              onChange={e => setEditTitleZh(e.target.value)}
                              className="w-full text-xs px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 lang-zh"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1 block">Content (Chinese)</label>
                            <KBRichTextEditor value={editContentZh} onChange={setEditContentZh} imageFiles={parsedFiles} articleId={a.id} onUploaded={router.refresh} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1 block">Change Notes (Chinese)</label>
                            <textarea
                              value={editChangeNotesZh}
                              onChange={e => setEditChangeNotesZh(e.target.value)}
                              rows={2}
                              placeholder="更新内容…"
                              className="w-full text-xs px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y lang-zh"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startZhTransition(async () => {
                                const notesZh = editChangeNotesZh.trim() || null;
                                if (a.zhDraft) {
                                  await updateZhTranslation(a.id, editTitleZh.trim(), editContentZh.trim() || null, notesZh);
                                } else {
                                  await updatePublishedZhTranslation(a.id, editTitleZh.trim(), editContentZh.trim() || null, notesZh);
                                }
                                setZhEditOpen(false);
                                router.refresh();
                              })}
                              disabled={zhPending || !editTitleZh.trim()}
                              className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                              {zhPending ? "Saving…" : a.zhDraft ? "Save Draft" : "Save"}
                            </button>
                            <button onClick={() => setZhEditOpen(false)} className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mark as Read */}
                  {!isAdmin && !isRead && !hasApprovedQuiz && (
                    <div className="px-4 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <button
                        onClick={() => startMarkRead(async () => { await markArticleRead(a.id); router.refresh(); })}
                        disabled={markingRead}
                        title="Mark as read"
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {markingRead ? (
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                        {markingRead ? "Marking…" : "Mark Read"}
                      </button>
                    </div>
                  )}

                  {/* Footer links */}
                  {(a.slackLink || a.altLink) && (
                    <div className="px-4 pb-3 pt-1 flex gap-4 border-t border-gray-100 dark:border-gray-800 mt-1">
                      {a.slackLink && (
                        <a href={a.slackLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors">
                          {SLACK_ICON} Open in Slack
                        </a>
                      )}
                      {a.altLink && (
                        <a href={a.altLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition-colors">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          Reference
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}


              {/* FAQ TAB */}
              {activeSection === "faq" && (
                <div className="px-4 py-4 space-y-2">
                  {faqs.length === 0 && !isAdmin && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">No FAQs yet.</p>
                  )}
                  {faqs.map(faq => {
                    const isItemOpen = openFaqIds.has(faq.id);
                    const isEditingThis = editingFaqId === faq.id;
                    return (
                      <div key={faq.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {isEditingThis ? (
                          <div className="p-3 space-y-2">
                            <input value={editFaqQ} onChange={e => setEditFaqQ(e.target.value)} placeholder="Question"
                              className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400" />
                            <textarea value={editFaqA} onChange={e => setEditFaqA(e.target.value)} placeholder="Answer" rows={3}
                              className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => { if (!editFaqQ.trim() || !editFaqA.trim()) return; startFaqTransition(async () => { await updateArticleFAQ(faq.id, editFaqQ.trim(), editFaqA.trim()); setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, question: editFaqQ.trim(), answer: editFaqA.trim() } : f)); setEditingFaqId(null); }); }} disabled={faqPending}
                                className="text-xs px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded font-medium transition-colors disabled:opacity-50">Save</button>
                              <button onClick={() => setEditingFaqId(null)} className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded font-medium transition-colors">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setOpenFaqIds(prev => { const next = new Set(prev); if (next.has(faq.id)) next.delete(faq.id); else next.add(faq.id); return next; })}
                              className="w-full flex items-start justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <svg className="text-violet-500 dark:text-violet-400 shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">{faq.question}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                {isAdmin && (
                                  <>
                                    <span role="button" onClick={e => { e.stopPropagation(); setEditFaqQ(faq.question); setEditFaqA(faq.answer); setEditingFaqId(faq.id); }} title="Edit"
                                      className="flex items-center justify-center w-6 h-6 border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </span>
                                    <span role="button" onClick={e => { e.stopPropagation(); startFaqTransition(async () => { await deleteArticleFAQ(faq.id); setFaqs(prev => prev.filter(f => f.id !== faq.id)); }); }} title="Delete"
                                      className="flex items-center justify-center w-6 h-6 border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </span>
                                  </>
                                )}
                                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isItemOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>
                            {isItemOpen && (
                              <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap pl-6">{faq.answer}</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                  {isAdmin && (
                    showAddFaq ? (
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                        <input value={newFaqQ} onChange={e => setNewFaqQ(e.target.value)} placeholder="Question" autoFocus
                          className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400" />
                        <textarea value={newFaqA} onChange={e => setNewFaqA(e.target.value)} placeholder="Answer" rows={3}
                          className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => { if (!newFaqQ.trim() || !newFaqA.trim()) return; startFaqTransition(async () => { await addArticleFAQ(a.id, newFaqQ.trim(), newFaqA.trim()); setFaqs(prev => [...prev, { id: crypto.randomUUID(), question: newFaqQ.trim(), answer: newFaqA.trim(), order: prev.length }]); setNewFaqQ(""); setNewFaqA(""); setShowAddFaq(false); }); }} disabled={faqPending || !newFaqQ.trim() || !newFaqA.trim()}
                            className="text-xs px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded font-medium transition-colors disabled:opacity-50">
                            {faqPending ? "Adding…" : "Save"}
                          </button>
                          <button onClick={() => { setShowAddFaq(false); setNewFaqQ(""); setNewFaqA(""); }} className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded font-medium transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddFaq(true)} title="Add FAQ"
                        className="flex items-center justify-center w-8 h-8 text-violet-500 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 border border-dashed border-violet-300 dark:border-violet-700 rounded-lg transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    )
                  )}
                </div>
              )}

              {/* TALK TRACK TAB */}
              {activeSection === "talktrack" && (
                <div className="px-4 py-4 space-y-2">
                  {/* Term substitution suggestions */}
                  {termSuggestions.length > 0 && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-1.5">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Detected term substitutions not in your glossary:</p>
                      {termSuggestions.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-amber-800 dark:text-amber-300 font-mono">&quot;{s.termEn}&quot; → &quot;{s.termZh}&quot;</span>
                          <button
                            onClick={() => startTrackTransition(async () => {
                              try {
                                await addGlossaryTerm(s.termEn, s.termZh, undefined);
                              } catch {
                                // already exists — dismiss anyway
                              }
                              setTermSuggestions(prev => prev.filter((_, idx) => idx !== i));
                            })}
                            className="text-xs px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium transition-colors"
                          >Add to Glossary</button>
                          <button
                            onClick={() => setTermSuggestions(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-xs px-2 py-0.5 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded font-medium transition-colors"
                          >Dismiss</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {talkTracks.length === 0 && !isAdmin && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">No talk tracks yet.</p>
                  )}
                  {talkTracks.map(track => {
                    const isEditingThis = editingTrackId === track.id;
                    return (
                      <div key={track.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {isEditingThis ? (
                          <div className="p-3 space-y-2">
                            <textarea
                              value={editTrackContent}
                              onChange={e => setEditTrackContent(e.target.value)}
                              rows={6}
                              placeholder="Talk track script…"
                              className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400 resize-y font-mono"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (!editTrackContent.trim()) return;
                                  startTrackTransition(async () => {
                                    await updateTalkTrack(track.id, editTrackContent.trim());
                                    setTalkTracks(prev => prev.map(t => t.id === track.id ? { ...t, content: editTrackContent.trim() } : t));
                                    setEditingTrackId(null);
                                  });
                                }}
                                disabled={trackPending}
                                className="text-xs px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                              >Save</button>
                              <button
                                onClick={() => setEditingTrackId(null)}
                                className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded font-medium transition-colors"
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed flex-1 font-sans">{track.content}</pre>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${track.language === "CN" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"}`}>{track.language}</span>
                                {isAdmin && (
                                  <>
                                    <span
                                      role="button"
                                      onClick={() => { setEditTrackContent(track.content); setEditingTrackId(track.id); }}
                                      title="Edit"
                                      className="flex items-center justify-center w-6 h-6 border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </span>
                                    <span
                                      role="button"
                                      onClick={() => startTrackTransition(async () => {
                                        await deleteTalkTrack(track.id);
                                        setTalkTracks(prev => prev.filter(t => t.id !== track.id));
                                      })}
                                      title="Delete"
                                      className="flex items-center justify-center w-6 h-6 border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isAdmin && (
                    showAddTrack ? (
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Language:</span>
                            {(["CN", "EN"] as const).map(lang => (
                              <button
                                key={lang}
                                onClick={() => { setTrackLanguage(lang); setNewTrackContent(""); setNewTrackAiDraft(null); }}
                                className={`text-xs px-2 py-0.5 rounded font-semibold border transition-colors ${trackLanguage === lang ? "bg-teal-600 border-teal-600 text-white" : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-teal-400 dark:hover:border-teal-600"}`}
                              >{lang}</button>
                            ))}
                          </div>
                          <button
                            onClick={async () => {
                              setTrackGenerating(true);
                              try {
                                const draft = await generateTalkTrack(a.id, trackLanguage);
                                setNewTrackContent(draft);
                                setNewTrackAiDraft(draft);
                              } finally {
                                setTrackGenerating(false);
                              }
                            }}
                            disabled={trackGenerating}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            {trackGenerating ? (
                              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                            )}
                            {trackGenerating ? "Generating…" : "Generate AI Draft"}
                          </button>
                        </div>
                        <textarea
                          value={newTrackContent}
                          onChange={e => setNewTrackContent(e.target.value)}
                          rows={6}
                          placeholder={trackLanguage === "CN" ? "话术脚本…" : "Talk track script…"}
                          autoFocus
                          className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400 resize-y font-mono"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (!newTrackContent.trim()) return;
                              const content = newTrackContent.trim();
                              const aiDraft = newTrackAiDraft || undefined;
                              startTrackTransition(async () => {
                                const saved = await addTalkTrack(a.id, content, trackLanguage, aiDraft);
                                setTalkTracks(prev => [...prev, { id: saved.id, content, aiDraft: aiDraft ?? null, language: trackLanguage, order: prev.length }]);
                                setNewTrackContent("");
                                setNewTrackAiDraft(null);
                                setShowAddTrack(false);
                                if (aiDraft && saved.id) {
                                  const subs = await checkTermSubstitutions(saved.id);
                                  if (subs.length > 0) setTermSuggestions(subs);
                                }
                              });
                            }}
                            disabled={trackPending || !newTrackContent.trim()}
                            className="text-xs px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-medium transition-colors disabled:opacity-50"
                          >
                            {trackPending ? "Adding…" : "Save"}
                          </button>
                          <button
                            onClick={() => { setShowAddTrack(false); setNewTrackContent(""); setNewTrackAiDraft(null); }}
                            className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded font-medium transition-colors"
                          >Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddTrack(true)}
                        title="Add Talk Track"
                        className="flex items-center justify-center w-8 h-8 text-teal-500 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 border border-dashed border-teal-300 dark:border-teal-700 rounded-lg transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    )
                  )}
                </div>
              )}

              {/* QUIZ TAB */}
              {activeSection === "quiz" && (
                <div className="px-4 py-4">
                  {isAdmin && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setShowAddQuiz(v => !v)} title="Add question"
                          className="flex items-center justify-center w-8 h-8 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <button onClick={handleGenerateAIQuiz} disabled={aiGenerating} title="Generate AI quiz"
                          className="flex items-center justify-center w-8 h-8 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50">
                          {aiGenerating ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> : <span className="text-sm leading-none">✦</span>}
                        </button>
                      </div>

                      {showAddQuiz && (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-3">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">New Question</p>
                          <textarea value={newQ.question} onChange={e => setNewQ(prev => ({ ...prev, question: e.target.value }))} placeholder="Question text" rows={2}
                            className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Type:</span>
                            <label className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                              <input type="radio" checked={newQ.type === "SELECT"} onChange={() => setNewQ(prev => ({ ...prev, type: "SELECT", correctAnswer: "", multiCorrect: [] }))} /> Single Choice
                            </label>
                            <label className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                              <input type="radio" checked={newQ.type === "MULTI_SELECT"} onChange={() => setNewQ(prev => ({ ...prev, type: "MULTI_SELECT", correctAnswer: "", multiCorrect: [] }))} /> Multi Select
                            </label>
                          </div>
                          <div className="space-y-1.5">
                            {newQ.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                {newQ.type === "SELECT" ? (
                                  <input type="radio" name="newQ-correct" checked={newQ.correctAnswer === opt && opt !== ""} onChange={() => opt && setNewQ(prev => ({ ...prev, correctAnswer: opt }))} className="shrink-0" />
                                ) : (
                                  <input type="checkbox" checked={newQ.multiCorrect.includes(opt) && opt !== ""} onChange={() => { if (!opt) return; setNewQ(prev => ({ ...prev, multiCorrect: prev.multiCorrect.includes(opt) ? prev.multiCorrect.filter(o => o !== opt) : [...prev.multiCorrect, opt] })); }} className="shrink-0" />
                                )}
                                <input value={opt} onChange={e => { const val = e.target.value; setNewQ(prev => { const opts = [...prev.options]; opts[oi] = val; const correctAnswer = prev.type === "SELECT" && prev.correctAnswer === opt ? val : prev.correctAnswer; const multiCorrect = prev.type === "MULTI_SELECT" ? prev.multiCorrect.map(o => o === opt ? val : o) : prev.multiCorrect; return { ...prev, options: opts, correctAnswer, multiCorrect }; }); }} placeholder={`Option ${oi + 1}`}
                                  className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button onClick={handleAddQuizSubmit} disabled={quizPending || !newQ.question.trim() || newQ.options.filter(Boolean).length < 2}
                              className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                              {quizPending ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => setShowAddQuiz(false)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Cancel</button>
                          </div>
                        </div>
                      )}

                      {quizQuestions.some(q => q.isDraft) && (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 dark:text-amber-400 shrink-0"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">AI Draft — {quizQuestions.filter(q => q.isDraft).length} pending review</p>
                          </div>
                          <div className="space-y-2">
                            {quizQuestions.filter(q => q.isDraft).map(q => {
                              let parsedOptions: string[] = [];
                              try { parsedOptions = q.options ? JSON.parse(q.options) : []; } catch { parsedOptions = []; }
                              let correctArr: string[] = [];
                              try { correctArr = q.type === "MULTI_SELECT" && q.correctAnswer ? JSON.parse(q.correctAnswer) : []; } catch { correctArr = []; }
                              return (
                                <div key={q.id} className="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-700 p-3">
                                  {editingQuizId === q.id && editQ ? (
                                    <div className="space-y-2">
                                      <textarea value={editQ.question} onChange={e => setEditQ(s => s ? { ...s, question: e.target.value } : s)} rows={2}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                                      <div className="flex gap-3">
                                        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer"><input type="radio" checked={editQ.type === "SELECT"} onChange={() => setEditQ(s => s ? { ...s, type: "SELECT", multiCorrect: [] } : s)} /> Single choice</label>
                                        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer"><input type="radio" checked={editQ.type === "MULTI_SELECT"} onChange={() => setEditQ(s => s ? { ...s, type: "MULTI_SELECT", correctAnswer: "" } : s)} /> Multi choice</label>
                                      </div>
                                      <div className="space-y-1">
                                        {editQ.options.map((opt, i) => (
                                          <div key={i} className="flex items-center gap-2">
                                            {editQ.type === "SELECT" ? <input type="radio" checked={editQ.correctAnswer === opt} onChange={() => setEditQ(s => s ? { ...s, correctAnswer: opt } : s)} /> : <input type="checkbox" checked={editQ.multiCorrect.includes(opt)} onChange={() => setEditQ(s => s ? { ...s, multiCorrect: s.multiCorrect.includes(opt) ? s.multiCorrect.filter(o => o !== opt) : [...s.multiCorrect, opt] } : s)} />}
                                            <input value={opt} onChange={e => { const opts = [...editQ.options]; opts[i] = e.target.value; setEditQ(s => s ? { ...s, options: opts } : s); }}
                                              className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none" />
                                            {editQ.options.length > 2 && <button onClick={() => setEditQ(s => s ? { ...s, options: s.options.filter((_, idx) => idx !== i) } : s)} className="text-xs text-red-400">✕</button>}
                                          </div>
                                        ))}
                                        {editQ.options.length < 6 && <button onClick={() => setEditQ(s => s ? { ...s, options: [...s.options, ""] } : s)} className="text-xs text-gray-400 hover:text-amber-600">+ Add option</button>}
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={() => handleSaveQuizEdit(q.id)} disabled={quizPending} className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-40">Save</button>
                                        <button onClick={() => { setEditingQuizId(null); setEditQ(null); }} className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 flex-1">{q.question}</p>
                                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full">{q.type === "SELECT" ? "Single" : "Multi"}</span>
                                      </div>
                                      {parsedOptions.length > 0 && (
                                        <ul className="mb-2 space-y-0.5 pl-2">
                                          {parsedOptions.map((opt, oi) => {
                                            const isCorrect = q.type === "SELECT" ? opt === q.correctAnswer : correctArr.includes(opt);
                                            return <li key={oi} className={`text-xs flex items-center gap-1.5 ${isCorrect ? "text-green-700 dark:text-green-400 font-medium" : "text-gray-500 dark:text-gray-400"}`}><span>{isCorrect ? "✓" : "·"}</span>{opt}</li>;
                                          })}
                                        </ul>
                                      )}
                                      <div className="flex items-center gap-2 mt-2">
                                        <button onClick={() => handleApproveQuiz(q.id)} disabled={quizPending} className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-40">Approve</button>
                                        <button onClick={() => openQuizEdit(q)} disabled={quizPending} title="Edit" className="flex items-center justify-center w-7 h-7 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors disabled:opacity-40">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button onClick={() => handleDeleteQuiz(q.id)} disabled={quizPending} title="Delete" className="flex items-center justify-center w-7 h-7 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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

                      {quizQuestions.some(q => !q.isDraft) && (
                        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 p-3">
                          <button onClick={() => setQuizOpen(v => !v)} className="flex items-center justify-between w-full">
                            <p className="text-xs font-semibold text-green-800 dark:text-green-300">Published — {quizQuestions.filter(q => !q.isDraft).length} question{quizQuestions.filter(q => !q.isDraft).length !== 1 ? "s" : ""}</p>
                            <svg className={`w-3.5 h-3.5 text-green-600 dark:text-green-400 transition-transform ${quizOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </button>
                          {quizOpen && (
                            <div className="mt-2 space-y-2">
                              {quizQuestions.filter(q => !q.isDraft).map(q => {
                                let opts: string[] = [];
                                try { opts = q.options ? JSON.parse(q.options) : []; } catch { opts = []; }
                                let correctArr: string[] = [];
                                try { correctArr = q.type === "MULTI_SELECT" && q.correctAnswer ? JSON.parse(q.correctAnswer) : []; } catch { correctArr = []; }
                                return (
                                  <div key={q.id} className="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 flex-1">{q.question}</p>
                                      <button onClick={() => handleDeleteQuiz(q.id)} disabled={quizPending} title="Delete"
                                        className="flex items-center justify-center w-6 h-6 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-40 shrink-0">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                      </button>
                                    </div>
                                    <div className="mt-1.5 space-y-0.5">
                                      {opts.map((opt, oi) => { const isCorrect = q.type === "SELECT" ? opt === q.correctAnswer : correctArr.includes(opt); return <p key={oi} className={`text-xs pl-2 ${isCorrect ? "text-green-700 dark:text-green-400 font-medium" : "text-gray-500 dark:text-gray-400"}`}>{isCorrect ? "✓ " : "○ "}{opt}</p>; })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!isAdmin && hasApprovedQuiz && (
                    <div className="space-y-4">
                      {quizDone ? (
                        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-700">
                          <span className="text-2xl">🎉</span>
                          <div>
                            <p className="text-sm font-semibold text-green-700 dark:text-green-400">Quiz passed!</p>
                            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">{attempt?.score}/{attempt?.total} correct</p>
                          </div>
                        </div>
                      ) : quizResult ? (
                        <div className="space-y-3">
                          {quizResult.score === quizResult.total ? (
                            <div className="flex items-center gap-2.5 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                              <span className="text-lg">🎉</span>
                              <div>
                                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Perfect score! Article marked as read.</p>
                                <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">{quizResult.score}/{quizResult.total} correct</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
                                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{quizResult.score}/{quizResult.total} correct — 100% required to pass</p>
                                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Review the article and try again.</p>
                              </div>
                              <div className="space-y-2">
                                {quizQuestions.filter(q => !q.isDraft).map(q => {
                                  const result = quizResult.results.find(r => r.questionId === q.id);
                                  const userAnswer = quizAnswers[q.id] ?? "";
                                  let parsedOptions: string[] = [];
                                  try { parsedOptions = q.options ? JSON.parse(q.options) : []; } catch { parsedOptions = []; }
                                  let selectedAnswers: string[] = [];
                                  if (q.type === "MULTI_SELECT") { try { selectedAnswers = JSON.parse(userAnswer); } catch { selectedAnswers = []; } } else { selectedAnswers = userAnswer ? [userAnswer] : []; }
                                  return (
                                    <div key={q.id} className={`rounded-xl border p-4 ${result?.isCorrect ? "border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/10" : "border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/10"}`}>
                                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">{q.question}</p>
                                      <div className="space-y-1">
                                        {parsedOptions.map((opt, oi) => { if (!selectedAnswers.includes(opt)) return null; return <p key={oi} className={`text-xs flex items-center gap-1.5 ${result?.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}><span className="font-bold">{result?.isCorrect ? "✓" : "✗"}</span><span>{opt}</span></p>; })}
                                        {selectedAnswers.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">No answer selected</p>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <button onClick={() => { setQuizResult(null); setQuizAnswers({}); setQuizStep(0); }}
                                className="text-xs px-4 py-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-medium">
                                Retake
                              </button>
                            </>
                          )}
                        </div>
                      ) : (() => {
                        const approvedQs = quizQuestions.filter(q => !q.isDraft);
                        const total = approvedQs.length;
                        const current = approvedQs[quizStep];
                        if (!current) return null;
                        let parsedOptions: string[] = [];
                        try { parsedOptions = current.options ? JSON.parse(current.options) : []; } catch { parsedOptions = []; }
                        const currentAnswer = quizAnswers[current.id] ?? (current.type === "MULTI_SELECT" ? "[]" : "");
                        let currentMulti: string[] = [];
                        try { if (current.type === "MULTI_SELECT") currentMulti = JSON.parse(currentAnswer); } catch { currentMulti = []; }
                        const isAnswered = current.type === "MULTI_SELECT" ? currentMulti.length > 0 : !!currentAnswer;
                        const isLast = quizStep === total - 1;
                        const allAnswered = approvedQs.every(q => { const ans = quizAnswers[q.id]; if (!ans) return false; if (q.type === "MULTI_SELECT") { try { return (JSON.parse(ans) as string[]).length > 0; } catch { return false; } } return !!ans; });
                        return (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Question {quizStep + 1} of {total}</span>
                              <div className="flex gap-1.5">
                                {approvedQs.map((q, i) => {
                                  const ans = quizAnswers[q.id];
                                  const answered = q.type === "MULTI_SELECT" ? (() => { try { return (JSON.parse(ans ?? "[]") as string[]).length > 0; } catch { return false; } })() : !!ans;
                                  return <button key={q.id} onClick={() => setQuizStep(i)} className={`w-2.5 h-2.5 rounded-full transition-colors ${i === quizStep ? "bg-blue-500 ring-2 ring-blue-200 dark:ring-blue-900" : answered ? "bg-blue-400 dark:bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`} />;
                                })}
                              </div>
                            </div>
                            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">{current.question}</p>
                              <div className="space-y-2">
                                {parsedOptions.map((opt, oi) => (
                                  <label key={oi} className="flex items-center gap-3 cursor-pointer group">
                                    {current.type === "SELECT" ? (
                                      <input type="radio" name={current.id} value={opt} checked={currentAnswer === opt} onChange={() => setQuizAnswers(prev => ({ ...prev, [current.id]: opt }))} className="shrink-0 accent-blue-600" />
                                    ) : (
                                      <input type="checkbox" checked={currentMulti.includes(opt)} onChange={() => { const next = currentMulti.includes(opt) ? currentMulti.filter(o => o !== opt) : [...currentMulti, opt]; setQuizAnswers(prev => ({ ...prev, [current.id]: JSON.stringify(next) })); }} className="shrink-0 accent-blue-600" />
                                    )}
                                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{opt}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <button onClick={() => setQuizStep(v => Math.max(0, v - 1))} disabled={quizStep === 0}
                                className="text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40">
                                Back
                              </button>
                              {isLast ? (
                                <button onClick={() => { const answers = approvedQs.map(q => ({ questionId: q.id, answer: quizAnswers[q.id] ?? "" })); startQuizSubmit(async () => { const res = await submitQuizAttempt(a.id, answers); if ("score" in res && res.score !== undefined && res.total !== undefined) { setQuizResult({ score: res.score, total: res.total, results: res.results ?? [] }); if (res.score === res.total) router.refresh(); } }); }} disabled={quizSubmitting || !allAnswered}
                                  className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                                  {quizSubmitting ? "Submitting…" : "Submit"}
                                </button>
                              ) : (
                                <button onClick={() => setQuizStep(v => Math.min(total - 1, v + 1))} disabled={!isAnswered}
                                  className="text-xs px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50">
                                  Next
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
