"use client";
import { logger } from "@/lib/logger";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { createClient, safeMutate } from "@/lib/supabase";
import {
  ArrowRight,
  Loader2,
  Brain,
  MessageSquare,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { routeCapture, type RoutedItem } from "@/lib/capture-router";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

interface OnboardingWizardProps {
  initialName: string;
}

const SPACES = [
  {
    id: "do",
    icon: CheckCircle2,
    title: "Do",
    desc: "One task at a time. No overwhelm.",
  },
  {
    id: "think",
    icon: MessageSquare,
    title: "Think",
    desc: "Ongoing thoughts and a daily note.",
  },
  {
    id: "remember",
    icon: Brain,
    title: "Remember",
    desc: "Where you left things.",
  },
];

const LARGE_BUTTON = "h-14 w-full text-[length:var(--text-lg)]";

export function OnboardingWizard({ initialName }: OnboardingWizardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Welcome + name
  const [name, setName] = useState(initialName || "");

  // Step 2: Ritual loop setup
  const [wakeTime, setWakeTime] = useState("07:00");

  // Step 3: First capture
  const [captureInput, setCaptureInput] = useState("");
  const [routedItem, setRoutedItem] = useState<RoutedItem | null>(null);

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

  const handleStep1Next = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && name.trim()) {
        const { success } = await safeMutate(
          () =>
            supabase.from("user_settings").upsert(
              {
                user_id: user.id,
                display_name: name.trim(),
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
      toast.error("Failed to save your name");
    } finally {
      setSaving(false);
    }
  };

  const handleStep2Next = async () => {
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
                timezone: timezone,
              })
              .eq("user_id", user.id),
          "Failed to save your preferences",
        );
        if (!success) return;
      }
      setStep(3);
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to save your preferences");
    } finally {
      setSaving(false);
    }
  };

  const completeOnboarding = async (user: { id: string }) => {
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
    if (!success) return false;
    router.push("/");
    return true;
  };

  const handleStep3Finish = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      if (captureInput.trim()) {
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
          }
          toast.success(`Saved to ${item.destination}`);
        }
      }

      await completeOnboarding(user);
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to finish setup");
      setSaving(false);
    }
  };

  const handleSkipToFinish = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const completed = await completeOnboarding(user);
      if (!completed) setSaving(false);
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      toast.error("Failed to finish setup");
      setSaving(false);
    }
  };

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--bg-base)] p-6 font-sans"
      style={{ zIndex: 1 }}
    >
      <AnimatePresence mode="wait">
        {step === 1 && (
          <m.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-xl space-y-7"
          >
            <div className="flex items-center gap-2.5 text-[var(--accent)]">
              <BrandMark size={26} />
              <span className="font-heading text-title-lg font-semibold tracking-tight text-[var(--text-1)]">
                Presense
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--text-1)] sm:text-4xl">
                Your external brain, finally somewhere calm.
              </h1>
              <p className="text-body text-[var(--text-3)]">
                Presense captures what you&apos;d otherwise forget — tasks,
                thoughts, and things you&apos;re keeping track of — and brings
                it back to you at the right moment.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SPACES.map((space) => (
                <GlassCard key={space.id} className="flex flex-col gap-2">
                  <UiIcon
                    size={20}
                    strokeWidth={1.5}
                    className="text-[var(--accent)]"
                    icon={space.icon}
                  />
                  <div className="text-card-title text-[var(--text-1)]">
                    {space.title}
                  </div>
                  <p className="text-sm text-[var(--text-3)]">{space.desc}</p>
                </GlassCard>
              ))}
            </div>

            <div className="space-y-2">
              <input
                autoFocus
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStep1Next()}
                className="input !rounded-2xl !px-5 !py-4 !text-xl"
              />
            </div>

            <Button
              variant="primary"
              onClick={handleStep1Next}
              disabled={saving}
              className={LARGE_BUTTON}
            >
              {saving ? (
                <UiIcon className="h-6 w-6 animate-spin" icon={Loader2} />
              ) : (
                <>
                  Continue <UiIcon className="h-5 w-5" icon={ArrowRight} />
                </>
              )}
            </Button>
          </m.div>
        )}

        {step === 2 && (
          <m.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md space-y-8"
          >
            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                Presense works in a loop, not a list.
              </h1>
              <p className="text-body text-[var(--text-3)]">
                Each morning, Presense helps you plan the day. Each evening, a
                quick review closes the loop. It only takes a minute, and
                it&apos;s the one habit that makes everything else here work.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
              <label className="block text-sm font-semibold tracking-wider text-[var(--text-2)] uppercase">
                When should your morning planning nudge arrive?
              </label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full bg-transparent text-2xl font-bold text-[var(--text-1)] outline-none"
              />
            </div>

            <div className="flex gap-4">
              <Button
                variant="secondary"
                onClick={() => setStep(1)}
                className="h-14 flex-1 text-[length:var(--text-lg)]"
              >
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleStep2Next}
                disabled={saving}
                className="h-14 flex-[2] text-[length:var(--text-lg)]"
              >
                {saving ? (
                  <UiIcon className="h-6 w-6 animate-spin" icon={Loader2} />
                ) : (
                  <>
                    Continue <UiIcon className="h-5 w-5" icon={ArrowRight} />
                  </>
                )}
              </Button>
            </div>
          </m.div>
        )}

        {step === 3 && (
          <m.div
            key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-xl space-y-8"
          >
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--text-1)]">
              Let&apos;s try it. What&apos;s on your mind right now?
            </h1>
            <div className="relative">
              <textarea
                autoFocus
                placeholder="Remind me to call Mom on Sunday..."
                value={captureInput}
                onChange={(e) => setCaptureInput(e.target.value)}
                className="h-32 w-full resize-none rounded-2xl border border-[var(--border-default)] bg-[var(--surface-1)] p-5 text-xl text-[var(--text-1)] transition-colors outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
              />
              <AnimatePresence>
                {routedItem && (
                  <m.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-dim)] px-3 py-1.5 text-sm font-medium text-[var(--accent)]"
                  >
                    <UiIcon className="h-4 w-4" icon={Zap} /> → This will go to{" "}
                    {routedItem.destination}
                  </m.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex gap-4">
              <Button
                variant="secondary"
                onClick={() => setStep(2)}
                className="h-14 flex-1 text-[length:var(--text-lg)]"
              >
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleStep3Finish}
                disabled={saving || !captureInput.trim()}
                className="h-14 flex-[2] text-[length:var(--text-lg)]"
              >
                {saving ? (
                  <UiIcon className="h-6 w-6 animate-spin" icon={Loader2} />
                ) : (
                  "Save & start using Presense"
                )}
              </Button>
            </div>
            <button
              onClick={handleSkipToFinish}
              disabled={saving}
              className="text-ui block w-full text-center text-[var(--text-3)] transition-colors hover:text-[var(--text-1)] disabled:opacity-50"
            >
              Skip and start using Presense
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
