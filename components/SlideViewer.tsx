"use client";

import { useState, useTransition, useEffect, forwardRef, useImperativeHandle } from "react";
import { updateSlideProgress } from "@/app/actions/training-materials";
import SlideZoomModal from "@/components/SlideZoomModal";

type Slide = { id: string; imageUrl: string; caption: string | null; order: number };
type Question = {
  id: string; question: string; type: string;
  options: string[] | null; imageUrl: string | null; isRequired: boolean;
};

interface SlideViewerProps {
  slides: Slide[];
  topicId: string;
  isNewHire: boolean;
  initialMaxReached: number;
  onProgressChange?: (maxReached: number) => void;
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

export type SlideViewerHandle = { next: () => void; openZoom: (index?: number) => void };

const SlideViewer = forwardRef<SlideViewerHandle, SlideViewerProps>(function SlideViewer(
  { slides, topicId, isNewHire, initialMaxReached, onProgressChange, onNextTopic, nextTopicTitle, onPrevTopic, prevTopicTitle, videoUrl, onVideoWatched, questions, initialAnswers, onSaveAnswers, onSlideAdvance },
  ref
) {
  const [current, setCurrent] = useState(0);
  const [maxReached, setMaxReached] = useState(initialMaxReached);
  const [, startTransition] = useTransition();
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (slides.length > 0 && current >= slides.length) {
      setCurrent(slides.length - 1);
    }
  }, [slides.length, current]);

  if (slides.length === 0) return null;

  const slide = slides[Math.min(current, slides.length - 1)];

  function handleNext() {
    const next = current + 1;
    if (next >= slides.length) return;
    setCurrent(next);
    if (isNewHire && next > maxReached) {
      const newMax = next;
      setMaxReached(newMax);
      onProgressChange?.(newMax);
      startTransition(() => {
        updateSlideProgress(topicId, newMax);
      });
    }
  }

  function handlePrev() {
    if (current > 0) setCurrent(current - 1);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({
    next: handleNext,
    openZoom: (index?: number) => {
      if (index !== undefined) setCurrent(index);
      setZoomOpen(true);
    },
  }), [current, maxReached]);

  return (
    <>
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 mb-3">
        {/* Image area */}
        <div className="relative bg-black">
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="group relative block w-full cursor-zoom-in focus:outline-none"
            aria-label="Click to zoom"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.imageUrl}
              alt={slide.caption ?? `Slide ${current + 1}`}
              className="w-full object-contain"
              style={{ display: "block", maxWidth: 960, margin: "0 auto" }}
            />
            {/* Fullscreen icon — always visible */}
            <span className="absolute bottom-2 right-2 bg-black/60 text-white rounded-md p-1.5 opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            </span>
          </button>

          {/* Slide counter badge */}
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full pointer-events-none">
            {current + 1} / {slides.length}
          </div>

          {/* Prev button */}
          {current > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors z-10"
              aria-label="Previous slide"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Next button */}
          {current < slides.length - 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors z-10"
              aria-label="Next slide"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>

        {/* Caption + dot indicators */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-0 truncate">
            {slide.caption ?? ""}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (i <= maxReached || !isNewHire) {
                    setCurrent(i);
                  }
                }}
                className={`rounded-full transition-all ${
                  i === current
                    ? "w-4 h-2 bg-indigo-500"
                    : i <= maxReached || !isNewHire
                    ? "w-2 h-2 bg-gray-400 dark:bg-gray-500 hover:bg-indigo-400"
                    : "w-2 h-2 bg-gray-200 dark:bg-gray-700 cursor-default"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Progress hint for new hires that haven't finished */}
        {isNewHire && maxReached < slides.length - 1 && (
          <div className="px-4 pb-2.5">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              View all slides to enable acknowledgment ({maxReached + 1}/{slides.length} viewed)
            </p>
          </div>
        )}
      </div>

      {zoomOpen && (
        <SlideZoomModal
          slides={slides}
          initialIndex={current}
          onClose={() => setZoomOpen(false)}
          onNextTopic={onNextTopic}
          nextTopicTitle={nextTopicTitle}
          onPrevTopic={onPrevTopic}
          prevTopicTitle={prevTopicTitle}
          videoUrl={videoUrl}
          onVideoWatched={onVideoWatched}
          questions={questions}
          initialAnswers={initialAnswers}
          onSaveAnswers={onSaveAnswers}
          onSlideAdvance={onSlideAdvance}
        />
      )}
    </>
  );
});

export default SlideViewer;
