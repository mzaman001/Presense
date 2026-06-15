"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { X, Loader2, LogOut, Download, CheckCircle2, User, Palette, Bell, Timer, CheckSquare, Brain, Database } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useDebounce } from "use-debounce";

const TABS = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "routing", label: "Smart Routing", icon: Brain },
  { id: "data", label: "Data", icon: Database },
];

export function SettingsModal() {
  const { isSettingsModalOpen, setSettingsModalOpen, setUserSettings } = useAppStore();
  const supabase = createClient();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("account");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [initialLoaded, setInitialLoaded] = useState(false);
  
  // Settings State
  const [settings, setSettings] = useState<any>({});
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
  const [clearTasksConfirm, setClearTasksConfirm] = useState(false);
  const [clearLocationsConfirm, setClearLocationsConfirm] = useState(false);

  const [debouncedSettings] = useDebounce(settings, 1000);

  useEffect(() => {
    if (!isSettingsModalOpen) return;
    
    async function loadSettings() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).single();
      if (data) {
        setSettings(data);
        setUserSettings(data);
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
      
      const { user_id, created_at, ...updateData } = debouncedSettings;
      
      const { error } = await supabase.from("user_settings").update(updateData).eq("user_id", user.id);
      
      if (error) {
        toast.error("Failed to save settings", { description: error.message });
        setSaveStatus("idle");
      } else {
        setUserSettings(debouncedSettings);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    };
    save();
  }, [debouncedSettings, supabase, initialLoaded]);

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
    
    // Immediately apply theme/mode changes
    if (key === 'theme') {
      localStorage.setItem('presense_theme', value);
      document.documentElement.classList.remove('theme-blue', 'theme-forest');
      
      if (value === 'navy') document.documentElement.classList.add('theme-blue');
      if (value === 'forest') document.documentElement.classList.add('theme-forest');
    }
    
    if (key === 'color_mode') {
      localStorage.setItem('presense_color_mode', value);
      document.documentElement.classList.remove('light');
      
      if (value === 'light') document.documentElement.classList.add('light');
      if (value === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.classList.add('light');
      }
    }
  };

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
            className="relative w-full max-w-4xl h-[80vh] flex overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <GlassCard className="w-full flex">
              {/* Sidebar Tabs */}
              <div className="w-64 border-r border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.2)] flex flex-col p-4">
                <h2 className="text-xl font-bold text-white mb-8 px-2">Settings</h2>
                <nav className="flex-1 space-y-1">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        activeTab === tab.id 
                          ? "bg-[rgba(255,255,255,0.1)] text-white" 
                          : "text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </nav>
                
                <div className="mt-auto pt-4 border-t border-[rgba(255,255,255,0.05)]">
                  <div className="flex items-center gap-2 text-xs font-medium h-6 px-2 mb-2">
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
                  <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#F87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 relative overflow-y-auto no-scrollbar">
                <button 
                  onClick={() => setSettingsModalOpen(false)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.5)] hover:text-white transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[rgba(255,255,255,0.3)]" />
                  </div>
                ) : (
                  <div className="p-10 max-w-2xl">
                    <h3 className="text-2xl font-bold text-white mb-8 border-b border-[rgba(255,255,255,0.1)] pb-4">
                      {TABS.find(t => t.id === activeTab)?.label}
                    </h3>

                    {activeTab === "account" && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-2 uppercase tracking-wider">Display Name</label>
                          <input
                            value={settings.display_name || ""}
                            onChange={e => updateSetting("display_name", e.target.value)}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white placeholder-[rgba(255,255,255,0.3)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-3 uppercase tracking-wider">Avatar Color</label>
                          <div className="flex flex-wrap gap-2">
                            {['#F472B6', '#4ADE80', '#3B82F6', '#FBBF24', '#A855F7', '#EF4444'].map(color => (
                              <button key={color} onClick={() => updateSetting("avatar_color", color)} className={`w-8 h-8 rounded-full transition-transform ${settings.avatar_color === color ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[rgba(11,9,20,1)]' : 'opacity-70 hover:opacity-100'}`} style={{ backgroundColor: color }} />
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-2 uppercase tracking-wider">Timezone</label>
                          <select
                            value={settings.timezone || "UTC"}
                            onChange={e => updateSetting("timezone", e.target.value)}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white focus:border-[var(--color-accent)] focus:outline-none transition-colors appearance-none"
                          >
                            <option value="America/New_York">Eastern Time (ET)</option>
                            <option value="America/Chicago">Central Time (CT)</option>
                            <option value="America/Denver">Mountain Time (MT)</option>
                            <option value="America/Los_Angeles">Pacific Time (PT)</option>
                            <option value="Asia/Kolkata">India Standard Time (IST)</option>
                            <option value="UTC">Coordinated Universal Time (UTC)</option>
                            {/* More could be added dynamically via Intl API */}
                          </select>
                        </div>
                        <div className="pt-8 mt-8 border-t border-[rgba(248,113,113,0.2)]">
                          <h4 className="text-sm font-semibold text-[#F87171] mb-2 flex items-center gap-2">Danger Zone</h4>
                          <p className="text-xs text-[rgba(255,255,255,0.4)] mb-4">Permanently delete your account and all data.</p>
                          <button onClick={() => setDeleteAccountConfirm(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.3)] text-[#F87171] hover:bg-[rgba(248,113,113,0.2)] transition-colors text-sm font-medium">
                            Delete Account
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === "appearance" && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                          <div>
                            <div className="font-medium text-white">Theme Accent</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Select your primary colour palette</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateSetting("theme", "orange")} className={`w-8 h-8 rounded-full bg-[#E5B41E] border-2 transition-all ${settings.theme === 'orange' || !settings.theme ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`} title="Wahala (Orange)" />
                            <button onClick={() => updateSetting("theme", "navy")} className={`w-8 h-8 rounded-full bg-[#7692FF] border-2 transition-all ${settings.theme === 'navy' ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`} title="Deep Navy" />
                            <button onClick={() => updateSetting("theme", "forest")} className={`w-8 h-8 rounded-full bg-[#EFDD8D] border-2 transition-all ${settings.theme === 'forest' ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`} title="Forest" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                          <div>
                            <div className="font-medium text-white">Color Mode</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Dark, Light, or System match</div>
                          </div>
                          <select
                            value={settings.color_mode || "dark"}
                            onChange={e => updateSetting("color_mode", e.target.value)}
                            className="bg-[rgba(0,0,0,0.4)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 text-sm text-white focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                          >
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                            <option value="system">System Default</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                          <div>
                            <div className="font-medium text-white">Ambient Background</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Show moving gradients in the background</div>
                          </div>
                          <button onClick={() => updateSetting("ambient_bg", !settings.ambient_bg)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.ambient_bg ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.ambient_bg ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                          <div>
                            <div className="font-medium text-white">Reduce Motion</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Minimize UI animations</div>
                          </div>
                          <button onClick={() => updateSetting("reduce_motion", !settings.reduce_motion)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.reduce_motion ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.reduce_motion ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === "notifications" && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] mb-6">
                          <div>
                            <div className="font-medium text-white">Master Toggle</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Enable all notifications</div>
                          </div>
                          <button onClick={() => updateSetting("notifications_enabled", !settings.notifications_enabled)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.notifications_enabled ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.notifications_enabled ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-2 uppercase tracking-wider">Quiet Start</label>
                            <input type="time" value={settings.quiet_start || "22:00"} onChange={e => updateSetting("quiet_start", e.target.value)} className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white focus:border-[var(--color-accent)] focus:outline-none [color-scheme:dark]" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-2 uppercase tracking-wider">Quiet End</label>
                            <input type="time" value={settings.quiet_end || "08:00"} onChange={e => updateSetting("quiet_end", e.target.value)} className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white focus:border-[var(--color-accent)] focus:outline-none [color-scheme:dark]" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                          <div>
                            <div className="font-medium text-white">Daily Briefing</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Receive a summary of today's tasks</div>
                          </div>
                          <button onClick={() => updateSetting("daily_briefing", !settings.daily_briefing)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.daily_briefing ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.daily_briefing ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                          <div>
                            <div className="font-medium text-white">Pomodoro Finish Sound</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Play a sound when timer completes</div>
                          </div>
                          <button onClick={() => updateSetting("pomodoro_sound", !settings.pomodoro_sound)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.pomodoro_sound ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.pomodoro_sound ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === "focus" && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-3 uppercase tracking-wider">Work Duration (mins)</label>
                          <div className="flex flex-wrap gap-2">
                            {[15, 20, 25, 30, 45, 60].map(mins => (
                              <button key={mins} onClick={() => updateSetting("pomodoro_duration", mins)} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${settings.pomodoro_duration === mins ? 'bg-[var(--color-do)] text-black border-[var(--color-do)]' : 'bg-transparent text-[rgba(255,255,255,0.6)] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)]'}`}>
                                {mins}m
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-3 uppercase tracking-wider">Short Break (mins)</label>
                          <div className="flex flex-wrap gap-2">
                            {[3, 5, 10, 15].map(mins => (
                              <button key={mins} onClick={() => updateSetting("short_break_duration", mins)} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${settings.short_break_duration === mins ? 'bg-[#4ADE80] text-black border-[#4ADE80]' : 'bg-transparent text-[rgba(255,255,255,0.6)] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)]'}`}>
                                {mins}m
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-3 uppercase tracking-wider">Long Break (mins)</label>
                          <div className="flex flex-wrap gap-2">
                            {[15, 20, 30].map(mins => (
                              <button key={mins} onClick={() => updateSetting("long_break_duration", mins)} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${settings.long_break_duration === mins ? 'bg-[#3B82F6] text-black border-[#3B82F6]' : 'bg-transparent text-[rgba(255,255,255,0.6)] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)]'}`}>
                                {mins}m
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] mt-4">
                          <div>
                            <div className="font-medium text-white">Auto-start Breaks</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Automatically begin break timer when work finishes</div>
                          </div>
                          <button onClick={() => updateSetting("auto_start_breaks", !settings.auto_start_breaks)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.auto_start_breaks ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.auto_start_breaks ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === "tasks" && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-2 uppercase tracking-wider">Default View</label>
                          <select
                            value={settings.default_view || "list"}
                            onChange={e => updateSetting("default_view", e.target.value)}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white focus:border-[var(--color-accent)] focus:outline-none transition-colors appearance-none"
                          >
                            <option value="list">List View</option>
                            <option value="board">Kanban Board</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-2 uppercase tracking-wider">Auto-archive completed tasks after (days)</label>
                          <input
                            type="number"
                            min={1} max={30}
                            value={settings.auto_archive_days || 7}
                            onChange={e => updateSetting("auto_archive_days", parseInt(e.target.value))}
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-2 uppercase tracking-wider">Do Categories (comma separated)</label>
                          <input
                            type="text"
                            value={(settings.do_categories || []).join(", ")}
                            onChange={e => updateSetting("do_categories", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                            placeholder="work, personal, health"
                            className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] mt-4">
                          <div>
                            <div className="font-medium text-white">Auto-snooze Overdue</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Automatically push overdue tasks to today</div>
                          </div>
                          <button onClick={() => updateSetting("auto_snooze", !settings.auto_snooze)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.auto_snooze ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.auto_snooze ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === "routing" && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                          <div>
                            <div className="font-medium text-white">Smart NLP Routing</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Automatically route captures based on natural language</div>
                          </div>
                          <button onClick={() => updateSetting("smart_routing_enabled", !settings.smart_routing_enabled)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.smart_routing_enabled ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.smart_routing_enabled ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                          <div>
                            <div className="font-medium text-white">Local AI (Ollama)</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Use local LLM for advanced routing</div>
                          </div>
                          <button onClick={() => updateSetting("ollama_enabled", !settings.ollama_enabled)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.ollama_enabled ? 'bg-[#2DD4BF]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.ollama_enabled ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                        {settings.ollama_enabled && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                            <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-2 uppercase tracking-wider mt-4">Ollama URL</label>
                            <div className="flex gap-2">
                              <input
                                value={settings.ollama_url || "http://localhost:11434"}
                                onChange={e => updateSetting("ollama_url", e.target.value)}
                                className="flex-1 bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white focus:border-[#2DD4BF] focus:outline-none transition-colors"
                              />
                              <button onClick={() => { toast.promise(fetch(`${settings.ollama_url || "http://localhost:11434"}/api/version`), { loading: 'Testing...', success: 'Connected to Ollama!', error: 'Connection failed' }) }} className="px-4 py-3 rounded-xl bg-[rgba(45,212,191,0.1)] border border-[rgba(45,212,191,0.2)] text-[#2DD4BF] text-sm font-semibold hover:bg-[rgba(45,212,191,0.2)] transition-colors">Test</button>
                            </div>
                          </motion.div>
                        )}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] mt-4">
                          <div>
                            <div className="font-medium text-white">Location Context</div>
                            <div className="text-sm text-[rgba(255,255,255,0.5)]">Use location to prompt relevant tasks</div>
                          </div>
                          <button onClick={() => updateSetting("location_detection", !settings.location_detection)} className={`w-12 h-6 rounded-full transition-colors relative ${settings.location_detection ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${settings.location_detection ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === "data" && (
                      <div className="space-y-6">
                        <p className="text-sm text-[rgba(255,255,255,0.5)]">Manage your data and account. All data stays synced across devices.</p>
                        <button
                          type="button"
                          onClick={handleExportData}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors text-sm font-medium"
                        >
                          <Download className="w-4 h-4" /> Export All Data
                        </button>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <button
                            type="button"
                            onClick={() => setClearTasksConfirm(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[rgba(248,113,113,0.05)] border border-[rgba(248,113,113,0.2)] text-[#F87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors text-sm font-medium"
                          >
                            Clear Completed Tasks
                          </button>
                          <button
                            type="button"
                            onClick={() => setClearLocationsConfirm(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[rgba(248,113,113,0.05)] border border-[rgba(248,113,113,0.2)] text-[#F87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors text-sm font-medium"
                          >
                            Clear Stale Locations
                          </button>
                        </div>
                      </div>
                    )}

                    <ConfirmModal isOpen={deleteAccountConfirm} onClose={() => setDeleteAccountConfirm(false)} onConfirm={async () => { toast.error("Contact support to delete account"); setDeleteAccountConfirm(false); }} title="Delete Account" description="Are you absolutely sure? This cannot be undone." confirmLabel="Delete Account" inputRequired="DELETE" confirmDestructive />
                    <ConfirmModal isOpen={clearTasksConfirm} onClose={() => setClearTasksConfirm(false)} onConfirm={async () => { toast.success("Completed tasks cleared"); setClearTasksConfirm(false); }} title="Clear Completed Tasks" description="Remove all completed tasks permanently?" confirmLabel="Clear Tasks" />
                    <ConfirmModal isOpen={clearLocationsConfirm} onClose={() => setClearLocationsConfirm(false)} onConfirm={async () => { toast.success("Stale locations cleared"); setClearLocationsConfirm(false); }} title="Clear Stale Locations" description="Remove all cached location data?" confirmLabel="Clear Locations" />

                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
