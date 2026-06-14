"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { ArrowRight, Loader2, User, Clock, CheckCircle2, Zap, Brain, Layers, Users, Compass } from "lucide-react";
import { toast } from "sonner";

interface OnboardingClientProps {
  initialName: string;
  initialTimezone: string;
}

const STRUGGLES = [
  "Forgetting things",
  "Procrastinating",
  "Losing track",
  "Zoning out"
];

const TOUR_CARDS = [
  { icon: Zap, title: "Capture anything", desc: "Type whatever is on your mind. We route it automatically." },
  { icon: CheckCircle2, title: "Do", desc: "Tasks that move. Focus on starting, not finishing." },
  { icon: Brain, title: "Think", desc: "Thoughts that stay. Your mind on paper." },
  { icon: Users, title: "People", desc: "Log what they told you. We'll remind you next time." },
  { icon: Compass, title: "Explore", desc: "Things worth keeping. Resurfaced every Sunday." }
];

export default function OnboardingClient({ initialName, initialTimezone }: OnboardingClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 State
  const [name, setName] = useState(initialName || "");
  const [selectedStruggles, setSelectedStruggles] = useState<string[]>([]);

  // Step 2 State
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("22:00");
  const timezone = initialTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Step 3 State
  const [firstCapture, setFirstCapture] = useState("");
  const [capturedSpace, setCapturedSpace] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);

  // Step 4 State
  const [tourIndex, setTourIndex] = useState(0);

  const toggleStruggle = (s: string) => {
    setSelectedStruggles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleCapture = async () => {
    if (!firstCapture.trim()) return;
    setRouting(true);
    try {
      // Use the actual capture API to route
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: firstCapture, timezone })
      });
      const data = await res.json();
      
      let space = "Do";
      if (data.route === 'think') space = "Think";
      if (data.route === 'people') space = "People";
      if (data.route === 'locations') space = "Locations";
      if (data.route === 'explore') space = "Explore";
      
      setCapturedSpace(space);
    } catch (e) {
      setCapturedSpace("Do");
    } finally {
      setRouting(false);
    }
  };

  const handleNext = async () => {
    if (step === 1 && !name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    
    if (step === 3 && !capturedSpace) {
      if (firstCapture.trim()) {
        await handleCapture();
      }
      // If they leave it blank, we allow skipping
      setStep(4);
      return;
    }

    if (step === 4) {
      if (tourIndex < TOUR_CARDS.length - 1) {
        setTourIndex(i => i + 1);
        return;
      }
      await handleComplete();
      return;
    }
    
    setStep(s => s + 1);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Calculate nudge time (wake + 30 mins loosely, here just 1 hr later for simplicity or use wake time + 1h)
      const wakeHour = parseInt(wakeTime.split(':')[0]);
      const nudgeHour = (wakeHour + 1).toString().padStart(2, '0');
      
      const { error: settingsError } = await supabase.from("user_settings").upsert({
        user_id: user.id,
        display_name: name.trim(),
        nudge_time: `${nudgeHour}:00:00`,
        timezone: timezone,
        quiet_start: `${sleepTime}:00`,
        quiet_end: `${wakeTime}:00`,
      });

      if (settingsError) throw settingsError;

      // Ensure they don't see tips if they've dismissed them (we won't add them here, they'll show in spaces)
      toast.success(`Welcome to Presense, ${name.trim()}!`);
      router.push("/");
      router.refresh();
    } catch (err: any) {
      toast.error("Failed to save settings", { description: err.message });
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-background)] relative overflow-hidden font-sans">
      <div className="relative z-10 w-full max-w-[480px]">
        <div className="flex gap-2 mb-12 justify-center">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? "w-12 bg-white" : "w-4 bg-[rgba(255,255,255,0.15)]"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-[rgba(229,180,30,0.1)] border border-[rgba(229,180,30,0.2)] flex items-center justify-center mb-6 text-[var(--color-accent)]">
                <User className="w-6 h-6" />
              </div>
              <h1 className="text-[24px] font-semibold text-[var(--color-text-1)] tracking-tight mb-2">Who are you?</h1>
              
              <div className="space-y-6 mt-8">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">What should we call you?</label>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="First name"
                    className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3.5 text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none focus:border-[var(--color-accent)] transition-all text-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-3">What's your biggest daily struggle?</label>
                  <div className="flex flex-wrap gap-2">
                    {STRUGGLES.map(s => (
                      <button 
                        key={s} 
                        onClick={() => toggleStruggle(s)}
                        className={`px-4 py-2 text-sm rounded-full border transition-all ${selectedStruggles.includes(s) ? 'bg-[var(--color-accent)] text-black border-[var(--color-accent)] font-medium' : 'bg-transparent border-[rgba(255,255,255,0.2)] text-[var(--color-text-2)] hover:border-[rgba(255,255,255,0.4)]'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-[rgba(229,180,30,0.1)] border border-[rgba(229,180,30,0.2)] flex items-center justify-center mb-6 text-[var(--color-accent)]">
                <Clock className="w-6 h-6" />
              </div>
              <h1 className="text-[24px] font-semibold text-[var(--color-text-1)] tracking-tight mb-2">Your day.</h1>
              <p className="text-[15px] text-[var(--color-text-2)] mb-8">We use this to set your quiet hours and morning nudge.</p>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">When do you usually wake up?</label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white outline-none focus:border-[var(--color-accent)] transition-all [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">When do you like to wind down?</label>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(e) => setSleepTime(e.target.value)}
                    className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white outline-none focus:border-[var(--color-accent)] transition-all [color-scheme:dark]"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-[rgba(229,180,30,0.1)] border border-[rgba(229,180,30,0.2)] flex items-center justify-center mb-6 text-[var(--color-accent)]">
                <Zap className="w-6 h-6" />
              </div>
              <h1 className="text-[24px] font-semibold text-[var(--color-text-1)] tracking-tight mb-2">Add your first thing.</h1>
              <p className="text-[15px] text-[var(--color-text-2)] mb-8">What's one thing on your mind that you need to handle?</p>

              <div className="space-y-6">
                <div>
                  <input
                    autoFocus
                    value={firstCapture}
                    onChange={(e) => { setFirstCapture(e.target.value); setCapturedSpace(null); }}
                    placeholder="Type anything..."
                    className="w-full bg-transparent border-b border-[rgba(255,255,255,0.2)] px-2 py-3 text-lg font-medium text-white placeholder:text-[rgba(255,255,255,0.2)] outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
                
                <AnimatePresence>
                  {capturedSpace && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 text-[var(--color-accent)] bg-[rgba(229,180,30,0.1)] p-4 rounded-xl border border-[rgba(229,180,30,0.2)]">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm font-medium">Got it. Saved to {capturedSpace}.</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 shadow-2xl min-h-[300px] flex flex-col justify-center"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={tourIndex}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-[rgba(229,180,30,0.1)] border border-[rgba(229,180,30,0.2)] flex items-center justify-center mb-6 text-[var(--color-accent)]">
                    {React.createElement(TOUR_CARDS[tourIndex].icon, { className: "w-10 h-10" })}
                  </div>
                  <h2 className="text-[28px] font-semibold text-[var(--color-text-1)] tracking-tight mb-3">
                    {TOUR_CARDS[tourIndex].title}
                  </h2>
                  <p className="text-[16px] text-[var(--color-text-2)] max-w-[280px]">
                    {TOUR_CARDS[tourIndex].desc}
                  </p>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex justify-end">
          <button
            onClick={step === 3 && firstCapture.trim() && !capturedSpace ? handleCapture : handleNext}
            disabled={saving || routing}
            className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-black font-semibold hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50"
          >
            {saving || routing ? <Loader2 className="w-5 h-5 animate-spin" /> : step === 4 && tourIndex === TOUR_CARDS.length - 1 ? "Get started" : step === 3 && firstCapture.trim() && !capturedSpace ? "Save" : "Continue"} 
            {step === 4 && tourIndex === TOUR_CARDS.length - 1 ? <CheckCircle2 className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
