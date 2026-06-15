"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { ArrowRight, Loader2, Brain, Users, Lightbulb, Bookmark, CheckCircle2, Zap, Compass, Check } from "lucide-react";
import { toast } from "sonner";
import { routeCapture, RoutedItem } from "@/lib/capture-router";

interface OnboardingWizardProps {
  initialName: string;
}

const STRUGGLES = [
  { id: "do", icon: Brain, label: "Things I need to do keep slipping" },
  { id: "remember", icon: Users, label: "I forget what people told me" },
  { id: "think", icon: Lightbulb, label: "Ideas disappear before I capture them" },
  { id: "explore", icon: Bookmark, label: "I save things but never come back to them" }
];

const TOUR_CARDS = [
  { id: "do", icon: CheckCircle2, title: "Do", desc: "Your tasks, shown one step at a time. No overwhelm.", color: "#F87171" },
  { id: "think", icon: Brain, title: "Think", desc: "Ongoing thoughts, plans, and a daily note. Your mind on paper.", color: "#2DD4BF" },
  { id: "remember", icon: Users, title: "Remember", desc: "What people told you. Where you left things. Never forget again.", color: "#F472B6" },
  { id: "explore", icon: Compass, title: "Explore", desc: "Links, books, quotes, ideas. Saved and resurfaced every Sunday.", color: "#FBBF24" },
  { id: "ready", icon: Check, title: "You're ready", desc: "", color: "#4ADE80" }
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
    if (captureInput.trim()) {
      const items = routeCapture(captureInput);
      setRoutedItem(items[0] || null);
    } else {
      setRoutedItem(null);
    }
  }, [captureInput]);

  const handleNext1 = async () => {
    if (!name.trim()) {
      setNameError("Please enter your name");
      return;
    }
    setNameError("");
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("user_settings").upsert({
          user_id: user.id,
          display_name: name
        }, { onConflict: "user_id" });
      }
      setStep(2);
    } catch (e) {
      console.error(e);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("user_settings").update({
          primary_struggles: selectedStruggles
        }).eq("user_id", user.id);
      }
      setStep(3);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save struggles");
    } finally {
      setSaving(false);
    }
  };

  const handleNext3 = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Calculate nudge_time (wakeTime + 30 mins)
        const [wH, wM] = wakeTime.split(":").map(Number);
        const nudgeDate = new Date();
        nudgeDate.setHours(wH, wM + 30, 0);
        const nudgeTimeStr = `${String(nudgeDate.getHours()).padStart(2, '0')}:${String(nudgeDate.getMinutes()).padStart(2, '0')}:00`;

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        await supabase.from("user_settings").update({
          nudge_time: nudgeTimeStr,
          quiet_start: sleepTime + ":00",
          quiet_end: wakeTime + ":00",
          timezone: timezone
        }).eq("user_id", user.id);
      }
      setStep(4);
    } catch (e) {
      console.error(e);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const item = routedItem || routeCapture(captureInput)[0];
      if (item) {
        if (item.destination === "Do" || item.destination === "Inbox") {
          await supabase.from("items").insert({
            user_id: user.id,
            title: item.title,
            list_id: item.destination === "Inbox" ? null : undefined, // Assuming null list_id is Inbox
            deadline: item.deadline || null
          });
        } else if (item.destination.startsWith("Remember")) {
          if (item.type === "person_note") {
             const { data: person } = await supabase.from("people").select("*").eq("name", item.person || item.title.split(" ")[0]).maybeSingle();
             if (person) {
               await supabase.from("people").update({ notes: [...(person.notes ?? []), { text: item.title, created_at: new Date().toISOString(), tag: "note" }] }).eq("id", person.id);
             } else {
               await supabase.from("people").insert({
                 user_id: user.id,
                 name: item.person || item.title.split(" ")[0],
                 notes: [{ text: item.title, created_at: new Date().toISOString(), tag: "note" }]
               });
             }
          } else {
             await supabase.from("locations").insert({
               user_id: user.id,
               item_name: item.item_name || item.title.split(" ")[0] || "Item",
               location_text: item.title,
             });
          }
        } else if (item.destination === "Think") {
          await supabase.from("threads").insert({
            user_id: user.id,
            title: item.title.slice(0, 60),
            entries: [{ text: item.title, created_at: new Date().toISOString(), starred: false }],
          });
        } else if (item.destination === "Explore") {
          await supabase.from("explores").insert({
            user_id: user.id,
            title: item.title.slice(0, 100),
            type: item.url ? "link" : "concept",
            url: item.url ?? null,
            note: item.title,
          });
        }
        toast.success(`Saved to ${item.destination}`);
      }
      setStep(5);
    } catch (e) {
      console.error(e);
      toast.error("Failed to capture");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("user_settings").update({
          onboarding_complete: true
        }).eq("user_id", user.id);
      }
      router.push("/");
    } catch (e) {
      console.error(e);
      toast.error("Failed to complete onboarding");
      setSaving(false);
    }
  };

  const toggleStruggle = (id: string) => {
    if (selectedStruggles.includes(id)) {
      setSelectedStruggles(selectedStruggles.filter(s => s !== id));
    } else {
      setSelectedStruggles([...selectedStruggles, id]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-md space-y-6">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-text-1)]">What should we call you?</h1>
            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="Your first name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleNext1()}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl px-5 py-4 text-xl outline-none focus:border-[var(--color-accent)] transition-colors text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)]"
              />
              {nameError && <p className="text-red-400 text-sm px-2">{nameError}</p>}
            </div>
            <button
              onClick={handleNext1}
              disabled={saving}
              className="w-full flex justify-center items-center gap-2 py-4 rounded-2xl bg-[var(--color-text-1)] text-[var(--color-background)] font-semibold text-lg hover:bg-opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Next <ArrowRight className="w-5 h-5" /></>}
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-lg space-y-8">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-1)] text-center">What keeps slipping through the cracks?</h1>
            <div className="grid grid-cols-2 gap-4">
              {STRUGGLES.map((s) => {
                const isSelected = selectedStruggles.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStruggle(s.id)}
                    className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all text-center gap-4 ${isSelected ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-2)] hover:border-[var(--color-text-3)]'}`}
                  >
                    <s.icon className={`w-8 h-8 ${isSelected ? 'text-amber-500' : 'text-[var(--color-text-3)]'}`} />
                    <span className="text-sm font-medium leading-tight">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 py-4 rounded-2xl border border-[var(--color-border)] text-[var(--color-text-2)] font-semibold text-lg hover:bg-[var(--color-surface)] transition-colors">Back</button>
              <button
                onClick={handleNext2}
                disabled={saving || selectedStruggles.length === 0}
                className="flex-[2] flex justify-center items-center gap-2 py-4 rounded-2xl bg-[var(--color-text-1)] text-[var(--color-background)] font-semibold text-lg hover:bg-opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Next <ArrowRight className="w-5 h-5" /></>}
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-md space-y-8">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-1)]">When does your day usually start and end?</h1>
            <div className="space-y-6">
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-2">
                <label className="block text-sm font-semibold text-[var(--color-text-2)] uppercase tracking-wider">I'm usually up by</label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={e => setWakeTime(e.target.value)}
                  className="w-full bg-transparent text-2xl font-bold text-[var(--color-text-1)] outline-none [color-scheme:dark]"
                />
              </div>
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 space-y-2">
                <label className="block text-sm font-semibold text-[var(--color-text-2)] uppercase tracking-wider">I wind down around</label>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={e => setSleepTime(e.target.value)}
                  className="w-full bg-transparent text-2xl font-bold text-[var(--color-text-1)] outline-none [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(2)} className="flex-1 py-4 rounded-2xl border border-[var(--color-border)] text-[var(--color-text-2)] font-semibold text-lg hover:bg-[var(--color-surface)] transition-colors">Back</button>
              <button
                onClick={handleNext3}
                disabled={saving}
                className="flex-[2] flex justify-center items-center gap-2 py-4 rounded-2xl bg-[var(--color-text-1)] text-[var(--color-background)] font-semibold text-lg hover:bg-opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Next <ArrowRight className="w-5 h-5" /></>}
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-xl space-y-8">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-1)]">Let's try it. What's one thing on your mind right now?</h1>
            <div className="relative">
              <textarea
                autoFocus
                placeholder="Remind me to call Mom on Sunday..."
                value={captureInput}
                onChange={e => setCaptureInput(e.target.value)}
                className="w-full h-32 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 text-xl outline-none focus:border-[var(--color-accent)] transition-colors text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] resize-none"
              />
              <AnimatePresence>
                {routedItem && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-4 left-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)] px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                    <Zap className="w-4 h-4" /> → This will go to {routedItem.destination}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(3)} className="flex-1 py-4 rounded-2xl border border-[var(--color-border)] text-[var(--color-text-2)] font-semibold text-lg hover:bg-[var(--color-surface)] transition-colors">Back</button>
              <button
                onClick={handleNext4}
                disabled={saving || !captureInput.trim()}
                className="flex-[2] flex justify-center items-center gap-2 py-4 rounded-2xl bg-[var(--color-text-1)] text-[var(--color-background)] font-semibold text-lg hover:bg-opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : "Capture & continue"}
              </button>
            </div>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div key="step5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm flex flex-col items-center text-center space-y-8">
            <div className="relative w-full h-64 overflow-hidden rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col items-center justify-center p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tourIndex}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="flex flex-col items-center text-center"
                >
                  {React.createElement(TOUR_CARDS[tourIndex].icon, { className: "w-16 h-16 mb-6", style: { color: TOUR_CARDS[tourIndex].color } })}
                  <h2 className="text-2xl font-bold text-[var(--color-text-1)] mb-3">{TOUR_CARDS[tourIndex].id === "ready" ? `Presense is set up for you, ${name.split(" ")[0]}. Let's go.` : TOUR_CARDS[tourIndex].title}</h2>
                  <p className="text-[var(--color-text-2)]">{TOUR_CARDS[tourIndex].desc}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            
            <div className="flex gap-2 mb-8">
              {TOUR_CARDS.map((_, idx) => (
                <button key={idx} onClick={() => setTourIndex(idx)} className={`w-2 h-2 rounded-full transition-all ${idx === tourIndex ? 'bg-[var(--color-accent)] w-6' : 'bg-[var(--color-border)] hover:bg-[var(--color-text-3)]'}`} />
              ))}
            </div>

            <div className="w-full space-y-4">
              {tourIndex < TOUR_CARDS.length - 1 ? (
                <button
                  onClick={() => setTourIndex(tourIndex + 1)}
                  className="w-full flex justify-center items-center gap-2 py-4 rounded-2xl bg-[var(--color-text-1)] text-[var(--color-background)] font-semibold text-lg hover:bg-opacity-90 transition-opacity"
                >
                  Next <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="w-full flex justify-center items-center gap-2 py-4 rounded-2xl bg-[#4ADE80] text-green-950 font-bold text-lg hover:bg-[#22c55e] transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : "Start using Presense"}
                </button>
              )}
              <button onClick={handleFinish} className="text-[var(--color-text-3)] text-sm font-medium hover:text-[var(--color-text-1)] transition-colors">
                Skip tour →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
