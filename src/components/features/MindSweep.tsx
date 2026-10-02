"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Mic, CornerDownLeft } from "lucide-react";
import { toast } from "sonner";
import { useUserId } from "@/components/providers/SessionProvider";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { captureText } from "@/lib/quick-capture";
import { destinationIdToLabel } from "@/lib/capture-router";
import { useSpeechCapture } from "@/hooks/useSpeechCapture";
import { joinSpokenSegments } from "@/lib/nlp/spoken";
import { DEFAULT_DO_CATEGORIES } from "@/lib/constants";
import { useHaptics } from "@/hooks/useHaptics";
import { cn } from "@/lib/utils";

interface Captured {
  key: string;
  title: string;
  where: string;
}

/**
 * One sweep prompt ("What's on your mind?"): type or speak, Enter after each
 * thing. Every line goes through the same sorting and zero-loss saving as
 * Quick Capture, and is listed under the prompt with where it went.
 *
 * Skipping is always fine: nothing here is required.
 */
export function MindSweepPrompt({
  prompt,
  hideLabel,
  hint,
  placeholder,
  autoFocus,
  onCaptured,
}: {
  prompt: string;
  /** Keep the prompt as the input's name but don't show it (a heading already does). */
  hideLabel?: boolean;
  /** A quiet line under the prompt, e.g. memory joggers. */
  hint?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onCaptured?: () => void;
}) {
  const userId = useUserId();
  const userSettings = useAppStore((s) => s.userSettings);
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [captured, setCaptured] = useState<Captured[]>([]);
  const speechBase = useRef("");

  const categories = userSettings?.do_categories ?? DEFAULT_DO_CATEGORIES;
  const speech = useSpeechCapture({
    phrases: categories,
    onSegments: (segments) => {
      const spoken = joinSpokenSegments(segments, categories);
      setValue(speechBase.current ? `${speechBase.current} ${spoken}` : spoken);
    },
    onError: (error) => {
      if (error === "denied") {
        toast.error("Microphone is blocked", {
          description: "Allow it in your browser's site settings to speak.",
        });
      } else if (error === "unavailable") {
        toast.error("Voice isn't available here", {
          description:
            "This browser can't turn speech into text right now. Type it instead.",
        });
      }
    },
  });

  const submit = async () => {
    const text = value.trim();
    if (!text) return;
    speech.stop();
    setValue("");
    haptics.light();
    const items = await captureText(text, {
      userId,
      userSettings,
      supabase,
      queryClient,
    });
    setCaptured((prev) => [
      ...prev,
      ...items.map((item, i) => ({
        key: `${prev.length}-${i}-${item.title}`,
        title: item.title,
        where: destinationIdToLabel(item.destinationId),
      })),
    ]);
    onCaptured?.();
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className={cn(
          "block text-[length:var(--text-body-lg)] font-medium text-[var(--text-1)]",
          hideLabel && "sr-only",
        )}
      >
        {prompt}
      </label>
      {hint && (
        <p
          id={`${inputId}-hint`}
          className="text-[length:var(--text-ui)] text-[var(--text-3)]"
        >
          {hint}
        </p>
      )}
      <div className="flex items-center gap-1.5 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] py-1 pr-1 pl-3.5 focus-within:ring-2 focus-within:ring-[var(--border-focus)]">
        <input
          ref={inputRef}
          id={inputId}
          aria-describedby={hint ? `${inputId}-hint` : undefined}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={placeholder ?? "Type it and press Enter"}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[length:var(--text-body)] text-[var(--text-1)] outline-none placeholder:text-[var(--text-decorative)]"
        />
        {speech.supported && (
          <button
            type="button"
            onClick={() => {
              if (speech.listening) return speech.stop();
              speechBase.current = value.trim();
              speech.start();
            }}
            aria-label={speech.listening ? "Stop listening" : "Speak"}
            aria-pressed={speech.listening}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
              speech.listening
                ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
                : "text-[var(--text-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
            )}
          >
            <Mic aria-hidden="true" className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!value.trim()}
          aria-label="Add"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)] disabled:opacity-40"
        >
          <CornerDownLeft aria-hidden="true" className="size-4" />
        </button>
      </div>
      {captured.length > 0 && (
        <ul aria-label={`Added from "${prompt}"`} className="space-y-1 px-1">
          {captured.map((c) => (
            <li
              key={c.key}
              className="flex items-center gap-2 text-[length:var(--text-ui)] text-[var(--text-2)]"
            >
              <Check
                aria-hidden="true"
                className="size-3.5 shrink-0 text-[var(--status-done)]"
                strokeWidth={2.25}
              />
              <span className="min-w-0 truncate">{c.title}</span>
              <span className="shrink-0 text-[var(--text-3)]">→ {c.where}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Memory joggers for the evening sweep. Specific cues pull out far more than a
 * blank "anything else?" (the GTD trigger-list idea), but they're hints above
 * one input, not separate fields: separate fields read as categories and make
 * people decide which box a thing belongs in. Sorting comes from the wording.
 * Three rotate daily from this pool, so it never becomes a checklist.
 */
export const EVENING_SWEEP_HINTS = [
  "a reply or call you owe",
  "something to buy, pay or book",
  "something someone asked for",
  "an appointment or deadline",
  "a job at home",
  "something you're waiting on",
  "something to read or look into",
] as const;

/** The day's hints: three from the pool, picked by date. */
export function eveningSweepHints(date: Date = new Date()): string[] {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      start) /
      86_400_000,
  );
  const n = EVENING_SWEEP_HINTS.length;
  const first = (dayOfYear * 3) % n;
  return [0, 1, 2].map((i) => EVENING_SWEEP_HINTS[(first + i) % n]);
}
