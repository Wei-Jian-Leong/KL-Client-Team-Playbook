"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Slide = { id: string; imageUrl: string; caption: string | null; order: number };
type Question = {
  id: string;
  question: string;
  type: string;
  options: string[] | null;
  imageUrl: string | null;
  isRequired: boolean;
};

interface SlideZoomModalProps {
  slides: Slide[];
  initialIndex: number;
  onClose: () => void;
  onNextTopic?: () => void;
  nextTopicTitle?: string;
  onPrevTopic?: () => void;
  prevTopicTitle?: string;
  videoUrl?: string;
  onVideoWatched?: () => void;
  questions?: Question[];
  initialAnswers?: Record<string, string>;
  onSaveAnswers?: (answers: Record<string, string>) => void;
  onSlideAdvance?: (newIndex: number) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.3;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type Page = "slide" | "video" | "question";

export default function SlideZoomModal({
  slides, initialIndex, onClose, onNextTopic, nextTopicTitle, onPrevTopic, prevTopicTitle,
  videoUrl, onVideoWatched, questions, initialAnswers, onSaveAnswers, onSlideAdvance,
}: SlideZoomModalProps) {
  const [current, setCurrent] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [page, setPage] = useState<Page>("slide");
  const [qIndex, setQIndex] = useState(0);
  const [qAnswers, setQAnswers] = useState<Record<string, string>>(initialAnswers ?? {});

  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const pinchDistRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offset);

  zoomRef.current = zoom;
  offsetRef.current = offset;

  const hasVideo = !!videoUrl;
  const qs = questions ?? [];
  const hasQuestions = qs.length > 0;
  const curQ = qs[qIndex] ?? qs[qs.length - 1];
  const isLastQ = qIndex >= qs.length - 1;
  const curQAns = curQ ? (qAnswers[curQ.id] ?? "") : "";
  const canAdvanceQ = !curQ?.isRequired || curQAns.trim() !== "";

  function resetZoom() { setZoom(1); setOffset({ x: 0, y: 0 }); }

  function toggleFullscreen() {
    if (!document.fullscreenElement) modalRef.current?.requestFullscreen();
    else document.exitFullscreen();
  }

  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function navigate(dir: 1 | -1) {
    const next = current + dir;
    if (next < 0 || next >= slides.length) return;
    setCurrent(next);
    resetZoom();
    if (dir === 1) onSlideAdvance?.(next);
  }

  // From last slide, advance to next content page
  function goForwardFromSlide() {
    if (hasVideo) { setPage("video"); return; }
    if (hasQuestions) { setPage("question"); setQIndex(0); return; }
    if (onNextTopic) { onClose(); onNextTopic(); }
  }

  // From video page, advance
  function goForwardFromVideo() {
    if (hasQuestions) { setPage("question"); setQIndex(0); return; }
    if (onNextTopic) { onClose(); onNextTopic(); }
    else onClose();
  }

  // Submit answers and optionally advance to next topic
  function submitAnswers() {
    if (onSaveAnswers) onSaveAnswers(qAnswers);
    if (onNextTopic) { onClose(); onNextTopic(); }
    else onClose();
  }

  function computeMaxOffset(z: number) {
    if (!containerRef.current || !imgRef.current) return { maxX: 0, maxY: 0 };
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const iw = imgRef.current.naturalWidth || imgRef.current.clientWidth;
    const ih = imgRef.current.naturalHeight || imgRef.current.clientHeight;
    const renderedW = Math.min(iw, cw);
    const renderedH = Math.min(ih, ch);
    return { maxX: Math.max(0, (renderedW * z - cw) / 2), maxY: Math.max(0, (renderedH * z - ch) / 2) };
  }

  function clampOffset(ox: number, oy: number, z: number) {
    const { maxX, maxY } = computeMaxOffset(z);
    return { x: clamp(ox, -maxX, maxX), y: clamp(oy, -maxY, maxY) };
  }

  function zoomToward(clientX: number, clientY: number, nextZoom: number) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const focusX = clientX - rect.left - rect.width / 2;
    const focusY = clientY - rect.top - rect.height / 2;
    const curZ = zoomRef.current;
    const curO = offsetRef.current;
    const imgX = (focusX - curO.x) / curZ;
    const imgY = (focusY - curO.y) / curZ;
    const newOffset = clampOffset(focusX - imgX * nextZoom, focusY - imgY * nextZoom, nextZoom);
    zoomRef.current = nextZoom;
    offsetRef.current = newOffset;
    setZoom(nextZoom);
    setOffset(newOffset);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (page === "slide") {
        if (e.key === "ArrowLeft") {
          if (current > 0) navigate(-1);
          else if (onPrevTopic) { onClose(); onPrevTopic(); }
        }
        if (e.key === "ArrowRight") {
          if (current < slides.length - 1) navigate(1);
          else goForwardFromSlide();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    const nextZoom = clamp(zoomRef.current + delta, MIN_ZOOM, MAX_ZOOM);
    zoomToward(e.clientX, e.clientY, nextZoom);
  }, []);

  function handleMouseDown(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest("button")) return;
    if (zoomRef.current <= 1) return;
    e.preventDefault();
    draggingRef.current = true;
    setIsDragging(true);
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current || zoomRef.current <= 1) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      setOffset(o => {
        if (!containerRef.current || !imgRef.current) return o;
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const iw = imgRef.current!.naturalWidth || imgRef.current!.clientWidth;
        const ih = imgRef.current!.naturalHeight || imgRef.current!.clientHeight;
        const maxX = Math.max(0, (Math.min(iw, cw) * zoomRef.current - cw) / 2);
        const maxY = Math.max(0, (Math.min(ih, ch) * zoomRef.current - ch) / 2);
        return { x: clamp(o.x + dx, -maxX, maxX), y: clamp(o.y + dy, -maxY, maxY) };
      });
    }
    function onMouseUp() { draggingRef.current = false; setIsDragging(false); }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, []);

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      lastPointerRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / pinchDistRef.current;
      pinchDistRef.current = dist;
      setZoom(prev => {
        const next = clamp(prev * ratio, MIN_ZOOM, MAX_ZOOM);
        setOffset(o => clampOffset(o.x, o.y, next));
        return next;
      });
    } else if (e.touches.length === 1 && zoom > 1) {
      const dx = e.touches[0].clientX - lastPointerRef.current.x;
      const dy = e.touches[0].clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setOffset(o => clampOffset(o.x + dx, o.y + dy, zoom));
    }
  }

  function handleTouchEnd() { pinchDistRef.current = null; }

  const slide = slides[current];
  const cursorStyle = isDragging ? "grabbing" : zoom > 1 ? "grab" : "default";

  const counterLabel = page === "slide"
    ? `${current + 1} / ${slides.length}`
    : page === "video" ? "Video"
    : `Q ${qIndex + 1} / ${qs.length}`;

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0 select-none">
        <span className="text-white/60 text-sm font-medium">{counterLabel}</span>
        <div className="flex items-center gap-1">
          {page === "slide" && (
            <>
              <button
                type="button"
                onClick={() => {
                  const nz = clamp(zoom + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
                  if (containerRef.current) {
                    const r = containerRef.current.getBoundingClientRect();
                    zoomToward(r.left + r.width / 2, r.top + r.height / 2, nz);
                  } else setZoom(nz);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors"
                aria-label="Zoom in"
              >+</button>
              <button
                type="button"
                onClick={() => {
                  const nz = clamp(zoom - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
                  if (containerRef.current) {
                    const r = containerRef.current.getBoundingClientRect();
                    zoomToward(r.left + r.width / 2, r.top + r.height / 2, nz);
                  } else setZoom(nz);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors"
                aria-label="Zoom out"
              >−</button>
              <button
                type="button"
                onClick={resetZoom}
                className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg px-3 py-1.5 text-xs transition-colors"
              >{Math.round(zoom * 100)}%</button>
              <div className="w-px h-5 bg-white/20 mx-1" />
            </>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            )}
          </button>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content area */}
      {page === "slide" ? (
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden flex items-center justify-center"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: cursorStyle, touchAction: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={slide.imageUrl}
            alt={slide.caption ?? `Slide ${current + 1}`}
            draggable={false}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
              transition: "none",
              userSelect: "none",
              pointerEvents: "auto",
            }}
          />

          {/* Prev button / Prev Topic button */}
          {current > 0 ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(-1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-3 transition-colors z-10"
              aria-label="Previous slide"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : onPrevTopic ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); onPrevTopic(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-full px-4 py-3 text-sm font-medium transition-colors z-10 flex items-center gap-2 max-w-[180px]"
              aria-label="Previous topic"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span className="truncate hidden sm:inline">{prevTopicTitle}</span>
            </button>
          ) : null}

          {/* Next button / advance to next content / Next Topic button */}
          {current < slides.length - 1 ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-3 transition-colors z-10"
              aria-label="Next slide"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : (hasVideo || hasQuestions) ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goForwardFromSlide(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-3 transition-colors z-10"
              aria-label="Continue"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : onNextTopic ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); onNextTopic(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-full px-4 py-3 text-sm font-medium transition-colors z-10 flex items-center gap-2 max-w-[180px]"
              aria-label="Next topic"
            >
              <span className="truncate hidden sm:inline">{nextTopicTitle}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : page === "video" ? (
        <div className="flex-1 flex items-center justify-center p-4 bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            controls
            autoPlay
            src={videoUrl}
            className="max-w-full rounded-xl"
            style={{ maxHeight: "calc(100vh - 160px)" }}
            onEnded={onVideoWatched}
          />
        </div>
      ) : (
        /* Question page */
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full px-6 py-6">
            {curQ && (
              <>
                {curQ.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={curQ.imageUrl} alt="" className="rounded-xl mb-4 max-w-full max-h-48 object-contain" />
                )}
                <p className="text-white text-base font-medium mb-4 leading-relaxed">
                  {curQ.question || <span className="italic text-white/40">No question text</span>}
                </p>
                {curQ.isRequired && curQAns.trim() === "" && (
                  <p className="text-amber-400 text-xs mb-3">This question is required</p>
                )}
                {curQ.type === "SHORT_ANSWER" && (
                  <textarea
                    key={curQ.id}
                    value={curQAns}
                    onChange={(e) => setQAnswers(prev => ({ ...prev, [curQ.id]: e.target.value }))}
                    placeholder="Type your answer here…"
                    rows={5}
                    className="w-full text-sm px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                )}
                {curQ.type === "SELECT" && (curQ.options ?? []).map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-3 mb-3 cursor-pointer group">
                    <input
                      type="radio"
                      name={`q-${curQ.id}`}
                      value={opt}
                      checked={curQAns === opt}
                      onChange={() => setQAnswers(prev => ({ ...prev, [curQ.id]: opt }))}
                      className="accent-indigo-400 w-4 h-4 shrink-0"
                    />
                    <span className="text-sm text-white/80 group-hover:text-white transition-colors">{opt}</span>
                  </label>
                ))}
                {curQ.type === "MULTI_SELECT" && (() => {
                  let selected: string[] = [];
                  try { selected = JSON.parse(curQAns || "[]") as string[]; } catch { selected = []; }
                  return (curQ.options ?? []).map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-3 mb-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selected.includes(opt)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selected, opt]
                            : selected.filter(x => x !== opt);
                          setQAnswers(prev => ({ ...prev, [curQ.id]: JSON.stringify(next) }));
                        }}
                        className="accent-indigo-400 w-4 h-4 shrink-0"
                      />
                      <span className="text-sm text-white/80 group-hover:text-white transition-colors">{opt}</span>
                    </label>
                  ));
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom navigation — video and question pages only */}
      {page !== "slide" && (
        <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-black/60 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              if (page === "video") {
                setPage("slide");
                setCurrent(slides.length - 1);
              } else {
                if (qIndex > 0) {
                  setQIndex(q => q - 1);
                } else if (hasVideo) {
                  setPage("video");
                } else {
                  setPage("slide");
                  setCurrent(slides.length - 1);
                }
              }
            }}
            className="text-sm px-4 py-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {page === "video" ? "Back to Slides" : qIndex > 0 ? "Prev" : hasVideo ? "Back to Video" : "Back to Slides"}
          </button>

          {page === "video" ? (
            <button
              type="button"
              onClick={goForwardFromVideo}
              className="text-sm px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {hasQuestions ? "Questions" : onNextTopic ? (nextTopicTitle ?? "Next Topic") : "Done"}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : isLastQ ? (
            <button
              type="button"
              onClick={submitAnswers}
              disabled={!canAdvanceQ}
              className="text-sm px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {onNextTopic ? "Submit & Continue" : "Submit"}
              {onNextTopic && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { if (canAdvanceQ) setQIndex(q => q + 1); }}
              disabled={!canAdvanceQ}
              className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Next
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Slide footer — caption + dot indicators */}
      {page === "slide" && (
        <>
          {slide.caption && (
            <div className="shrink-0 px-6 py-2.5 text-center">
              <p className="text-white/70 text-sm">{slide.caption}</p>
            </div>
          )}
          {slides.length > 1 && (
            <div className="shrink-0 flex justify-center gap-1.5 pb-4">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setCurrent(i); resetZoom(); }}
                  className={`rounded-full transition-all ${i === current ? "w-4 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/70"}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
