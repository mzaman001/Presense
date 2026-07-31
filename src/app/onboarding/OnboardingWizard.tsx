"use client";
import { logger } from "@/lib/logger";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { createClient, safeMutate } from "@/lib/supabase";
import {
  ArrowRight,
  Loader2,
  Brain,
  Users,
  Lightbulb,
  Bookmark,
  CheckCircle2,
  Zap,
  Compass,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { routeCapture, type RoutedItem } from "@/lib/capture-router";
import { Icon as UiIcon } from "@/components/ui/Icon";

interface OnboardingWizardProps {
  initialName: string;
}

const STRUGGLES = [
  { id: "do", icon: Brain, label: "Things I need to do keep slipping" },
  { id: "remember", icon: Users, label: "I forget what people told me" },
  {
    id: "think",
    icon: Lightbulb,
    label: "Ideas disappear before I capture them",
  },
  {
    id: "explore",
    icon: Bookmark,
    label: "I save things but never come back to them",
  },
];

const TOUR_CARDS = [
  {
    id: "do",
    icon: CheckCircle2,
    title: "Do",
    desc: "Your tasks, shown one step at a time. No overwhelm.",
    color: "var(--accent)",
  },
  {
    id: "think",
    icon: Brain,
    title: "Think",
    desc: "Ongoing thoughts, plans, and a daily note. Your mind on paper.",
    color: "var(--accent)",
  },
  {
    id: "remember",
    icon: Users,
    title: "Remember",
    desc: "What people told you. Where you left things. Never forget again.",
    color: "var(--accent)",
  },
  {
    id: "explore",
    icon: Compass,
    title: "Explore",
    desc: "Links, books, quotes, ideas. Saved and resurfaced every Sunday.",
    color: "var(--accent)",
  },
  {
    id: "ready",
    icon: Check,
    title: "You're ready",
    desc: "",
    color: "var(--status-done)",
  },
];

export function OnboardingWizard({ initialName }: OnboardingWizardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Screen 1: Name
  const [name, setName] = useState(initialName || "");
  const [nameError, setNameError] = useState("");

  // Screen 2: Struggles
  const [selectedStruggles, setSelectedStruggles] = useState<string[]>([]);

  // Screen 3: Day Shape
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("22:00");

  // Screen 4: First Capture
  const [captureInput, setCaptureInput] = useState("");
  const [routedItem, setRoutedItem] = useState<RoutedItem | null>(null);

  // Screen 5: Tour
  const [tourIndex, setTourIndex] = useState(0);

  // Auto-route on capture input
  useEffect(() => {
    const routeItem = async () => {
      if (captureInput.trim()) {
        const items = await routeCapture(captureInput);
        setRoutedItem(items[0] || null);
      } else {
        setRoutedItem(null);
      }
    };
    routeItem();
  }, [captureInput]);

  const handleNext1 = async () => {
    if (!name.trim()) {
      setNameError("Please enter your name");
      return;
    }
    setNameError("");
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { success } = await safeMutate(
          () =>
            supabase.from("user_settings").upsert(
              {
                user_id: user.id,
                display_name: name,
              },
              { onConflict: "user_id" },
            ),
          "Failed to save your name",
        );
        if (!success) return;
      }
      setStep(2);
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to save name");
    } finally {
      setSaving(false);
    }
  };

  const handleNext2 = async () => {
    if (selectedStruggles.length === 0) {
      toast.error("Please select at least one item");
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { success } = await safeMutate(
          () =>
            supabase
              .from("user_settings")
              .update({
                primary_struggles: selectedStruggles,
              })
              .eq("user_id", user.id),
          "Failed to save your struggles",
        );
        if (!success) return;
      }
      setStep(3);
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to save struggles");
    } finally {
      setSaving(false);
    }
  };

  const handleNext3 = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Calculate nudge_time (wakeTime + 30 mins)
        const [wH, wM] = wakeTime.split(":").map(Number);
        const nudgeDate = new Date();
        nudgeDate.setHours(wH, wM + 30, 0);
        const nudgeTimeStr = `${String(nudgeDate.getHours()).padStart(2, "0")}:${String(nudgeDate.getMinutes()).padStart(2, "0")}:00`;

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const { success } = await safeMutate(
          () =>
            supabase
              .from("user_settings")
              .update({
                nudge_time: nudgeTimeStr,
                quiet_start: sleepTime + ":00",
                quiet_end: wakeTime + ":00",
                timezone: timezone,
              })
              .eq("user_id", user.id),
          "Failed to save your preferences",
        );
        if (!success) return;
      }
      setStep(4);
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleNext4 = async () => {
    if (!captureInput.trim()) {
      toast.error("Please enter a thought to capture");
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const item = routedItem || (await routeCapture(captureInput))[0];
      if (item) {
        if (item.destination === "Do" || item.destination === "Inbox") {
          const { success } = await safeMutate(
            () =>
              supabase.from("items").insert({
                user_id: user.id,
                title: item.title,
                status: item.destination === "Inbox" ? "inbox" : "active",
                deadline: item.deadline || null,
              }),
            "Failed to save your thought",
          );
          if (!success) return;
        } else if (item.destination.startsWith("Remember")) {
          if (item.type === "person_note") {
            const { data: person } = await supabase
              .from("people")
              .select("*")
              .eq("name", item.person || item.title.split(" ")[0])
              .maybeSingle();
            if (person) {
              const { success } = await safeMutate(
                () =>
                  supabase
                    .from("people")
                    .update({
                      notes: [
                        ...(person.notes ?? []),
                        {
                          text: item.title,
                          created_at: new Date().toISOString(),
                          tag: "note",
                        },
                      ],
                    })
                    .eq("id", person.id),
                "Failed to save your note",
              );
              if (!success) return;
            } else {
              const { success } = await safeMutate(
                () =>
                  supabase.from("people").insert({
                    user_id: user.id,
                    name: item.person || item.title.split(" ")[0],
                    notes: [
                      {
                        text: item.title,
                        created_at: new Date().toISOString(),
                        tag: "note",
                      },
                    ],
                  }),
                "Failed to save your note",
              );
              if (!success) return;
            }
          } else {
            const { success } = await safeMutate(
              () =>
                supabase.from("locations").insert({
                  user_id: user.id,
                  item_name:
                    item.item_name || item.title.split(" ")[0] || "Item",
                  location_text: item.title,
                }),
              "Failed to save your item",
            );
            if (!success) return;
          }
        } else if (item.destination === "Think") {
          const { success } = await safeMutate(
            () =>
              supabase.from("threads").insert({
                user_id: user.id,
                title: item.title.slice(0, 60),
                entries: [
                  {
                    text: item.title,
                    created_at: new Date().toISOString(),
                    starred: false,
                  },
                ],
              }),
            "Failed to save your thought",
          );
          if (!success) return;
        } else if (item.destination === "Explore") {
          const { success } = await safeMutate(
            () =>
              supabase.from("explores").insert({
                user_id: user.id,
                title: item.title.slice(0, 100),
                type: item.url ? "link" : "concept",
                url: item.url ?? null,
                note: item.title,
              }),
            "Failed to save your item",
          );
          if (!success) return;
        }
        toast.success(`Saved to ${item.destination}`);
      }
      setStep(5);
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to capture");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { success } = await safeMutate(
          () =>
            supabase.from("user_settings").upsert(
              {
                user_id: user.id,
                onboarding_complete: true,
              },
              { onConflict: "user_id" },
            ),
          "Failed to complete onboarding",
        );
        if (!success) {
          setSaving(false);
          return;
        }
      }
      router.push("/");
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to complete onboarding");
      setSaving(false);
    }
  };

  const toggleStruggle = (id: string) => {
    if (selectedStruggles.includes(id)) {
      setSelectedStruggles(selectedStruggles.filter((s) => s !== id));
    } else {
      setSelectedStruggles([...selectedStruggles, id]);
    }
  };

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-6 font-sans"
      style={{ zIndex: 1 }}
    >
      <AnimatePresence mode="wait">
        {step === 1 && (
          <m.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md space-y-6"
          >
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-1)] sm:text-4xl">
              What should we call you?
            </h1>
            <div className="space-y-2">
              <input
                autoFocus
                placeholder="What should I call you?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNext1()}
                className="input !rounded-2xl !px-5 !py-4 !text-xl"
              />
              {nameError && (
                <p className="px-2 text-sm text-red-400">{nameError}</p>
              )}
            </div>
            <button
              onClick={handleNext1}
              disabled={saving}
              className="hover:bg-opacity-90 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-text-1)] py-4 text-lg font-semibold text-[var(--color-background)] transition-opacity disabled:opacity-50"
            >
              {saving ? (
                <UiIcon className="h-6 w-6 animate-spin" icon={Loader2} />
              ) : (
                <>
                  Next <UiIcon className="h-5 w-5" icon={ArrowRight} />
                </>
              )}
            </button>
          </m.div>
        )}

        {step === 2 && (
          <m.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg space-y-8"
          >
            <h1 className="text-center text-3xl font-bold tracking-tight text-[var(--color-text-1)]">
              What keeps slipping through the cracks?
            </h1>
            <div className="grid grid-cols-2 gap-4">
              {STRUGGLES.map((s) => {
                const isSelected = selectedStruggles.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStruggle(s.id)}
                    className={`flex flex-col items-center justify-center gap-4 rounded-2xl border p-6 text-center transition-all ${isSelected ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-2)] hover:border-[var(--color-text-3)]"}`}
                  >
                    <s.icon
                      className={`h-8 w-8 ${isSelected ? "text-amber-500" : "text-[var(--color-text-3)]"}`}
                    />
                    <span className="text-sm leading-tight font-medium">
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-2xl border border-[var(--color-border)] py-4 text-lg font-semibold text-[var(--color-text-2)] transition-colors hover:bg-[var(--color-surface)]"
              >
                Back
              </button>
              <button
                onClick={handleNext2}
                disabled={saving || selectedStruggles.length === 0}
                className="hover:bg-opacity-90 flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-[var(--color-text-1)] py-4 text-lg font-semibold text-[var(--color-background)] transition-opacity disabled:opacity-50"
              >
                {saving ? (
                  <UiIcon className="h-6 w-6 animate-spin" icon={Loader2} />
                ) : (
                  <>
                    Next <UiIcon className="h-5 w-5" icon={ArrowRight} />
                  </>
                )}
              </button>
            </div>
          </m.div>
        )}

        {step === 3 && (
          <m.div
            key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md space-y-8"
          >
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-1)]">
              When does your day usually start and end?
            </h1>
            <div className="space-y-6">
              <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <label className="block text-sm font-semibold tracking-wider text-[var(--color-text-2)] uppercase">
                  I&apos;m usually up by
                </label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full bg-transparent text-2xl font-bold text-[var(--color-text-1)] outline-none"
                />
              </div>
              <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <label className="block text-sm font-semibold tracking-wider text-[var(--color-text-2)] uppercase">
                  I wind down around
                </label>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  className="w-full bg-transparent text-2xl font-bold text-[var(--color-text-1)] outline-none"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-2xl border border-[var(--color-border)] py-4 text-lg font-semibold text-[var(--color-text-2)] transition-colors hover:bg-[var(--color-surface)]"
              >
                Back
              </button>
              <button
                onClick={handleNext3}
                disabled={saving}
                className="hover:bg-opacity-90 flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-[var(--color-text-1)] py-4 text-lg font-semibold text-[var(--color-background)] transition-opacity disabled:opacity-50"
              >
                {saving ? (
                  <UiIcon className="h-6 w-6 animate-spin" icon={Loader2} />
                ) : (
                  <>
                    Next <UiIcon className="h-5 w-5" icon={ArrowRight} />
                  </>
                )}
              </button>
            </div>
          </m.div>
        )}

        {step === 4 && (
          <m.div
            key="step4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-xl space-y-8"
          >
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-1)]">
              Let&apos;s try it. What&apos;s one thing on your mind right now?
            </h1>
            <div className="relative">
              <textarea
                autoFocus
                placeholder="Remind me to call Mom on Sunday..."
                value={captureInput}
                onChange={(e) => setCaptureInput(e.target.value)}
                className="h-32 w-full resize-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-xl text-[var(--color-text-1)] transition-colors outline-none placeholder:text-[var(--color-text-3)] focus:border-[var(--color-accent)]"
              />
              <AnimatePresence>
                {routedItem && (
                  <m.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-1.5 text-sm font-medium text-[var(--color-accent)]"
                  >
                    <UiIcon className="h-4 w-4" icon={Zap} /> → This will go to{" "}
                    {routedItem.destination}
                  </m.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded-2xl border border-[var(--color-border)] py-4 text-lg font-semibold text-[var(--color-text-2)] transition-colors hover:bg-[var(--color-surface)]"
              >
                Back
              </button>
              <button
                onClick={handleNext4}
                disabled={saving || !captureInput.trim()}
                className="hover:bg-opacity-90 flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-[var(--color-text-1)] py-4 text-lg font-semibold text-[var(--color-background)] transition-opacity disabled:opacity-50"
              >
                {saving ? (
                  <UiIcon className="h-6 w-6 animate-spin" icon={Loader2} />
                ) : (
                  "Capture & continue"
                )}
              </button>
            </div>
          </m.div>
        )}

        {step === 5 && (
          <m.div
            key="step5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex w-full max-w-sm flex-col items-center space-y-8 text-center"
          >
            <div className="relative flex h-64 w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
              <AnimatePresence mode="wait">
                <m.div
                  key={tourIndex}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="flex flex-col items-center text-center"
                >
                  {React.createElement(TOUR_CARDS[tourIndex].icon, {
                    className: "w-16 h-16 mb-6",
                    style: { color: TOUR_CARDS[tourIndex].color },
                  })}
                  <h2 className="mb-3 text-2xl font-bold text-[var(--color-text-1)]">
                    {TOUR_CARDS[tourIndex].id === "ready"
                      ? `Presense is set up for you, ${name.split(" ")[0]}. Let's go.`
                      : TOUR_CARDS[tourIndex].title}
                  </h2>
                  <p className="text-[var(--color-text-2)]">
                    {TOUR_CARDS[tourIndex].desc}
                  </p>
                </m.div>
              </AnimatePresence>
            </div>

            <div className="mb-8 flex gap-2">
              {TOUR_CARDS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setTourIndex(idx)}
                  className={`h-2 w-2 rounded-full transition-all ${idx === tourIndex ? "w-6 bg-[var(--color-accent)]" : "bg-[var(--color-border)] hover:bg-[var(--color-text-3)]"}`}
                />
              ))}
            </div>

            <div className="w-full space-y-4">
              {tourIndex < TOUR_CARDS.length - 1 ? (
                <button
                  onClick={() => setTourIndex(tourIndex + 1)}
                  className="hover:bg-opacity-90 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-text-1)] py-4 text-lg font-semibold text-[var(--color-background)] transition-opacity"
                >
                  Next <UiIcon className="h-5 w-5" icon={ArrowRight} />
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-4 text-lg font-bold text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hot)] disabled:opacity-50"
                >
                  {saving ? (
                    <UiIcon className="h-6 w-6 animate-spin" icon={Loader2} />
                  ) : (
                    "Start using Presense"
                  )}
                </button>
              )}
              <button
                onClick={handleFinish}
                className="text-sm font-medium text-[var(--color-text-3)] transition-colors hover:text-[var(--color-text-1)]"
              >
                Skip tour →
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <button
        onClick={handleFinish}
        className="mt-8 text-sm text-[var(--color-text-3)] transition-colors hover:text-[var(--color-text-1)]"
      >
        Skip setup →
      </button>
    </div>
  );
}
