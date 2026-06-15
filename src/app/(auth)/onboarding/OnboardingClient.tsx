"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { ArrowRight, Loader2, Zap, CheckCircle2, Brain, Users, Compass } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

interface OnboardingClientProps {
  initialName: string;
  initialTimezone: string;
}

const STRUGGLES = [
  "Things I need to do but keep forgetting",
  "What people told me that I can't recall",
  "Ideas and thoughts that disappear",
  "Stuff I save but never revisit"
];

const TOUR_CARDS = [
  { icon: Zap, title: "Capture anything", desc: "Type whatever is on your mind. We route it automatically.", color: "#E5B41E" },
  { icon: CheckCircle2, title: "Do", desc: "Your tasks, broken into one small step at a time.", color: "#F87171" },
  { icon: Brain, title: "Think", desc: "Your ongoing thoughts, plans, and daily notes.", color: "#2DD4BF" },
  { icon: Users, title: "Remember", desc: "What people told you. Where you left things.", color: "#F472B6" },
  { icon: Compass, title: "Explore", desc: "Things worth keeping — links, books, ideas, quotes.", color: "#FBBF24" }
];

const SPACE_COLORS: Record<string, string> = {
  Do: "#F87171",
  People: "#F472B6",
  Think: "#2DD4BF",
  Explore: "#FBBF24",
  Locations: "#4ADE80",
  Inbox: "#FBBF24"
};

export default function OnboardingClient({ initialName, initialTimezone }: OnboardingClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [name, setName] = useState(initialName || "");
  // Step 2
  const [selectedStruggles, setSelectedStruggles] = useState<string[]>([]);
  // Step 3
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("22:00");
  const timezone = initialTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Step 4
  const [captureInput, setCaptureInput] = useState("");
  const [debouncedCapture] = useDebounce(captureInput, 600);
  const [capturedSpace, setCapturedSpace] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  // Step 5 (Tour)
  const [tourIndex, setTourIndex] = useState(0);

  const toggleStruggle = (s: string) => {
    setSelectedStruggles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  useEffect(() => {
    const routeInput = async () => {
      if (!debouncedCapture.trim()) {
        setCapturedSpace(null);
        return;
      }
      setIsRouting(true);
      try {
        const res = await fetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: debouncedCapture, timezone })
        });
        const data = await res.json();
        
        if (data.items && data.items.length > 0) {
          setCapturedSpace(data.items[0].destination);
        } else {
          setCapturedSpace("Inbox");
        }
      } catch (e) {
        setCapturedSpace("Inbox");
      } finally {
        setIsRouting(false);
      }
    };
    routeInput();
  }, [debouncedCapture, timezone]);

  const handleComplete = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const wakeHour = parseInt(wakeTime.split(':')[0]);
      const nudgeHour = Math.min(wakeHour + 1, 23);
      
      const { error: settingsError } = await supabase.from("user_settings").upsert({
        user_id: user.id,
        display_name: name.trim(),
        primary_struggles: selectedStruggles,
        nudge_time: `${nudgeHour.toString().padStart(2, '0')}:00:00`,
        quiet_start: `${sleepTime}:00`,
        quiet_end: `${wakeTime}:00`,
        timezone: timezone,
      });

      if (settingsError) throw settingsError;

      if (debouncedCapture.trim() && capturedSpace) {
         await supabase.from("items").insert({
           user_id: user.id,
           title: debouncedCapture,
           status: capturedSpace === "Inbox" ? "inbox" : "active",
         });
      }

      toast.success(`Welcome to Presense, ${name.trim()}!`);
      router.push("/");
      router.refresh();
    } catch (err: any) {
      toast.error("Failed to save settings", { description: err.message });
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && !name.trim()) return;
    if (step === 5) {
      if (tourIndex < TOUR_CARDS.length - 1) {
        setTourIndex(i => i + 1);
      } else {
        handleComplete();
      }
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-background)] relative overflow-hidden font-sans">
      <div className="relative z-10 w-full max-w-[480px]">
        
        {step < 5 ? (
          <div className="flex gap-2 mb-12 justify-center">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? "w-12 bg-[var(--color-text-1)]" : "w-4 bg-[rgba(255,255,255,0.15)]"}`} />
            ))}
          </div>
        ) : (
          <div className="flex justify-between items-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-3)]">
              {tourIndex + 1} of 5 spaces
            </span>
            <button onClick={handleComplete} className="text-sm font-medium text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors">
              Skip tour &rarr;
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 shadow-2xl">
              <h1 className="text-[28px] font-semibold text-[var(--color-text-1)] tracking-tight mb-8 text-center">What should we call you?</h1>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) handleNext(); }}
                placeholder="Your name"
                className="w-full bg-transparent text-center text-3xl font-medium text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none border-b-2 border-transparent focus:border-[var(--color-accent)] pb-2 transition-colors"
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 shadow-2xl">
              <h1 className="text-[24px] font-semibold text-[var(--color-text-1)] tracking-tight mb-6">What's the one thing that keeps slipping through the cracks?</h1>
              <div className="space-y-3">
                {STRUGGLES.map(s => (
                  <button 
                    key={s} 
                    onClick={() => toggleStruggle(s)}
                    className={`w-full text-left px-4 py-3 text-sm rounded-xl border transition-all ${selectedStruggles.includes(s) ? 'bg-[rgba(229,180,30,0.15)] text-[var(--color-accent)] border-[var(--color-accent)] font-medium' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-2)] hover:border-[var(--color-border)]'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 shadow-2xl">
              <h1 className="text-[24px] font-semibold text-[var(--color-text-1)] tracking-tight mb-8">When does your day usually start and end?</h1>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-3)] mb-2">I'm usually up by</label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] text-lg outline-none focus:border-[var(--color-accent)] transition-all [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-3)] mb-2">I wind down around</label>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(e) => setSleepTime(e.target.value)}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] text-lg outline-none focus:border-[var(--color-accent)] transition-all [color-scheme:dark]"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 shadow-2xl">
              <h1 className="text-[24px] font-semibold text-[var(--color-text-1)] tracking-tight mb-2">Let's try it.</h1>
              <p className="text-[15px] text-[var(--color-text-2)] mb-8">What's one thing on your mind right now?</p>

              <div className="space-y-6">
                <input
                  autoFocus
                  value={captureInput}
                  onChange={(e) => setCaptureInput(e.target.value)}
                  placeholder="Type anything..."
                  className="w-full bg-transparent border-b border-[var(--color-border)] px-2 py-3 text-xl font-medium text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none focus:border-[var(--color-accent)] transition-colors"
                />
                
                <div className="h-12 flex items-center">
                  {isRouting ? (
                    <div className="flex items-center gap-2 text-[var(--color-text-3)] text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Routing...
                    </div>
                  ) : capturedSpace ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold" style={{ backgroundColor: `${SPACE_COLORS[capturedSpace]}20`, color: SPACE_COLORS[capturedSpace], borderColor: SPACE_COLORS[capturedSpace] }}>
                      Routed to {capturedSpace}
                    </motion.div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-10 shadow-2xl min-h-[340px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tourIndex}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 border" style={{ backgroundColor: `${TOUR_CARDS[tourIndex].color}15`, borderColor: `${TOUR_CARDS[tourIndex].color}40`, color: TOUR_CARDS[tourIndex].color }}>
                    {React.createElement(TOUR_CARDS[tourIndex].icon, { className: "w-10 h-10" })}
                  </div>
                  <h2 className="text-[28px] font-semibold text-[var(--color-text-1)] tracking-tight mb-3">
                    {TOUR_CARDS[tourIndex].title}
                  </h2>
                  <p className="text-[16px] text-[var(--color-text-3)] max-w-[280px]">
                    {TOUR_CARDS[tourIndex].desc}
                  </p>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {step < 5 && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleNext}
              disabled={step === 1 && !name.trim()}
              className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-[var(--color-accent)] text-[var(--color-background)] font-semibold hover:bg-[var(--color-accent)]/90 transition-all shadow-[0_0_20px_rgba(229,180,30,0.2)] disabled:opacity-50"
            >
              {step === 4 ? (capturedSpace ? "Next" : "Skip") : "Continue"} 
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {step === 5 && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-[var(--color-accent)] text-[var(--color-background)] font-semibold hover:bg-[var(--color-accent)]/90 transition-all shadow-[0_0_20px_rgba(229,180,30,0.2)] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : tourIndex === TOUR_CARDS.length - 1 ? "Get started" : "Next"} 
              {tourIndex === TOUR_CARDS.length - 1 ? <CheckCircle2 className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
