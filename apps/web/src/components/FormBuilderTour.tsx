"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

/**
 * First-time walkthrough for the form builder.
 *
 * No tour library — this is ~150 lines of getBoundingClientRect and a
 * box-shadow spotlight, which doesn't earn a dependency. Targets real buttons
 * already in the toolbar via their existing aria-labels/classes, so it needs
 * no wrapper components and stays correct as those buttons move.
 */

const SEEN_KEY = "fieldtally_seen_builder_tour";
/** Fired by the "?" button in the toolbar to replay the tour on demand. */
export const REPLAY_TOUR_EVENT = "fieldtally:replay-tour";

interface Step {
  /** CSS selector for the real element. Steps whose target isn't currently
   *  rendered (hidden by a breakpoint, or not mounted yet) are skipped. */
  selector: string;
  title: string;
  body: string;
  placement: "bottom" | "top";
}

const STEPS: Step[] = [
  {
    selector: ".form-title-input",
    title: "Name your form",
    body: "This is the title respondents see at the top of the form.",
    placement: "bottom",
  },
  {
    selector: ".ProseMirror",
    title: "Build the form",
    body: "Type “/” anywhere to insert a question — short answer, multiple choice, GPS, signature, and more. Hover a block to drag it into a new order.",
    placement: "top",
  },
  {
    selector: '[aria-label="Open AI assistant"]',
    title: "AI assistant",
    body: "Describe the form you want in plain English — you can even ask for a full graded quiz with the answer key already filled in.",
    placement: "bottom",
  },
  {
    selector: '[aria-label="Quiz settings"]',
    title: "Quiz mode",
    body: "Turn any form into an auto-graded quiz. Once it's on, click the circle beside the correct option right on the question to mark it.",
    placement: "bottom",
  },
  {
    selector: '[aria-label="Preview form"]',
    title: "Preview",
    body: "See exactly what a respondent will see before you publish.",
    placement: "bottom",
  },
  {
    selector: '[aria-label="Share and access settings"]',
    title: "Share & access",
    body: "Control who can view or submit — keep it restricted, or open it to anyone with the link.",
    placement: "bottom",
  },
  {
    selector: '[aria-label="Publish form"]',
    title: "Publish",
    body: "Publishing gets you a shareable link. Every publish keeps a version, so you can always roll back.",
    placement: "bottom",
  },
];

function measure(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  // Hidden by a responsive breakpoint (display:none) or not yet laid out.
  if (rect.width === 0 || rect.height === 0) return null;
  return rect;
}

export default function FormBuilderTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const end = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(SEEN_KEY, "true");
    } catch {
      // Storage unavailable — tour just replays next visit, not a big deal.
    }
  }, []);

  // Auto-start once, on first visit to the builder.
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "true";
    } catch {
      // Treat as unseen if storage is unavailable.
    }
    if (!seen) {
      const timer = setTimeout(start, 700); // let the editor finish mounting
      return () => clearTimeout(timer);
    }
  }, [start]);

  // Manual replay from the toolbar's "?" button.
  useEffect(() => {
    window.addEventListener(REPLAY_TOUR_EVENT, start);
    return () => window.removeEventListener(REPLAY_TOUR_EVENT, start);
  }, [start]);

  // Find the next step whose target actually exists, skipping any that are
  // hidden at the current viewport width (e.g. Share on a narrow screen).
  useEffect(() => {
    if (!active) return;

    let i = stepIndex;
    let found: DOMRect | null = null;
    while (i < STEPS.length) {
      found = measure(STEPS[i].selector);
      if (found) break;
      i++;
    }

    if (!found) {
      end();
      return;
    }
    if (i !== stepIndex) {
      setStepIndex(i);
      return;
    }
    setRect(found);

    const recompute = () => setRect(measure(STEPS[stepIndex].selector));
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [active, stepIndex, end]);

  if (!active || !rect) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const pad = 6;
  const spot = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  // Card sits below the target, or above it if that would run off the bottom
  // of a short viewport.
  const cardWidth = 320;
  const wouldOverflowBottom = spot.top + spot.height + 160 > window.innerHeight;
  const placeAbove = step.placement === "top" || wouldOverflowBottom;
  const cardTop = placeAbove ? spot.top - 12 : spot.top + spot.height + 12;
  const cardLeft = Math.min(Math.max(spot.left, 16), window.innerWidth - cardWidth - 16);

  return (
    <>
      {/* Blocks stray clicks on the rest of the page while the tour is up. */}
      <div className="fixed inset-0 z-[199]" onClick={(e) => e.stopPropagation()} />
      {/* Visual dimming, via box-shadow spread — the hole is this box itself. */}
      <div
        className="fixed z-[200] rounded-lg pointer-events-none transition-all duration-200"
        style={{ ...spot, boxShadow: "0 0 0 9999px rgba(24,24,27,0.65)" }}
      />
      <div
        className="fixed z-[201] w-80 bg-white rounded-xl shadow-2xl border border-zinc-200 p-4 animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: placeAbove ? undefined : cardTop,
          bottom: placeAbove ? window.innerHeight - cardTop : undefined,
          left: cardLeft,
        }}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-zinc-900">{step.title}</h3>
          <button
            onClick={end}
            aria-label="Close walkthrough"
            className="text-zinc-400 hover:text-zinc-700 shrink-0 -mt-0.5 -mr-0.5"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed mb-4">{step.body}</p>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-400 font-medium">
            {stepIndex + 1} of {STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={end}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800 px-2 py-1.5"
            >
              Skip
            </button>
            <button
              onClick={() => (isLast ? end() : setStepIndex((i) => i + 1))}
              className="text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg px-3 py-1.5"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
