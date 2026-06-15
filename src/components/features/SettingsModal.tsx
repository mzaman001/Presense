"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { X, Loader2, LogOut, Download, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";

export function SettingsModal() {
  const { isSettingsModalOpen, setSettingsModalOpen } = useAppStore();
  const supabase = createClient();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [initialLoaded, setInitialLoaded] = useState(false);
  
  const [displayName, setDisplayName] = useState("");
  const [pomodoroDuration, setPomodoroDuration] = useState(25);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [ollamaEnabled, setOllamaEnabled] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");

  const [debouncedDisplayName] = useDebounce(displayName, 1000);
  const [debouncedOllamaUrl] = useDebounce(ollamaUrl, 1000);

  useEffect(() => {
    if (!isSettingsModalOpen) return;
    
    async function loadSettings() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).single();
      if (data) {
        setDisplayName(data.display_name || "");
        setPomodoroDuration(data.pomodoro_duration != null ? Number(data.pomodoro_duration) : 25);
        setNotificationsEnabled(data.notifications_enabled !== false);
        setOllamaEnabled(data.ollama_enabled || false);
        setOllamaUrl(data.ollama_url || "http://localhost:11434");
      }
      setLoading(false);
      setTimeout(() => setInitialLoaded(true), 100);
    }
    loadSettings();
  }, [isSettingsModalOpen, supabase]);

  useEffect(() => {
    if (!initialLoaded) return;
    
    const save = async () => {
      setSaveStatus("saving");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.from("user_settings").update({
        display_name: debouncedDisplayName,
        pomodoro_duration: pomodoroDuration,
        notifications_enabled: notificationsEnabled,
        ollama_enabled: ollamaEnabled,
        ollama_url: debouncedOllamaUrl
      }).eq("user_id", user.id);
      
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    };
    save();
  }, [debouncedDisplayName, pomodoroDuration, notificationsEnabled, ollamaEnabled, debouncedOllamaUrl, supabase, initialLoaded]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSettingsModalOpen(false);
    router.push("/login");
  };
  
  const handleExportData = async () => {
    toast.success("Data export started. You will receive an email shortly.");
  };

  return (
    <AnimatePresence>
      {isSettingsModalOpen && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSettingsModalOpen(false)}
        >
          <motion.div 
            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <GlassCard className="p-6">
              <button 
                onClick={() => setSettingsModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.5)] hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-between mb-6 pr-8">
                <h2 className="text-xl font-semibold text-white">Settings</h2>
                <div className="flex items-center gap-2 text-xs font-medium h-6">
                  <AnimatePresence mode="wait">
                    {saveStatus === "saving" && (
                      <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[var(--color-text-3)]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </motion.div>
                    )}
                    {saveStatus === "saved" && (
                      <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[var(--color-think)]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-[rgba(255,255,255,0.3)]" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Account */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-[rgba(255,255,255,0.8)] border-b border-[rgba(255,255,255,0.1)] pb-2">Account</h3>
                    <div>
                      <label className="block text-xs font-medium text-[rgba(255,255,255,0.6)] mb-2 uppercase tracking-wider">Display Name</label>
                      <input
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="w-full bg-[#13111C] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white placeholder-[rgba(255,255,255,0.3)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Preferences */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-[rgba(255,255,255,0.8)] border-b border-[rgba(255,255,255,0.1)] pb-2">Preferences</h3>
                    
                    <div>
                      <label className="block text-xs font-medium text-[rgba(255,255,255,0.6)] mb-2 uppercase tracking-wider">Pomodoro Duration</label>
                      <div className="flex flex-wrap gap-2">
                        {[15, 20, 25, 30, 45, 60].map(mins => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setPomodoroDuration(mins)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${pomodoroDuration === mins ? 'bg-[var(--color-accent)] text-black border-[var(--color-accent)]' : 'bg-transparent text-[var(--color-text-2)] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)]'}`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-[rgba(255,255,255,0.02)] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                      <div>
                        <div className="text-sm font-medium text-white">Push Notifications</div>
                        <div className="text-xs text-[rgba(255,255,255,0.5)]">Receive nudges and digests</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${notificationsEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Advanced / AI */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-[rgba(255,255,255,0.8)] border-b border-[rgba(255,255,255,0.1)] pb-2">Advanced (AI Routing)</h3>
                    <div className="flex items-center justify-between bg-[rgba(255,255,255,0.02)] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                      <div>
                        <div className="text-sm font-medium text-white">Local AI Routing (Ollama)</div>
                        <div className="text-xs text-[rgba(255,255,255,0.5)]">Use local LLM for smart routing</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOllamaEnabled(!ollamaEnabled)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${ollamaEnabled ? 'bg-[#2DD4BF]' : 'bg-[rgba(255,255,255,0.1)]'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${ollamaEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    {ollamaEnabled && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                        <label className="block text-xs font-medium text-[rgba(255,255,255,0.6)] mb-2 uppercase tracking-wider mt-2">Ollama URL</label>
                        <input
                          value={ollamaUrl}
                          onChange={e => setOllamaUrl(e.target.value)}
                          className="w-full bg-[#13111C] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white placeholder-[rgba(255,255,255,0.3)] focus:border-[#2DD4BF] focus:outline-none transition-colors"
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Data Export */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleExportData}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors text-sm font-medium"
                    >
                      <Download className="w-4 h-4" /> Export All Data
                    </button>
                  </div>
                  
                  <div className="pt-4 border-t border-[rgba(255,255,255,0.1)] flex justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[rgba(248,113,113,0.1)] text-[#F87171] font-medium hover:bg-[rgba(248,113,113,0.2)] transition-colors flex-1"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
