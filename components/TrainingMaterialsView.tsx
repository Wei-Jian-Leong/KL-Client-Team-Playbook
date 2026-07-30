"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import SlideViewer, { SlideViewerHandle } from "@/components/SlideViewer";
import dynamic from "next/dynamic";
const PDFImporter = dynamic(() => import("@/components/PDFImporter"), { ssr: false });
import {
  acknowledgeTopic,
  createModule,
  createTopic,
  editModule,
  editTopic,
  archiveModule,
  archiveTopic,
  addSlide,
  deleteSlide,
  reorderSlides,
  editSlideCaption,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  approveDraftQuestion,
  saveQuestionAnswers,
  updateSlideProgress,
  reorderTopics,
  reorderModules,
} from "@/app/actions/training-materials";

const CATEGORY_COLORS: Record<string, string> = {
  GD: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  COS: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
  MENU: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  GENERAL: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300",
};

type TopicAck = { acknowledgedAt: Date };
type Slide = { id: string; imageUrl: string; caption: string | null; order: number };
type Question = {
  id: string;
  question: string;
  type: string;
  options: string[] | null;
  imageUrl: string | null;
  gradingType: string;
  correctAnswer: string | null;
  isRequired: boolean;
  isDraft: boolean;
  order: number;
  answers: { answer: string }[];
};

type Topic = {
  id: string;
  title: string;
  fileLink: string | null;
  content: string | null;
  videoUrl: string | null;
  order: number;
  minQuestionsRequired: number;
  acknowledgments: TopicAck[];
  slides: Slide[];
  slideProgress: { maxSlideReached: number }[];
  questions: Question[];
};

type Module = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  order: number;
  requiredForRoles: string;
  topics: Topic[];
};

type NewHireStat = {
  id: string;
  name: string;
  role: string;
  topicAcknowledgments: { topicId: string }[];
  slideProgress: { topicId: string; maxSlideReached: number }[];
  questionAnswers: { questionId: string; answer: string }[];
};

type LocalQuestion = {
  id: string;
  question: string;
  type: string;
  options: string[];
  imageUrl: string | null;
  gradingType: string;
  correctAnswer: string | null;
  isRequired: boolean;
  isDraft: boolean;
  order: number;
  answers: { answer: string }[];
};

interface Props {
  modules: Module[];
  isAdmin: boolean;
  isNewHire: boolean;
  newHireId?: string;
  ackStats: NewHireStat[];
  previewingAs?: { id: string; name: string };
}

const ROLE_OPTIONS = ["COS", "PIS", "OSM", "AE", "BILLING_COLLECTION", "OTHERS"];
const CATEGORIES = ["GD", "COS", "MENU", "GENERAL"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isTopicUnlocked(topicIndex: number, moduleIndex: number, modules: Module[], ackedIds: Set<string>): boolean {
  if (moduleIndex === 0 && topicIndex === 0) return true;
  if (moduleIndex > 0) {
    const prevModule = modules[moduleIndex - 1];
    const prevAllAcked = prevModule.topics.every((t) => ackedIds.has(t.id));
    if (!prevAllAcked) return false;
  }
  if (topicIndex === 0) return true;
  const prevTopic = modules[moduleIndex].topics[topicIndex - 1];
  return ackedIds.has(prevTopic.id);
}

export default function TrainingMaterialsView({ modules, isAdmin, isNewHire, newHireId, ackStats, previewingAs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [showAddModule, setShowAddModule] = useState(false);
  const [showPDFImporter, setShowPDFImporter] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState<string | null>(null); // moduleId
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic & { moduleId: string } | null>(null);
  const [expandedAck, setExpandedAck] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [addTopicContent, setAddTopicContent] = useState("");
  const [addTopicDirty, setAddTopicDirty] = useState(false);
  const [editTopicContent, setEditTopicContent] = useState("");
  const [editTopicDirty, setEditTopicDirty] = useState(false);
  const [slideMaxReached, setSlideMaxReached] = useState<Record<string, number>>({});
  const [slideUploading, setSlideUploading] = useState(false);
  const slideFileRef = useRef<HTMLInputElement>(null);
  const [editTopicVideoUrl, setEditTopicVideoUrl] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const [videoWatched, setVideoWatched] = useState<Record<string, boolean>>({});
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => new Set(modules.map(m => m.id)));
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(() => new Set(modules.flatMap(m => m.topics.map(t => t.id))));
  const [editQuestions, setEditQuestions] = useState<LocalQuestion[]>([]);
  const [questionUploading, setQuestionUploading] = useState<string | null>(null);
  const [localAnswers, setLocalAnswers] = useState<Record<string, Record<string, string>>>({});
  const [savedAnswerTopics, setSavedAnswerTopics] = useState<Set<string>>(new Set());
  const [answerFeedback, setAnswerFeedback] = useState<Record<string, Record<string, { correct: boolean | null; modelAnswer: string | null }>>>({});
  const [questionIndex, setQuestionIndex] = useState<Record<string, number>>({});
  const questionImageRefsMap = useRef<Record<string, HTMLInputElement | null>>({});
  const slideViewerRefs = useRef<Record<string, React.RefObject<SlideViewerHandle | null>>>({});

  // Drag-and-drop ordering (admin only)
  const [localModuleIds, setLocalModuleIds] = useState<string[]>(() => modules.map((m) => m.id));
  const [localTopicIds, setLocalTopicIds] = useState<Record<string, string[]>>(
    () => Object.fromEntries(modules.map((m) => [m.id, m.topics.map((t) => t.id)]))
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragType = useRef<"module" | "topic" | null>(null);
  const dragModuleId = useRef<string | null>(null);

  // Sync local order when modules prop changes (after revalidatePath)
  useEffect(() => {
    setLocalModuleIds((prev) => {
      const newIds = modules.map((m) => m.id);
      const merged = [...prev.filter((id) => newIds.includes(id)), ...newIds.filter((id) => !prev.includes(id))];
      return merged;
    });
    setLocalTopicIds((prev) => {
      const next = { ...prev };
      for (const m of modules) {
        const newIds = m.topics.map((t) => t.id);
        const existing = prev[m.id] ?? [];
        next[m.id] = [...existing.filter((id) => newIds.includes(id)), ...newIds.filter((id) => !existing.includes(id))];
      }
      return next;
    });
  }, [modules]);

  function toggleModule(id: string) {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        try { localStorage.setItem("tm_last_module", id); } catch {}
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    try {
      const lastModId = localStorage.getItem("tm_last_module");
      if (lastModId && modules.some(m => m.id === lastModId)) {
        setCollapsedModules(prev => { const next = new Set(prev); next.delete(lastModId); return next; });
        const lastTopicId = localStorage.getItem("tm_last_topic");
        const parentMod = modules.find(m => m.topics.some(t => t.id === lastTopicId));
        if (lastTopicId && parentMod?.id === lastModId) {
          setCollapsedTopics(prev => { const next = new Set(prev); next.delete(lastTopicId); return next; });
        }
        setTimeout(() => {
          const el = document.getElementById(`topic-${lastTopicId}`) ?? document.getElementById(`module-${lastModId}`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTopic(id: string) {
    setCollapsedTopics(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        try { localStorage.setItem("tm_last_topic", id); } catch {}
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Build set of acknowledged topic IDs
  const ackedIds = new Set(
    modules.flatMap((m) => m.topics.filter((t) => t.acknowledgments.length > 0).map((t) => t.id))
  );

  const totalTopics = modules.reduce((sum, m) => sum + m.topics.length, 0);
  const ackedCount = ackedIds.size;

  function handleAcknowledge(topicId: string) {
    setAckingId(topicId);
    startTransition(async () => {
      const res = await acknowledgeTopic(topicId);
      if (res?.error) setError(res.error);
      setAckingId(null);
    });
  }

  function handleAddModule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createModule(fd);
      if (res?.error) { setError(res.error); return; }
      setShowAddModule(false);
    });
  }

  function handleEditModule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await editModule(fd);
      if (res?.error) { setError(res.error); return; }
      setEditingModule(null);
    });
  }

  function handleAddTopic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("content", addTopicContent);
    startTransition(async () => {
      const res = await createTopic(fd);
      if (res?.error) { setError(res.error); return; }
      setAddTopicDirty(false);
      setShowAddTopic(null);
      setAddTopicContent("");
    });
  }

  function handleEditTopic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("content", editTopicContent);
    fd.set("videoUrl", editTopicVideoUrl || "");
    startTransition(async () => {
      const res = await editTopic(fd);
      if (res?.error) { setError(res.error); return; }
      setEditTopicDirty(false);
      setEditTopicVideoUrl(null);
      setEditingTopic(null);
    });
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setVideoUploading(true);
    try {
      const res = await fetch("/api/training-materials/upload", {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type, "X-Filename": encodeURIComponent(file.name) },
      });
      const data = await res.json();
      if (!res.ok || !data.url) { setError(data.error || "Upload failed"); return; }
      setEditTopicVideoUrl(data.url);
      setEditTopicDirty(true);
    } finally {
      setVideoUploading(false);
    }
  }

  function handleArchiveModule(id: string) {
    if (!confirm("Archive this module? It will be hidden from all users.")) return;
    startTransition(async () => { await archiveModule(id); });
  }

  function handleArchiveTopic(id: string) {
    if (!confirm("Archive this topic?")) return;
    startTransition(async () => { await archiveTopic(id); });
  }

  async function handleSlideUpload(topicId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setSlideUploading(true);
    try {
      const res = await fetch("/api/training-materials/upload", {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type, "X-Filename": encodeURIComponent(file.name) },
      });
      const data = await res.json();
      if (!res.ok || !data.url) { setError(data.error || "Upload failed"); return; }
      await addSlide(topicId, data.url);
    } finally {
      setSlideUploading(false);
    }
  }

  function handleDeleteSlide(slideId: string) {
    if (!confirm("Delete this slide?")) return;
    startTransition(async () => { await deleteSlide(slideId); });
  }

  function handleMoveSlide(topic: Topic & { moduleId: string }, slideId: string, direction: -1 | 1) {
    const slides = [...topic.slides].sort((a, b) => a.order - b.order);
    const idx = slides.findIndex((s) => s.id === slideId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= slides.length) return;
    const newOrder = slides.map((s) => s.id);
    const tmp = newOrder[idx];
    newOrder[idx] = newOrder[swapIdx];
    newOrder[swapIdx] = tmp;
    startTransition(async () => { await reorderSlides(topic.id, newOrder); });
  }

  function handleCaptionChange(slideId: string, caption: string) {
    startTransition(async () => { await editSlideCaption(slideId, caption); });
  }

  function getEditQuestion(id: string) {
    return editQuestions.find((q) => q.id === id);
  }

  async function handleAddQuestion(topicId: string) {
    const res = await addQuestion(topicId, "SHORT_ANSWER", "");
    if (res?.question) {
      setEditQuestions((prev) => [...prev, {
        ...res.question,
        options: [],
        answers: [],
        imageUrl: null,
        gradingType: "NONE",
        correctAnswer: null,
        isRequired: false,
      }]);
    }
  }

  function handleDeleteQuestion(questionId: string) {
    if (!confirm("Delete this question and all answers?")) return;
    startTransition(async () => { await deleteQuestion(questionId); });
    setEditQuestions((prev) => prev.filter((q) => q.id !== questionId));
  }

  function handleApproveDraft(questionId: string) {
    startTransition(async () => {
      const res = await approveDraftQuestion(questionId);
      if (!res.success) { setError("Failed to approve question"); return; }
      setEditQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, isDraft: false } : q));
    });
  }

  function handleQuestionTypeChange(questionId: string, type: string) {
    setEditQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, type } : q));
    const q = getEditQuestion(questionId);
    if (q) startTransition(async () => { await updateQuestion(questionId, q.question, q.options, q.imageUrl, q.gradingType, q.correctAnswer, q.isRequired); });
  }

  function handleQuestionTextBlur(questionId: string, text: string) {
    setEditQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, question: text } : q));
    const q = getEditQuestion(questionId);
    if (q) startTransition(async () => { await updateQuestion(questionId, text, q.options, q.imageUrl, q.gradingType, q.correctAnswer, q.isRequired); });
  }

  function handleOptionChange(questionId: string, idx: number, value: string) {
    setEditQuestions((prev) => prev.map((q) => {
      if (q.id !== questionId) return q;
      const opts = [...q.options];
      opts[idx] = value;
      return { ...q, options: opts };
    }));
  }

  function handleOptionBlur(questionId: string) {
    const q = getEditQuestion(questionId);
    if (q) startTransition(async () => { await updateQuestion(questionId, q.question, q.options, q.imageUrl, q.gradingType, q.correctAnswer, q.isRequired); });
  }

  function handleAddOption(questionId: string) {
    setEditQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, options: [...q.options, ""] } : q));
  }

  function handleDeleteOption(questionId: string, idx: number) {
    setEditQuestions((prev) => prev.map((q) => {
      if (q.id !== questionId) return q;
      const opts = q.options.filter((_, i) => i !== idx);
      return { ...q, options: opts };
    }));
    const q = editQuestions.find((q) => q.id === questionId);
    if (q) {
      const opts = q.options.filter((_, i) => i !== idx);
      startTransition(async () => { await updateQuestion(questionId, q.question, opts, q.imageUrl, q.gradingType, q.correctAnswer, q.isRequired); });
    }
  }

  async function handleQuestionImageUpload(questionId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setQuestionUploading(questionId);
    try {
      const res = await fetch("/api/training-materials/upload", {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type, "X-Filename": encodeURIComponent(file.name) },
      });
      const data = await res.json();
      if (!res.ok || !data.url) { setError(data.error || "Upload failed"); return; }
      const q = getEditQuestion(questionId);
      if (q) await updateQuestion(questionId, q.question, q.options, data.url, q.gradingType, q.correctAnswer, q.isRequired);
      setEditQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, imageUrl: data.url } : q));
    } finally {
      setQuestionUploading(null);
    }
  }

  function handleRemoveQuestionImage(questionId: string) {
    const q = getEditQuestion(questionId);
    if (q) startTransition(async () => { await updateQuestion(questionId, q.question, q.options, null, q.gradingType, q.correctAnswer, q.isRequired); });
    setEditQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, imageUrl: null } : q));
  }

  function handleGradingTypeChange(questionId: string, gradingType: string) {
    const clearAnswer = gradingType === "NONE";
    setEditQuestions((prev) => prev.map((q) => q.id === questionId
      ? { ...q, gradingType, correctAnswer: clearAnswer ? null : q.correctAnswer }
      : q));
    const q = getEditQuestion(questionId);
    if (q) startTransition(async () => {
      await updateQuestion(questionId, q.question, q.options, q.imageUrl, gradingType, clearAnswer ? null : q.correctAnswer, q.isRequired);
    });
  }

  function handleCorrectAnswerBlur(questionId: string, correctAnswer: string) {
    setEditQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, correctAnswer } : q));
    const q = getEditQuestion(questionId);
    if (q) startTransition(async () => {
      await updateQuestion(questionId, q.question, q.options, q.imageUrl, q.gradingType, correctAnswer, q.isRequired);
    });
  }

  function handleCorrectOptionChange(questionId: string, optionLabel: string) {
    setEditQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, correctAnswer: optionLabel } : q));
    const q = getEditQuestion(questionId);
    if (q) startTransition(async () => {
      await updateQuestion(questionId, q.question, q.options, q.imageUrl, q.gradingType, optionLabel, q.isRequired);
    });
  }

  function handleCorrectMultiOptionToggle(questionId: string, optionLabel: string) {
    const q = getEditQuestion(questionId);
    if (!q) return;
    let current: string[] = [];
    try { current = q.correctAnswer ? JSON.parse(q.correctAnswer) : []; } catch { current = []; }
    const next = current.includes(optionLabel)
      ? current.filter((o) => o !== optionLabel)
      : [...current, optionLabel];
    const correctAnswer = JSON.stringify(next);
    setEditQuestions((prev) => prev.map((qu) => qu.id === questionId ? { ...qu, correctAnswer } : qu));
    startTransition(async () => {
      await updateQuestion(questionId, q.question, q.options, q.imageUrl, q.gradingType, correctAnswer, q.isRequired);
    });
  }

  function handleRequiredChange(questionId: string, isRequired: boolean) {
    setEditQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, isRequired } : q));
    const q = getEditQuestion(questionId);
    if (q) startTransition(async () => {
      await updateQuestion(questionId, q.question, q.options, q.imageUrl, q.gradingType, q.correctAnswer, isRequired);
    });
  }

  function checkExact(q: Question, given: string): boolean {
    if (!q.correctAnswer) return false;
    if (q.type === "SHORT_ANSWER") {
      return given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
    }
    if (q.type === "SELECT") {
      return given === q.correctAnswer;
    }
    if (q.type === "MULTI_SELECT") {
      try {
        const givenArr: string[] = JSON.parse(given);
        const correctArr: string[] = JSON.parse(q.correctAnswer);
        return JSON.stringify([...givenArr].sort()) === JSON.stringify([...correctArr].sort());
      } catch { return false; }
    }
    return false;
  }

  function reorder<T>(arr: T[], from: number, to: number): T[] {
    const next = [...arr];
    next.splice(from, 1);
    next.splice(to, 0, arr[from]);
    return next;
  }

  function handleDragStartModule(id: string) {
    setDraggingId(id);
    dragType.current = "module";
    dragModuleId.current = null;
  }

  function handleDragStartTopic(id: string, moduleId: string) {
    setDraggingId(id);
    dragType.current = "topic";
    dragModuleId.current = moduleId;
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (overId !== draggingId) setDragOverId(overId);
  }

  function handleDropModule(targetId: string) {
    if (!draggingId || draggingId === targetId || dragType.current !== "module") return;
    const from = localModuleIds.indexOf(draggingId);
    const to = localModuleIds.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const newIds = reorder(localModuleIds, from, to);
    setLocalModuleIds(newIds);
    startTransition(async () => { await reorderModules(newIds); });
    setDraggingId(null);
    setDragOverId(null);
  }

  function handleDropTopic(targetId: string, moduleId: string) {
    if (!draggingId || draggingId === targetId || dragType.current !== "topic") return;
    const ids = localTopicIds[moduleId] ?? [];
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const newIds = reorder(ids, from, to);
    setLocalTopicIds((prev) => ({ ...prev, [moduleId]: newIds }));
    startTransition(async () => { await reorderTopics(moduleId, newIds); });
    setDraggingId(null);
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
  }

  function displayCorrectAnswer(q: Question): string {
    if (!q.correctAnswer) return "";
    if (q.type === "MULTI_SELECT") {
      try { return (JSON.parse(q.correctAnswer) as string[]).join(", "); } catch { return q.correctAnswer; }
    }
    return q.correctAnswer;
  }

  function handleAnswerChange(topicId: string, questionId: string, value: string) {
    setLocalAnswers((prev) => ({
      ...prev,
      [topicId]: { ...(prev[topicId] ?? {}), [questionId]: value },
    }));
    setSavedAnswerTopics((prev) => {
      const next = new Set(prev);
      next.delete(topicId);
      return next;
    });
    setAnswerFeedback((prev) => {
      const next = { ...prev };
      delete next[topicId];
      return next;
    });
  }

  function handlePrev(topicId: string) {
    setQuestionIndex((prev) => ({ ...prev, [topicId]: Math.max(0, (prev[topicId] ?? 0) - 1) }));
  }

  function handleNext(topicId: string, question: Question) {
    const ans = localAnswers[topicId]?.[question.id] ?? question.answers[0]?.answer ?? "";
    startTransition(async () => {
      if (ans.trim() !== "") {
        const res = await saveQuestionAnswers([{ questionId: question.id, answer: ans }]);
        if (res?.error) { setError(res.error); return; }
      }
      setQuestionIndex((prev) => ({ ...prev, [topicId]: (prev[topicId] ?? 0) + 1 }));
    });
  }

  function handleSubmitQuestions(topicId: string, questions: Question[], currentQ: Question) {
    const ans = localAnswers[topicId]?.[currentQ.id] ?? currentQ.answers[0]?.answer ?? "";
    startTransition(async () => {
      if (ans.trim() !== "") {
        const res = await saveQuestionAnswers([{ questionId: currentQ.id, answer: ans }]);
        if (res?.error) { setError(res.error); return; }
      }
      setSavedAnswerTopics((prev) => new Set([...prev, topicId]));
      const feedback: Record<string, { correct: boolean | null; modelAnswer: string | null }> = {};
      for (const q of questions) {
        const given = localAnswers[topicId]?.[q.id] ?? q.answers[0]?.answer ?? "";
        if (q.gradingType === "EXACT" && q.correctAnswer) {
          feedback[q.id] = { correct: checkExact(q, given), modelAnswer: q.correctAnswer };
        } else if (q.gradingType === "REFERENCE" && q.correctAnswer) {
          feedback[q.id] = { correct: null, modelAnswer: q.correctAnswer };
        }
      }
      setAnswerFeedback((prev) => ({ ...prev, [topicId]: feedback }));
    });
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Materials</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {modules.length} module{modules.length !== 1 ? "s" : ""} · {totalTopics} topic{totalTopics !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              <button
                onClick={() => setShowPDFImporter(true)}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Import PDF
              </button>
              <button
                onClick={() => setShowAddModule(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + Add Module
              </button>
            </>
          )}
        </div>
      </div>

      {/* New hire progress bar */}
      {isNewHire && totalTopics > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Progress</span>
            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{ackedCount} / {totalTopics} topics acknowledged</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${totalTopics > 0 ? Math.round((ackedCount / totalTopics) * 100) : 0}%` }}
            />
          </div>
          {ackedCount === totalTopics && totalTopics > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-2">🎉 All topics completed!</p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Empty state */}
      {modules.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-lg font-medium">No training materials yet</p>
          {isAdmin && <p className="text-sm mt-1">Click &quot;Add Module&quot; to get started.</p>}
        </div>
      )}

      {/* Modules */}
      <div className="space-y-6">
        {localModuleIds.map((modId, moduleIndex) => {
          const mod = modules.find((m) => m.id === modId);
          if (!mod) return null;
          const topicIds = localTopicIds[mod.id] ?? mod.topics.map((t) => t.id);
          const modTopics = topicIds.map((id) => mod.topics.find((t) => t.id === id)).filter(Boolean) as Topic[];
          const modAcked = modTopics.filter((t) => ackedIds.has(t.id)).length;
          const modComplete = modTopics.length > 0 && modAcked === modTopics.length;
          const isDraggingThis = draggingId === mod.id;
          const isDragOverThis = dragOverId === mod.id && dragType.current === "module";

          return (
            <div
              key={mod.id}
              id={`module-${mod.id}`}
              draggable={isAdmin}
              onDragStart={() => handleDragStartModule(mod.id)}
              onDragOver={(e) => isAdmin && handleDragOver(e, mod.id)}
              onDrop={() => isAdmin && handleDropModule(mod.id)}
              onDragEnd={handleDragEnd}
              className={`bg-white dark:bg-gray-900 rounded-xl border overflow-hidden transition-opacity ${isDraggingThis ? "opacity-40" : ""} ${isDragOverThis ? "border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-600" : "border-gray-200 dark:border-gray-700"}`}
            >
              {/* Module header */}
              <div
                className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4 cursor-pointer select-none"
                onClick={() => toggleModule(mod.id)}
              >
                <div className="flex items-start gap-3">
                  {isAdmin && (
                    <div
                      className="mt-1 shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      title="Drag to reorder"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
                    </div>
                  )}
                  <div className="mt-0.5">
                    {modComplete ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-sm">✓</span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs font-bold">{moduleIndex + 1}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 dark:text-white">{mod.title}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[mod.category] || CATEGORY_COLORS.GENERAL}`}>
                        {mod.category}
                      </span>
                    </div>
                    {mod.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{mod.description}</p>
                    )}
                    {(isAdmin || !isNewHire) && modTopics.length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{modAcked}/{modTopics.length} acknowledged</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAddTopic(mod.id); setAddTopicDirty(false); }}
                        className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg transition-colors"
                      >
                        + Topic
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingModule(mod); }}
                        className="text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchiveModule(mod.id); }}
                        className="text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        Archive
                      </button>
                    </>
                  )}
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={`text-gray-400 transition-transform duration-200 ${collapsedModules.has(mod.id) ? "" : "rotate-180"}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Topics + ack stats (collapsed when toggled) */}
              {!collapsedModules.has(mod.id) && (
              <><div className="space-y-3 p-4">
                {modTopics.length === 0 && isAdmin && (
                  <div className="px-3 py-3 text-sm text-gray-400 dark:text-gray-600 italic">No topics yet — click &quot;+ Topic&quot; to add one.</div>
                )}
                {modTopics.map((topic, topicIndex) => {
                  const acked = ackedIds.has(topic.id);
                  const unlocked = isNewHire ? isTopicUnlocked(topicIndex, moduleIndex, modules, ackedIds) : true;
                  const ackDate = topic.acknowledgments[0]?.acknowledgedAt;

                  const isContentExpanded = expandedContent.has(topic.id);
                  const contentLong = (topic.content?.length ?? 0) > 300;

                  const initialMax = topic.slideProgress[0]?.maxSlideReached ?? 0;
                  const localMax = slideMaxReached[topic.id] ?? initialMax;
                  const hasSlides = topic.slides.length > 0;
                  const slideGated = isNewHire && hasSlides && !acked && localMax < topic.slides.length - 1;
                  const videoGated = isNewHire && !!topic.videoUrl && !videoWatched[topic.id] && !acked;

                  const topicCollapsed = collapsedTopics.has(topic.id);
                  const hasBody = unlocked && (hasSlides || !!topic.content || !!topic.videoUrl);

                  // Same-module navigation
                  const sameModAllTopics = (localTopicIds[mod.id] ?? mod.topics.map(t => t.id))
                    .map(id => mod.topics.find(t => t.id === id))
                    .filter((t): t is Topic => !!t);
                  const currentIdxAll = sameModAllTopics.findIndex(t => t.id === topic.id);
                  const nextTopicInMod = currentIdxAll >= 0 && currentIdxAll < sameModAllTopics.length - 1
                    ? sameModAllTopics[currentIdxAll + 1] : undefined;
                  const sameModTopicsWithSlides = sameModAllTopics.filter(t => t.slides.length > 0);
                  const currentIdxSlides = sameModTopicsWithSlides.findIndex(t => t.id === topic.id);
                  const nextTopicWithSlides = currentIdxSlides >= 0 && currentIdxSlides < sameModTopicsWithSlides.length - 1
                    ? sameModTopicsWithSlides[currentIdxSlides + 1] : undefined;
                  const prevTopicWithSlides = currentIdxSlides > 0
                    ? sameModTopicsWithSlides[currentIdxSlides - 1] : undefined;

                  const isDraggingTopic = draggingId === topic.id;
                  const isDragOverTopic = dragOverId === topic.id && dragType.current === "topic";

                  return (
                    <div
                      key={topic.id}
                      id={`topic-${topic.id}`}
                      draggable={isAdmin}
                      onDragStart={(e) => { e.stopPropagation(); handleDragStartTopic(topic.id, mod.id); }}
                      onDragOver={(e) => { e.stopPropagation(); if (isAdmin) handleDragOver(e, topic.id); }}
                      onDrop={(e) => { e.stopPropagation(); if (isAdmin) handleDropTopic(topic.id, mod.id); }}
                      onDragEnd={(e) => { e.stopPropagation(); handleDragEnd(); }}
                      className={`bg-white dark:bg-gray-800 rounded-xl border transition-opacity ${!unlocked ? "opacity-50" : ""} ${isDraggingTopic ? "opacity-40" : ""} ${isDragOverTopic ? "border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-600" : "border-gray-200 dark:border-gray-700"}`}
                    >
                      {/* Topic header row — clickable to collapse */}
                      <div
                        className={`flex items-center gap-4 px-4 py-3 ${hasBody ? "cursor-pointer select-none" : ""}`}
                        onClick={() => hasBody && toggleTopic(topic.id)}
                      >
                        {/* Drag handle (admin only) */}
                        {isAdmin && (
                          <div
                            className="shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            title="Drag to reorder"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
                          </div>
                        )}
                        {/* Status icon */}
                        <div className="shrink-0 w-6 text-center">
                          {acked ? (
                            <span className="text-green-500 text-base">✓</span>
                          ) : unlocked ? (
                            <span className="text-gray-300 dark:text-gray-600 text-base">○</span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-sm">🔒</span>
                          )}
                        </div>

                        {/* Topic info */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm flex items-center gap-2 flex-wrap ${acked ? "text-gray-400 dark:text-gray-500" : unlocked ? "font-semibold text-gray-900 dark:text-white" : "font-medium text-gray-500 dark:text-gray-400"}`}>
                            <span>{topicIndex + 1}. {topic.title}</span>
                            {isAdmin && topic.questions.some((q) => q.isDraft) && (
                              <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full font-medium">
                                {topic.questions.filter((q) => q.isDraft).length} draft quiz
                              </span>
                            )}
                          </p>
                          {acked && ackDate && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                              Acknowledged on {new Date(ackDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                          {!unlocked && isNewHire && (
                            <p className="text-xs text-gray-400 mt-0.5">Complete the previous topic to unlock</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {topic.fileLink && unlocked && (
                            <a
                              href={topic.fileLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              Open ↗
                            </a>
                          )}
                          {isNewHire && !acked && unlocked && !previewingAs && slideGated && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (topicCollapsed) toggleTopic(topic.id);
                                slideViewerRefs.current[topic.id]?.current?.next();
                              }}
                              className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                            >
                              Next →
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingTopic({ ...topic, moduleId: mod.id }); setEditTopicContent(topic.content || ""); setEditTopicVideoUrl(topic.videoUrl ?? null); setEditQuestions(topic.questions.map((q) => ({ ...q, options: q.options ?? [], isDraft: q.isDraft ?? false }))); setEditTopicDirty(false); }}
                                className="text-xs px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleArchiveTopic(topic.id); }}
                                className="text-xs px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                              >
                                Archive
                              </button>
                            </>
                          )}
                          {hasBody && (
                            <svg
                              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                              className={`text-gray-400 transition-transform duration-200 ${topicCollapsed ? "" : "rotate-180"}`}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Topic body — slides + content + practice questions */}
                      {!topicCollapsed && hasBody && (
                        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                          {hasSlides && (() => {
                            const onNextTopicCb = nextTopicWithSlides ? () => {
                              if (collapsedTopics.has(nextTopicWithSlides.id)) toggleTopic(nextTopicWithSlides.id);
                              setTimeout(() => slideViewerRefs.current[nextTopicWithSlides.id]?.current?.openZoom(), 150);
                            } : undefined;
                            const onPrevTopicCb = prevTopicWithSlides ? () => {
                              if (collapsedTopics.has(prevTopicWithSlides.id)) toggleTopic(prevTopicWithSlides.id);
                              setTimeout(() => slideViewerRefs.current[prevTopicWithSlides.id]?.current?.openZoom(prevTopicWithSlides.slides.length - 1), 150);
                            } : undefined;
                            const mergedAnswers: Record<string, string> = {};
                            topic.questions.forEach(q => {
                              mergedAnswers[q.id] = localAnswers[topic.id]?.[q.id] ?? q.answers[0]?.answer ?? "";
                            });
                            const shuffledQs = isNewHire && !previewingAs && newHireId
                              ? seededShuffle(topic.questions, hashString(newHireId + topic.id))
                              : topic.questions;
                            return (
                              <SlideViewer
                                ref={(() => {
                                  if (!slideViewerRefs.current[topic.id]) {
                                    slideViewerRefs.current[topic.id] = React.createRef<SlideViewerHandle>();
                                  }
                                  return slideViewerRefs.current[topic.id];
                                })()}
                                slides={topic.slides}
                                topicId={topic.id}
                                isNewHire={isNewHire && !previewingAs}
                                initialMaxReached={localMax}
                                onProgressChange={(max) => setSlideMaxReached((prev) => ({ ...prev, [topic.id]: max }))}
                                onNextTopic={onNextTopicCb}
                                nextTopicTitle={nextTopicWithSlides?.title}
                                onPrevTopic={onPrevTopicCb}
                                prevTopicTitle={prevTopicWithSlides?.title}
                                videoUrl={topic.videoUrl ?? undefined}
                                onVideoWatched={() => setVideoWatched(prev => ({ ...prev, [topic.id]: true }))}
                                questions={isNewHire && !previewingAs ? shuffledQs : undefined}
                                initialAnswers={mergedAnswers}
                                onSlideAdvance={(newIndex) => {
                                  if (isNewHire && !previewingAs && newIndex > localMax) {
                                    setSlideMaxReached((prev) => ({ ...prev, [topic.id]: newIndex }));
                                    startTransition(() => { updateSlideProgress(topic.id, newIndex); });
                                  }
                                }}
                                onSaveAnswers={(answers) => {
                                  const entries = Object.entries(answers).filter(([, v]) => v.trim() !== "");
                                  if (entries.length > 0) {
                                    startTransition(async () => {
                                      await saveQuestionAnswers(entries.map(([questionId, answer]) => ({ questionId, answer })));
                                      entries.forEach(([questionId, answer]) => handleAnswerChange(topic.id, questionId, answer));
                                      setSavedAnswerTopics(prev => new Set([...prev, topic.id]));
                                    });
                                  } else {
                                    setSavedAnswerTopics(prev => new Set([...prev, topic.id]));
                                  }
                                }}
                              />
                            );
                          })()}
                          {topic.videoUrl && (
                            <div className={hasSlides ? "mt-3" : ""} onClick={(e) => e.stopPropagation()}>
                              <video
                                controls
                                src={topic.videoUrl}
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700"
                                style={{ maxWidth: "100%" }}
                                onEnded={() => setVideoWatched(prev => ({ ...prev, [topic.id]: true }))}
                              />
                              {isNewHire && !previewingAs && !acked && !videoWatched[topic.id] && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                                  Watch the full video to enable completion
                                </p>
                              )}
                            </div>
                          )}
                          {topic.content && (
                            <div className={hasSlides || topic.videoUrl ? "mt-3" : ""}>
                              <div
                                className={`rte-content text-sm text-gray-700 dark:text-gray-300 overflow-hidden transition-all ${!isContentExpanded && contentLong ? "max-h-24" : ""}`}
                                dangerouslySetInnerHTML={{ __html: topic.content }}
                              />
                              {contentLong && (
                                <button
                                  onClick={() => setExpandedContent((prev) => {
                                    const next = new Set(prev);
                                    isContentExpanded ? next.delete(topic.id) : next.add(topic.id);
                                    return next;
                                  })}
                                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                                >
                                  {isContentExpanded ? "Show less" : "Read more"}
                                </button>
                              )}
                            </div>
                          )}
                          {/* Practice Questions — new hire view (one at a time) */}
                          {topic.questions.length > 0 && isNewHire && (() => {
                            const shuffled = newHireId
                              ? seededShuffle(topic.questions, hashString(newHireId + topic.id))
                              : topic.questions;
                            const hasPrev = hasSlides || !!topic.content;
                            const submitted = savedAnswerTopics.has(topic.id);
                            const idx = questionIndex[topic.id] ?? 0;
                            const current = shuffled[Math.min(idx, shuffled.length - 1)];
                            const isLast = idx >= shuffled.length - 1;
                            const localAns = localAnswers[topic.id]?.[current.id] ?? current.answers[0]?.answer ?? "";
                            const canAdvance = !current.isRequired || localAns.trim() !== "";
                            const answeredCount = shuffled.filter((q) =>
                              (localAnswers[topic.id]?.[q.id] ?? q.answers[0]?.answer ?? "") !== ""
                            ).length;

                            return (
                              <div className={hasPrev ? "mt-4 pt-4 border-t border-gray-100 dark:border-gray-700" : ""}>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Practice Questions</p>
                                  {!submitted && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      Q {idx + 1} of {shuffled.length} &nbsp;·&nbsp; {answeredCount} answered
                                    </span>
                                  )}
                                </div>

                                {submitted ? (
                                  /* Summary view after submission */
                                  <div className="space-y-3">
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Questions completed ({answeredCount}/{shuffled.length} answered)</p>
                                    {shuffled.map((q, qi) => {
                                      const ans = localAnswers[topic.id]?.[q.id] ?? q.answers[0]?.answer ?? "";
                                      const fb = answerFeedback[topic.id]?.[q.id];
                                      if (!ans) return null;
                                      return (
                                        <div key={q.id} className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2">
                                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">{qi + 1}. {q.question}</p>
                                          <p className="text-xs text-gray-600 dark:text-gray-400">
                                            {q.type === "MULTI_SELECT"
                                              ? (() => { try { return (JSON.parse(ans) as string[]).join(", "); } catch { return ans; } })()
                                              : ans}
                                          </p>
                                          {fb && fb.correct === true && <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 font-medium">✓ Correct</p>}
                                          {fb && fb.correct === false && (
                                            <p className="text-xs text-red-500 mt-0.5">✗ Incorrect — Correct: <span className="text-gray-700 dark:text-gray-300">{displayCorrectAnswer(q)}</span></p>
                                          )}
                                          {fb && fb.correct === null && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">Model: {fb.modelAnswer}</p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  /* One-at-a-time question view */
                                  <div>
                                    {/* Question header */}
                                    <div className="flex items-start gap-2 mb-2">
                                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">
                                        {current.question || <span className="italic text-gray-400">No question text</span>}
                                      </p>
                                      {current.isRequired && (
                                        <span className="shrink-0 text-xs px-1.5 py-0.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-medium">Required</span>
                                      )}
                                    </div>
                                    {current.imageUrl && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={current.imageUrl} alt="" className="rounded-lg mb-2 max-w-full max-h-48 object-contain" />
                                    )}

                                    {/* Answer input */}
                                    {current.type === "SHORT_ANSWER" && (
                                      <textarea
                                        key={current.id}
                                        value={localAns}
                                        onChange={(e) => handleAnswerChange(topic.id, current.id, e.target.value)}
                                        placeholder="Type your answer here…"
                                        rows={3}
                                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                      />
                                    )}
                                    {current.type === "SELECT" && (current.options ?? []).map((opt, oi) => (
                                      <label key={oi} className="flex items-center gap-2 mb-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`q-${current.id}`}
                                          value={opt}
                                          checked={localAns === opt}
                                          onChange={() => handleAnswerChange(topic.id, current.id, opt)}
                                          className="accent-indigo-600"
                                        />
                                        {opt}
                                      </label>
                                    ))}
                                    {current.type === "MULTI_SELECT" && (current.options ?? []).map((opt, oi) => {
                                      let selected: string[] = [];
                                      try { selected = JSON.parse(localAns || "[]") as string[]; } catch { selected = []; }
                                      return (
                                        <label key={oi} className="flex items-center gap-2 mb-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={selected.includes(opt)}
                                            onChange={(e) => {
                                              let cur: string[] = [];
                                              try { cur = JSON.parse(localAns || "[]") as string[]; } catch { cur = []; }
                                              const next = e.target.checked ? [...cur, opt] : cur.filter((x) => x !== opt);
                                              handleAnswerChange(topic.id, current.id, JSON.stringify(next));
                                            }}
                                            className="accent-indigo-600"
                                          />
                                          {opt}
                                        </label>
                                      );
                                    })}

                                    {/* Required + empty warning */}
                                    {current.isRequired && localAns.trim() === "" && (
                                      <p className="text-xs text-red-500 mt-1">This question is required.</p>
                                    )}

                                    {/* Navigation */}
                                    <div className="flex items-center justify-between mt-3">
                                      <button
                                        type="button"
                                        onClick={() => handlePrev(topic.id)}
                                        disabled={idx === 0 || pending}
                                        className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                      >
                                        ← Prev
                                      </button>
                                      {isLast ? (
                                        <button
                                          type="button"
                                          onClick={() => handleSubmitQuestions(topic.id, shuffled, current)}
                                          disabled={!canAdvance || pending}
                                          title={!canAdvance ? "Answer this required question first" : undefined}
                                          className="text-xs px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                          Submit
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleNext(topic.id, current)}
                                          disabled={!canAdvance || pending}
                                          title={!canAdvance ? "Answer this required question first" : undefined}
                                          className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                          Next →
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Complete button at bottom of expanded body */}
                          {isNewHire && !acked && unlocked && !previewingAs && !slideGated && (
                            <div className="pt-3 flex justify-end border-t border-gray-100 dark:border-gray-700 mt-3">
                              <button
                                onClick={() => {
                                  const mandatoryUnanswered = topic.questions.some((q) =>
                                    q.isRequired && (localAnswers[topic.id]?.[q.id] ?? q.answers[0]?.answer ?? "") === ""
                                  );
                                  const answeredTotal = topic.questions.filter((q) =>
                                    (localAnswers[topic.id]?.[q.id] ?? q.answers[0]?.answer ?? "") !== ""
                                  ).length;
                                  const minReq = topic.minQuestionsRequired ?? 0;
                                  const qGated = topic.questions.length > 0 && (mandatoryUnanswered || (minReq > 0 && answeredTotal < minReq));
                                  if (!videoGated && !qGated) handleAcknowledge(topic.id);
                                }}
                                disabled={(() => {
                                  const mandatoryUnanswered = topic.questions.some((q) =>
                                    q.isRequired && (localAnswers[topic.id]?.[q.id] ?? q.answers[0]?.answer ?? "") === ""
                                  );
                                  const answeredTotal = topic.questions.filter((q) =>
                                    (localAnswers[topic.id]?.[q.id] ?? q.answers[0]?.answer ?? "") !== ""
                                  ).length;
                                  const minReq = topic.minQuestionsRequired ?? 0;
                                  const questionGated = topic.questions.length > 0 && (mandatoryUnanswered || (minReq > 0 && answeredTotal < minReq));
                                  return ackingId === topic.id || pending || videoGated || questionGated;
                                })()}
                                title={(() => {
                                  if (videoGated) return "Watch the full video first";
                                  const mandatoryUnanswered = topic.questions.some((q) =>
                                    q.isRequired && (localAnswers[topic.id]?.[q.id] ?? q.answers[0]?.answer ?? "") === ""
                                  );
                                  const answeredTotal = topic.questions.filter((q) =>
                                    (localAnswers[topic.id]?.[q.id] ?? q.answers[0]?.answer ?? "") !== ""
                                  ).length;
                                  const minReq = topic.minQuestionsRequired ?? 0;
                                  if (mandatoryUnanswered) return "Answer all required questions first";
                                  if (minReq > 0 && answeredTotal < minReq) return `Answer at least ${minReq} question${minReq !== 1 ? "s" : ""} first (${answeredTotal}/${minReq} done)`;
                                  return undefined;
                                })()}
                                className="text-sm px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {ackingId === topic.id ? "Saving…" : "Complete"}
                              </button>
                            </div>
                          )}

                          {/* Next Topic in module button */}
                          {nextTopicInMod && (
                            <div className="pt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  if (collapsedTopics.has(nextTopicInMod.id)) toggleTopic(nextTopicInMod.id);
                                  setTimeout(() => {
                                    document.getElementById(`topic-${nextTopicInMod.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  }, 100);
                                }}
                                className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium px-4 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                              >
                                Next: {nextTopicInMod.title}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Admin: ack stats expandable */}
              {isAdmin && ackStats.length > 0 && modTopics.length > 0 && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => setExpandedAck(expandedAck === mod.id ? null : mod.id)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    {expandedAck === mod.id ? "▲ Hide" : "▼"} Acknowledgments ({ackStats.length})
                  </button>
                  {expandedAck === mod.id && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="text-gray-400 dark:text-gray-500 text-left">
                            <th className="pb-2 font-medium pr-4">New Hire</th>
                            <th className="pb-2 font-medium pr-4">Role</th>
                            <th className="pb-2 font-medium pr-4">Acknowledged</th>
                            {modTopics.some((t) => t.slides.length > 0) && (
                              <th className="pb-2 font-medium pr-4">Topic</th>
                            )}
                            {modTopics.some((t) => t.questions.length > 0) && (
                              <th className="pb-2 font-medium pr-4">Q&amp;A</th>
                            )}
                            {modTopics.some((t) => t.questions.some((q) => q.gradingType === "EXACT")) && (
                              <th className="pb-2 font-medium">Score</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                          {ackStats.map((nh) => {
                            const nhAcked = modTopics.filter((t) =>
                              nh.topicAcknowledgments.some((a) => a.topicId === t.id)
                            ).length;
                            const topicsWithSlides = modTopics.filter((t) => t.slides.length > 0);
                            const slidesViewed = topicsWithSlides.filter((t) => {
                              const sp = nh.slideProgress.find((p) => p.topicId === t.id);
                              return (sp?.maxSlideReached ?? -1) >= t.slides.length - 1;
                            }).length;
                            return (
                              <tr key={nh.id}>
                                <td className="py-1.5 text-gray-700 dark:text-gray-300 pr-4">{nh.name}</td>
                                <td className="py-1.5 text-gray-500 dark:text-gray-400 pr-4">{nh.role}</td>
                                <td className="py-1.5 pr-4">
                                  <span className={nhAcked === modTopics.length ? "text-green-600 dark:text-green-400 font-medium" : "text-gray-500 dark:text-gray-400"}>
                                    {nhAcked}/{modTopics.length}
                                  </span>
                                </td>
                                {modTopics.some((t) => t.slides.length > 0) && (
                                  <td className="py-1.5 text-gray-500 dark:text-gray-400 pr-4">{slidesViewed}/{topicsWithSlides.length}</td>
                                )}
                                {modTopics.some((t) => t.questions.length > 0) && (() => {
                                  const totalQ = modTopics.reduce((s, t) => s + t.questions.length, 0);
                                  const answeredQ = modTopics.reduce((s, t) =>
                                    s + t.questions.filter((q) => nh.questionAnswers.some((a) => a.questionId === q.id)).length, 0);
                                  return (
                                    <td className="py-1.5 text-gray-500 dark:text-gray-400 pr-4">{answeredQ}/{totalQ}</td>
                                  );
                                })()}
                                {modTopics.some((t) => t.questions.some((q) => q.gradingType === "EXACT")) && (() => {
                                  const gradeable = modTopics.flatMap((t) => t.questions.filter((q) => q.gradingType === "EXACT" && q.correctAnswer));
                                  const correct = gradeable.filter((q) => {
                                    const ans = nh.questionAnswers.find((a) => a.questionId === q.id);
                                    if (!ans) return false;
                                    if (q.type === "SHORT_ANSWER") return ans.answer.trim().toLowerCase() === q.correctAnswer!.trim().toLowerCase();
                                    if (q.type === "MULTI_SELECT") {
                                      try {
                                        const given = (JSON.parse(ans.answer) as string[]).slice().sort().join("|");
                                        const expected = (JSON.parse(q.correctAnswer!) as string[]).slice().sort().join("|");
                                        return given === expected;
                                      } catch { return false; }
                                    }
                                    return ans.answer === q.correctAnswer;
                                  });
                                  const pct = gradeable.length > 0 ? Math.round((correct.length / gradeable.length) * 100) : null;
                                  return (
                                    <td className="py-1.5 font-medium">
                                      {pct === null ? (
                                        <span className="text-gray-400">—</span>
                                      ) : (
                                        <span className={pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400"}>
                                          {correct.length}/{gradeable.length} ({pct}%)
                                        </span>
                                      )}
                                    </td>
                                  );
                                })()}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              </>)}
            </div>
          );
        })}
      </div>

      {/* ── Modals ── */}

      {/* PDF Importer */}
      {showPDFImporter && (
        <PDFImporter
          modules={localModuleIds.map(id => modules.find(m => m.id === id)!).filter(Boolean).map(m => ({ id: m.id, title: m.title }))}
          onClose={() => { setShowPDFImporter(false); router.refresh(); }}
        />
      )}

      {/* Add Module */}
      {showAddModule && (
        <Modal title="Add Module" onClose={() => setShowAddModule(false)}>
          <form onSubmit={handleAddModule} className="space-y-4">
            <Field label="Title" name="title" required />
            <Field label="Description" name="description" textarea />
            <SelectField label="Category" name="category" options={CATEGORIES} required />
            <RolesField />
            <ModalActions onCancel={() => setShowAddModule(false)} pending={pending} submitLabel="Add Module" />
          </form>
        </Modal>
      )}

      {/* Edit Module */}
      {editingModule && (
        <Modal title="Edit Module" onClose={() => setEditingModule(null)}>
          <form onSubmit={handleEditModule} className="space-y-4">
            <input type="hidden" name="id" value={editingModule.id} />
            <Field label="Title" name="title" defaultValue={editingModule.title} required />
            <Field label="Description" name="description" textarea defaultValue={editingModule.description || ""} />
            <SelectField label="Category" name="category" options={CATEGORIES} defaultValue={editingModule.category} required />
            <RolesField defaultValue={editingModule.requiredForRoles} />
            <ModalActions onCancel={() => setEditingModule(null)} pending={pending} submitLabel="Save" />
          </form>
        </Modal>
      )}

      {/* Add Topic */}
      {showAddTopic && (
        <Modal title="Add Topic" onClose={() => { if (addTopicDirty && !confirm("Discard unsaved changes?")) return; setShowAddTopic(null); setAddTopicContent(""); setAddTopicDirty(false); }}>
          <form onSubmit={handleAddTopic} onChange={() => setAddTopicDirty(true)} className="space-y-4">
            <input type="hidden" name="moduleId" value={showAddTopic} />
            <Field label="Title" name="title" required />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content <span className="text-gray-400 font-normal">(optional)</span></label>
              <RichTextEditor value={addTopicContent} onChange={(v) => { setAddTopicContent(v); setAddTopicDirty(true); }} />
            </div>
            <Field label="Google Drive Link" name="fileLink" placeholder="https://drive.google.com/..." />
            <ModalActions onCancel={() => { if (addTopicDirty && !confirm("Discard unsaved changes?")) return; setShowAddTopic(null); setAddTopicContent(""); setAddTopicDirty(false); }} pending={pending} submitLabel="Add Topic" />
          </form>
        </Modal>
      )}

      {/* Edit Topic */}
      {editingTopic && (
        <Modal title="Edit Topic" onClose={() => { if (editTopicDirty && !confirm("Discard unsaved changes?")) return; setEditingTopic(null); setEditTopicVideoUrl(null); setEditTopicDirty(false); }}>
          <form onSubmit={handleEditTopic} onChange={() => setEditTopicDirty(true)} className="space-y-4">
            <input type="hidden" name="id" value={editingTopic.id} />
            <Field label="Title" name="title" defaultValue={editingTopic.title} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content <span className="text-gray-400 font-normal">(optional)</span></label>
              <RichTextEditor value={editTopicContent} onChange={(v) => { setEditTopicContent(v); setEditTopicDirty(true); }} />
            </div>
            <Field label="Google Drive Link" name="fileLink" defaultValue={editingTopic.fileLink || ""} placeholder="https://drive.google.com/..." />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min. questions to answer <span className="text-gray-400 font-normal">(0 = no minimum; {editingTopic.questions.length} question{editingTopic.questions.length !== 1 ? "s" : ""} total)</span>
              </label>
              <input
                type="number"
                name="minQuestionsRequired"
                min={0}
                max={editingTopic.questions.length}
                defaultValue={editingTopic.minQuestionsRequired ?? 0}
                key={`minq-${editingTopic.id}`}
                className="w-28 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Slide manager */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Slides <span className="text-gray-400 font-normal">(optional)</span></label>
                <button
                  type="button"
                  disabled={slideUploading}
                  onClick={() => slideFileRef.current?.click()}
                  className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  {slideUploading ? "Uploading…" : "+ Add Slide"}
                </button>
                <input
                  ref={slideFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleSlideUpload(editingTopic.id, e)}
                />
              </div>

              {editingTopic.slides.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2">No slides yet. Upload PNG images exported from Google Slides.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {[...editingTopic.slides].sort((a, b) => a.order - b.order).map((slide, idx) => (
                    <div key={slide.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                      {/* Thumbnail */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={slide.imageUrl} alt={`Slide ${idx + 1}`} className="w-16 h-10 object-cover rounded border border-gray-200 dark:border-gray-700 shrink-0" />

                      {/* Order badge */}
                      <span className="text-xs text-gray-400 shrink-0 w-5 text-center">{idx + 1}</span>

                      {/* Caption input */}
                      <input
                        type="text"
                        defaultValue={slide.caption ?? ""}
                        placeholder="Caption (optional)"
                        onBlur={(e) => handleCaptionChange(slide.id, e.target.value)}
                        className="flex-1 min-w-0 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />

                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveSlide(editingTopic, slide.id, -1)}
                          className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="Move up"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button
                          type="button"
                          disabled={idx === editingTopic.slides.length - 1}
                          onClick={() => handleMoveSlide(editingTopic, slide.id, 1)}
                          className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="Move down"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="shrink-0 p-1 text-red-400 hover:text-red-600 transition-colors"
                        title="Delete slide"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Video <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                {!editTopicVideoUrl && (
                  <button
                    type="button"
                    disabled={videoUploading}
                    onClick={() => videoFileRef.current?.click()}
                    className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {videoUploading ? "Uploading…" : "+ Video"}
                  </button>
                )}
                <input ref={videoFileRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleVideoUpload} />
              </div>
              {editTopicVideoUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <video controls src={editTopicVideoUrl} className="w-full" style={{ maxHeight: 240 }} />
                  <button
                    type="button"
                    onClick={() => { setEditTopicVideoUrl(null); setEditTopicDirty(true); }}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">No video uploaded.</p>
              )}
            </div>

            {/* AI Draft Quiz review panel */}
            {editQuestions.some((q) => q.isDraft) && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 dark:text-amber-400 shrink-0"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    AI Draft Quiz — {editQuestions.filter((q) => q.isDraft).length} question{editQuestions.filter((q) => q.isDraft).length !== 1 ? "s" : ""} pending review
                  </p>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">These questions were auto-generated from the topic content. Approve to publish or delete to discard.</p>
                <div className="space-y-3">
                  {editQuestions.filter((q) => q.isDraft).map((q) => (
                    <div key={q.id} className="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-700 p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{q.question}</p>
                        <span className="shrink-0 text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full font-medium">{q.type === "SHORT_ANSWER" ? "Short Answer" : q.type === "SELECT" ? "Single Choice" : "Multi Choice"}</span>
                      </div>
                      {q.options && q.options.length > 0 && (
                        <ul className="mt-1 mb-2 space-y-0.5 pl-2">
                          {q.options.map((opt, oi) => (
                            <li key={oi} className={`text-xs flex items-center gap-1.5 ${opt === q.correctAnswer || (q.type === "MULTI_SELECT" && (() => { try { return (JSON.parse(q.correctAnswer ?? "[]") as string[]).includes(opt); } catch { return false; } })()) ? "text-green-700 dark:text-green-400 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
                              <span>{opt === q.correctAnswer || (q.type === "MULTI_SELECT" && (() => { try { return (JSON.parse(q.correctAnswer ?? "[]") as string[]).includes(opt); } catch { return false; } })()) ? "✓" : "·"}</span>
                              {opt}
                            </li>
                          ))}
                        </ul>
                      )}
                      {q.type === "SHORT_ANSWER" && q.correctAnswer && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">Model answer: {q.correctAnswer}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleApproveDraft(q.id)}
                          disabled={pending}
                          className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-40"
                        >
                          ✓ Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="text-xs px-3 py-1.5 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Practice Questions manager */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Practice Questions <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleAddQuestion(editingTopic.id)}
                  className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  + Question
                </button>
              </div>
              {editQuestions.filter((q) => !q.isDraft).length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2">No questions yet.</p>
              ) : (
                <div className="space-y-3">
                  {editQuestions.filter((q) => !q.isDraft).map((q, qi) => (
                    <div key={q.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-400 mt-2.5 shrink-0">{qi + 1}.</span>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <select
                              value={q.type}
                              onChange={(e) => handleQuestionTypeChange(q.id, e.target.value)}
                              className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="SHORT_ANSWER">Short Answer</option>
                              <option value="SELECT">Single Choice</option>
                              <option value="MULTI_SELECT">Multiple Choice</option>
                            </select>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer text-gray-600 dark:text-gray-400 select-none">
                              <input
                                type="checkbox"
                                checked={q.isRequired}
                                onChange={(e) => handleRequiredChange(q.id, e.target.checked)}
                                className="accent-indigo-600"
                              />
                              Required
                            </label>
                          </div>
                          <input
                            type="text"
                            defaultValue={q.question}
                            key={`${q.id}-text`}
                            placeholder="Question text…"
                            onBlur={(e) => handleQuestionTextBlur(q.id, e.target.value)}
                            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          {/* Question image */}
                          {q.imageUrl ? (
                            <div className="flex items-center gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={q.imageUrl} alt="" className="h-10 rounded border border-gray-200 dark:border-gray-700" />
                              <button
                                type="button"
                                onClick={() => handleRemoveQuestionImage(q.id)}
                                className="text-xs text-red-500 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={questionUploading === q.id}
                              onClick={() => questionImageRefsMap.current[q.id]?.click()}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                            >
                              {questionUploading === q.id ? "Uploading…" : "+ Add photo"}
                            </button>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={(el) => { questionImageRefsMap.current[q.id] = el; }}
                            onChange={(e) => handleQuestionImageUpload(q.id, e)}
                          />
                          {/* Options for SELECT / MULTI_SELECT */}
                          {(q.type === "SELECT" || q.type === "MULTI_SELECT") && (
                            <div className="space-y-1 pl-1">
                              {q.options.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => handleOptionChange(q.id, oi, e.target.value)}
                                    onBlur={() => handleOptionBlur(q.id)}
                                    placeholder={`Option ${oi + 1}`}
                                    className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOption(q.id, oi)}
                                    className="p-0.5 text-red-400 hover:text-red-600"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => handleAddOption(q.id)}
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5"
                              >
                                + Option
                              </button>
                            </div>
                          )}
                          {/* Grading / answer key */}
                          <div className="pt-1 space-y-1.5 border-t border-gray-100 dark:border-gray-700 mt-2">
                            <select
                              value={q.gradingType}
                              onChange={(e) => handleGradingTypeChange(q.id, e.target.value)}
                              className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="NONE">No answer key</option>
                              <option value="EXACT">Exact answer (auto-grade)</option>
                              <option value="REFERENCE">Reference answer (show model)</option>
                            </select>
                            {q.gradingType === "EXACT" && q.type === "SHORT_ANSWER" && (
                              <input
                                type="text"
                                defaultValue={q.correctAnswer ?? ""}
                                key={`${q.id}-ca`}
                                placeholder="Correct answer…"
                                onBlur={(e) => handleCorrectAnswerBlur(q.id, e.target.value)}
                                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            )}
                            {q.gradingType === "EXACT" && q.type === "SELECT" && q.options.length > 0 && (
                              <div className="space-y-0.5 pl-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Correct option:</p>
                                {q.options.map((opt, oi) => (
                                  <label key={oi} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`correct-${q.id}`}
                                      checked={q.correctAnswer === opt}
                                      onChange={() => handleCorrectOptionChange(q.id, opt)}
                                    />
                                    <span className="text-gray-700 dark:text-gray-300">{opt || `Option ${oi + 1}`}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                            {q.gradingType === "EXACT" && q.type === "MULTI_SELECT" && q.options.length > 0 && (
                              <div className="space-y-0.5 pl-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Correct options:</p>
                                {q.options.map((opt, oi) => {
                                  let checked = false;
                                  try { checked = q.correctAnswer ? (JSON.parse(q.correctAnswer) as string[]).includes(opt) : false; } catch { checked = false; }
                                  return (
                                    <label key={oi} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => handleCorrectMultiOptionToggle(q.id, opt)}
                                      />
                                      <span className="text-gray-700 dark:text-gray-300">{opt || `Option ${oi + 1}`}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            {q.gradingType === "REFERENCE" && (
                              <textarea
                                defaultValue={q.correctAnswer ?? ""}
                                key={`${q.id}-ref`}
                                placeholder="Model answer…"
                                rows={2}
                                onBlur={(e) => handleCorrectAnswerBlur(q.id, e.target.value)}
                                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                              />
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="shrink-0 p-1 text-red-400 hover:text-red-600 mt-1"
                          title="Delete question"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddQuestion(editingTopic.id)}
                    className="w-full mt-1 text-xs px-3 py-2 border border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                  >
                    + Question
                  </button>
                </div>
              )}
            </div>

            <ModalActions onCancel={() => { if (editTopicDirty && !confirm("Discard unsaved changes?")) return; setEditingTopic(null); setEditTopicVideoUrl(null); setEditTopicDirty(false); }} pending={pending} submitLabel="Save" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Helper sub-components ──────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, name, required, textarea, defaultValue, placeholder }: { label: string; name: string; required?: boolean; textarea?: boolean; defaultValue?: string; placeholder?: string }) {
  const cls = "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {textarea
        ? <textarea name={name} defaultValue={defaultValue} className={cls} rows={3} />
        : <input name={name} defaultValue={defaultValue} placeholder={placeholder} required={required} className={cls} />
      }
    </div>
  );
}

function SelectField({ label, name, options, defaultValue, required }: { label: string; name: string; options: string[]; defaultValue?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <select name={name} defaultValue={defaultValue || options[0]} required={required} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function RolesField({ defaultValue }: { defaultValue?: string }) {
  let parsed: string[] = [];
  try { parsed = defaultValue && defaultValue !== "ALL" ? JSON.parse(defaultValue) : []; } catch { parsed = []; }
  const isAll = !defaultValue || defaultValue === "ALL" || parsed.length === 0;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Required For Roles</label>
      <select
        name="requiredForRoles"
        defaultValue={isAll ? "ALL" : parsed.join(",")}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="ALL">All new hires</option>
        {["COS", "PIS", "OSM", "AE", "BILLING_COLLECTION", "OTHERS"].map((r) => (
          <option key={r} value={JSON.stringify([r])}>{r} only</option>
        ))}
        <option value={JSON.stringify(["COS", "PIS", "OSM"])}>COS + PIS + OSM</option>
        <option value={JSON.stringify(["PIS", "OSM"])}>PIS + OSM (Menu track)</option>
      </select>
    </div>
  );
}

function ModalActions({ onCancel, pending, submitLabel }: { onCancel: () => void; pending: boolean; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
        Cancel
      </button>
      <button type="submit" disabled={pending} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors">
        {pending ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}
