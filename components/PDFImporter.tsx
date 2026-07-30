"use client";

import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { createTopicForImport, addSlidesBatch } from "@/app/actions/training-materials";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type Module = { id: string; title: string };

interface PDFImporterProps {
  modules: Module[];
  onClose: () => void;
}

type TopicDef = { name: string; pages: number[] }; // pages are 1-based, sorted

const TOPIC_COLORS = [
  "border-blue-400 bg-blue-50 dark:bg-blue-900/20",
  "border-green-400 bg-green-50 dark:bg-green-900/20",
  "border-purple-400 bg-purple-50 dark:bg-purple-900/20",
  "border-amber-400 bg-amber-50 dark:bg-amber-900/20",
  "border-rose-400 bg-rose-50 dark:bg-rose-900/20",
  "border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20",
];

const TOPIC_THUMB_COLORS = [
  "border-blue-400 bg-blue-50",
  "border-green-400 bg-green-50",
  "border-purple-400 bg-purple-50",
  "border-amber-400 bg-amber-50",
  "border-rose-400 bg-rose-50",
  "border-cyan-400 bg-cyan-50",
];

const TOPIC_BADGES = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

const TOPIC_CHIPS = [
  "bg-blue-200 text-blue-800",
  "bg-green-200 text-green-800",
  "bg-purple-200 text-purple-800",
  "bg-amber-200 text-amber-800",
  "bg-rose-200 text-rose-800",
  "bg-cyan-200 text-cyan-800",
];

export default function PDFImporter({ modules, onClose }: PDFImporterProps) {
  const [step, setStep] = useState<"upload" | "define" | "import" | "done">("upload");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [topics, setTopics] = useState<TopicDef[]>([{ name: "", pages: [] }]);
  const [activeTopic, setActiveTopic] = useState(0);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState(modules[0]?.id ?? "");
  const [importProgress, setImportProgress] = useState<{ topic: number; totalTopics: number; slide: number; totalSlides: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const fullCanvasesRef = useRef<HTMLCanvasElement[]>([]);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickedRef = useRef<number | null>(null); // last single-clicked page (1-based)

  // Escape key closes preview
  useEffect(() => {
    if (previewPage === null) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setPreviewPage(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewPage]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setRenderProgress(0);
    setStep("define");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const count = pdf.numPages;
      setPageCount(count);
      fullCanvasesRef.current = [];

      const thumbs: string[] = [];
      for (let i = 1; i <= count; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = viewport.width;
        fullCanvas.height = viewport.height;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (page.render as any)({ canvasContext: fullCanvas.getContext("2d"), viewport }).promise;
        fullCanvasesRef.current.push(fullCanvas);

        const thumbScale = 180 / viewport.width;
        const thumbVp = page.getViewport({ scale: thumbScale });
        const thumbCanvas = document.createElement("canvas");
        thumbCanvas.width = thumbVp.width;
        thumbCanvas.height = thumbVp.height;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (page.render as any)({ canvasContext: thumbCanvas.getContext("2d"), viewport: thumbVp }).promise;
        thumbs.push(thumbCanvas.toDataURL("image/jpeg", 0.75));

        setRenderProgress(i);
      }

      setThumbnails(thumbs);
      // Start with no pages assigned — user selects manually
      setTopics([{ name: "", pages: [] }]);
      setActiveTopic(0);
      lastClickedRef.current = null;
    } catch (err) {
      setError("Failed to read PDF: " + (err as Error).message);
      setStep("upload");
    }
  }

  function getTopicIndex(pageNum: number): number {
    for (let i = 0; i < topics.length; i++) {
      if (topics[i].pages.includes(pageNum)) return i;
    }
    return -1;
  }

  // Assign a set of page numbers to active topic (move from other topics)
  function assignPages(pageNums: number[]) {
    const pageSet = new Set(pageNums);
    setTopics(prev => prev.map((t, i) => {
      if (i === activeTopic) {
        // Toggle: if ALL in set are already in this topic, remove them; otherwise add all
        const allAlready = pageNums.every(p => t.pages.includes(p));
        const newPages = allAlready
          ? t.pages.filter(p => !pageSet.has(p))
          : [...new Set([...t.pages, ...pageNums])].sort((a, b) => a - b);
        return { ...t, pages: newPages };
      }
      return { ...t, pages: t.pages.filter(p => !pageSet.has(p)) };
    }));
  }

  // Click guard: fire single-click only if no double-click follows within 220ms
  function handleThumbClick(i: number, shiftKey: boolean) {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      const pageNum = i + 1;
      if (shiftKey && lastClickedRef.current !== null) {
        // Range select from last clicked to here
        const from = Math.min(lastClickedRef.current, pageNum);
        const to = Math.max(lastClickedRef.current, pageNum);
        const range = Array.from({ length: to - from + 1 }, (_, k) => from + k);
        assignPages(range);
      } else {
        assignPages([pageNum]);
        lastClickedRef.current = pageNum;
      }
    }, 220);
  }

  function handleThumbDoubleClick(i: number) {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    // Use full-res canvas for sharp preview
    const canvas = fullCanvasesRef.current[i];
    const src = canvas ? canvas.toDataURL("image/jpeg", 0.92) : thumbnails[i];
    setPreviewSrc(src);
    setPreviewPage(i);
  }

  function updateTopicName(idx: number, name: string) {
    setTopics(prev => prev.map((t, i) => i === idx ? { ...t, name } : t));
  }

  function addTopic() {
    setTopics(prev => [...prev, { name: "", pages: [] }]);
    setActiveTopic(topics.length); // focus new topic
  }

  function removeTopic(idx: number) {
    setTopics(prev => prev.filter((_, i) => i !== idx));
    setActiveTopic(prev => Math.max(0, prev > idx ? prev - 1 : prev === idx ? 0 : prev));
  }

  function validate(): string | null {
    if (!selectedModuleId) return "Please select a module";
    for (const t of topics) {
      if (!t.name.trim()) return "All topics must have a name";
      if (t.pages.length === 0) return `Topic "${t.name || "(unnamed)"}" has no pages assigned`;
    }
    return null;
  }

  async function handleImport() {
    const err = validate();
    if (err) { setError(err); return; }

    setError(null);
    setStep("import");

    try {
      for (let ti = 0; ti < topics.length; ti++) {
        const topic = topics[ti];
        const sortedPages = [...topic.pages].sort((a, b) => a - b);
        const totalSlides = sortedPages.length;

        const result = await createTopicForImport(selectedModuleId, topic.name.trim());
        if ("error" in result) throw new Error(result.error);
        const { topicId } = result;

        const urls: string[] = [];
        for (let si = 0; si < totalSlides; si++) {
          setImportProgress({ topic: ti + 1, totalTopics: topics.length, slide: si + 1, totalSlides });
          const pageIdx = sortedPages[si] - 1;
          const fullCanvas = fullCanvasesRef.current[pageIdx];
          const blob = await new Promise<Blob>(resolve =>
            fullCanvas.toBlob(b => resolve(b!), "image/png")
          );
          const res = await fetch("/api/training-materials/upload", {
            method: "POST",
            body: blob,
            headers: {
              "Content-Type": "image/png",
              "X-Filename": encodeURIComponent(`slide-p${sortedPages[si]}.png`),
            },
          });
          const data = await res.json();
          if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
          urls.push(data.url);
        }

        await addSlidesBatch(topicId, urls);
      }
      setStep("done");
    } catch (err) {
      setError("Import failed: " + (err as Error).message);
      setStep("define");
    }
  }

  const totalAssigned = topics.reduce((s, t) => s + t.pages.length, 0);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import PDF as Slides</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {step === "upload" && "Select a PDF file to begin"}
                {step === "define" && renderProgress < pageCount
                  ? `Rendering ${renderProgress} / ${pageCount} pages…`
                  : step === "define" && `${pageCount} pages · ${totalAssigned} assigned · click to assign, shift+click to range-select`}
                {step === "import" && "Uploading slides…"}
                {step === "done" && "Import complete!"}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">

            {/* STEP: upload */}
            {step === "upload" && (
              <div className="flex flex-col items-center justify-center flex-1 gap-6 p-12">
                <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">Select a PDF file</p>
                  <p className="text-sm text-gray-400">Each page will be converted to a slide image</p>
                </div>
                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">
                  Choose PDF
                  <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileSelect} />
                </label>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            )}

            {/* STEP: define */}
            {step === "define" && (
              <div className="flex flex-1 min-h-0">

                {/* Left: thumbnail grid */}
                <div className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-3">
                  {renderProgress < pageCount ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">Rendering {renderProgress} / {pageCount} pages…</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2 text-center">
                        Click to assign · Shift+click for range · Double-click to preview
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {thumbnails.map((src, i) => {
                          const ti = getTopicIndex(i + 1);
                          const isInActive = ti === activeTopic;
                          return (
                            <div
                              key={i}
                              title="Click to assign · Double-click to preview"
                              onClick={e => handleThumbClick(i, e.shiftKey)}
                              onDoubleClick={() => handleThumbDoubleClick(i)}
                              className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all select-none
                                ${ti >= 0 ? TOPIC_THUMB_COLORS[ti % TOPIC_THUMB_COLORS.length] : "border-gray-200 dark:border-gray-700 hover:border-gray-400"}
                                ${isInActive ? "ring-2 ring-offset-1 ring-indigo-500 scale-[1.02]" : "hover:opacity-80"}
                              `}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt={`Page ${i + 1}`} className="w-full object-contain" draggable={false} />
                              <span className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded">
                                {i + 1}
                              </span>
                              {ti >= 0 && (
                                <span className={`absolute top-1 right-1 text-[9px] px-1 rounded font-semibold ${TOPIC_BADGES[ti % TOPIC_BADGES.length]}`}>
                                  T{ti + 1}
                                </span>
                              )}
                              {/* Double-click hint overlay on hover */}
                              <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-end justify-center pb-1 opacity-0 hover:opacity-100">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="drop-shadow">
                                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                  <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Right: topic definition */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                  {/* Module selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Module</label>
                    <select
                      value={selectedModuleId}
                      onChange={e => setSelectedModuleId(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      {modules.map(m => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Topic rows */}
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Topics — click a topic to make it active, then click slides to assign
                    </p>

                    {topics.map((topic, i) => (
                      <div
                        key={i}
                        onClick={() => setActiveTopic(i)}
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${TOPIC_COLORS[i % TOPIC_COLORS.length]}
                          ${activeTopic === i ? "ring-2 ring-offset-1 ring-indigo-600 shadow-md" : "opacity-75 hover:opacity-90"}`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TOPIC_BADGES[i % TOPIC_BADGES.length]}`}>
                            Topic {i + 1}
                          </span>
                          {activeTopic === i && (
                            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">← active</span>
                          )}
                          <span className="ml-auto text-xs text-gray-400">
                            {topic.pages.length} page{topic.pages.length !== 1 ? "s" : ""}
                          </span>
                          {topics.length > 1 && (
                            <button
                              onClick={e => { e.stopPropagation(); removeTopic(i); }}
                              className="text-xs text-red-500 hover:text-red-700 ml-1"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          placeholder="Topic name"
                          value={topic.name}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateTopicName(i, e.target.value)}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />

                        {/* Page number chips */}
                        {topic.pages.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 max-h-16 overflow-y-auto">
                            {topic.pages.map(p => (
                              <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TOPIC_CHIPS[i % TOPIC_CHIPS.length]}`}>
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                        {topic.pages.length === 0 && (
                          <p className="text-[11px] text-gray-400 mt-2 italic">No pages assigned yet</p>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={addTopic}
                      className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Topic
                    </button>
                  </div>

                  {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
                </div>
              </div>
            )}

            {/* STEP: import */}
            {step === "import" && importProgress && (
              <div className="flex flex-col items-center justify-center flex-1 gap-6 p-12">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-gray-900 dark:text-white font-semibold text-lg">
                    Topic {importProgress.topic} of {importProgress.totalTopics}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    Uploading slide {importProgress.slide} of {importProgress.totalSlides}…
                  </p>
                </div>
                <div className="w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.round(
                        ((importProgress.topic - 1 + importProgress.slide / importProgress.totalSlides) / importProgress.totalTopics) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* STEP: done */}
            {step === "done" && (
              <div className="flex flex-col items-center justify-center flex-1 gap-6 p-12">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-gray-900 dark:text-white font-semibold text-xl">Import Complete!</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    {topics.length} topic{topics.length !== 1 ? "s" : ""} created with slides
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-medium transition-colors"
                >
                  View Materials
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          {step === "define" && renderProgress >= pageCount && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => { setStep("upload"); setThumbnails([]); setRenderProgress(0); setTopics([{ name: "", pages: [] }]); }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Change File
              </button>
              <button
                onClick={handleImport}
                className="px-6 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Import
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Preview lightbox (outside main modal so it stacks above) */}
      {previewPage !== null && previewSrc && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-6"
          onClick={() => setPreviewPage(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewPage(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Close (Esc)
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt={`Page ${previewPage + 1}`}
              className="w-full rounded-xl shadow-2xl"
              draggable={false}
            />
            <div className="flex items-center justify-between mt-3 px-1">
              <button
                onClick={() => {
                  const next = previewPage - 1;
                  if (next < 0) return;
                  const src = fullCanvasesRef.current[next]?.toDataURL("image/jpeg", 0.92) ?? thumbnails[next];
                  setPreviewSrc(src);
                  setPreviewPage(next);
                }}
                disabled={previewPage === 0}
                className="text-white/60 hover:text-white disabled:opacity-20 transition-colors"
              >
                ← Prev
              </button>
              <p className="text-white/60 text-sm">Page {previewPage + 1} of {pageCount}</p>
              <button
                onClick={() => {
                  const next = previewPage + 1;
                  if (next >= pageCount) return;
                  const src = fullCanvasesRef.current[next]?.toDataURL("image/jpeg", 0.92) ?? thumbnails[next];
                  setPreviewSrc(src);
                  setPreviewPage(next);
                }}
                disabled={previewPage === pageCount - 1}
                className="text-white/60 hover:text-white disabled:opacity-20 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
