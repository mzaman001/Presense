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
  placeholder,
  autoFocus,
  onCaptured,
}: {
  prompt: string;
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

  const speech = useSpeechCapture({
    onTranscript: (spoken) =>
      setValue(speechBase.current ? `${speechBase.current} ${spoken}` : spoken),
    onError: (error) => {
      if (error === "denied") {
        toast.error("Microphone is blocked", {
          description: "Allow it in your browser's site settings to speak.",
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
        className="block text-[length:var(--text-body-lg)] font-medium text-[var(--text-1)]"
      >
        {prompt}
      </label>
      <div className="flex items-center gap-1.5 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] py-1 pr-1 pl-3.5 focus-within:ring-2 focus-within:ring-[var(--border-focus)]">
        <input
          ref={inputRef}
          id={inputId}
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
 * The evening sweep's questions. Specific prompts pull out far more than a
 * blank "anything else?" (the GTD trigger-list idea). Two rotate daily from
 * this pool, so it never becomes a 50-question checklist, and the catch-all
 * always comes last.
 */
export const EVENING_SWEEP_POOL = [
  "Anyone you owe a reply or a call?",
  "Anything to buy, pay or book?",
  "Anything someone asked you for?",
  "Any appointment or deadline coming up?",
  "Anything at home that needs doing?",
  "Anything you're waiting on from someone?",
  "Anything to read, watch or look into?",
] as const;
export const EVENING_SWEEP_CATCH_ALL = "Anything else nagging you?";

/** The day's prompts: two from the pool (by date), then the catch-all. */
export function eveningSweepPrompts(date: Date = new Date()): string[] {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      start) /
      86_400_000,
  );
  const n = EVENING_SWEEP_POOL.length;
  const first = (dayOfYear * 2) % n;
  return [
    EVENING_SWEEP_POOL[first],
    EVENING_SWEEP_POOL[(first + 1) % n],
    EVENING_SWEEP_CATCH_ALL,
  ];
}
