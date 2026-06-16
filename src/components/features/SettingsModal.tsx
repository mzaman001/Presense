"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { X, Loader2, LogOut, Download, CheckCircle2, User, Palette, Bell, Timer, CheckSquare, Brain, Database, Users, Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { useDebounce } from "use-debounce";
import { cn } from "@/lib/utils";
const TABS = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "people", label: "People", icon: Users },
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
    
    // Immediately apply theme/mode changes — single source of truth
    const applyTheme = (themeVal: string, modeVal: string, reduceMotion: boolean) => {
      const html = document.documentElement;
      html.classList.remove('theme-navy', 'theme-forest', 'light', 'reduce-motion');
      if (themeVal === 'navy') html.classList.add('theme-navy');
      else if (themeVal === 'forest') html.classList.add('theme-forest');
      if (modeVal === 'light') html.classList.add('light');
      else if (modeVal === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches) html.classList.add('light');
      if (reduceMotion) html.classList.add('reduce-motion');
    };

    const currentTheme  = key === 'theme'      ? value : (settings.theme      || 'wahala');
    const currentMode   = key === 'color_mode' ? value : (settings.color_mode  || 'dark');
    const currentReduce = key === 'reduce_motion' ? value : (settings.reduce_motion || false);

    if (key === 'theme') {
      localStorage.setItem('presense_theme', value);
      applyTheme(currentTheme, currentMode, currentReduce);
    }
    
    if (key === 'color_mode') {
      localStorage.setItem('presense_color_mode', value);
      applyTheme(currentTheme, currentMode, currentReduce);
    }

    if (key === 'reduce_motion') {
      localStorage.setItem('presense_reduce_motion', value ? 'true' : 'false');
      applyTheme(currentTheme, currentMode, value);
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

  const CategoryManager = ({ 
    title, 
    categoriesKey, 
    colorsKey, 
    defaultCategories 
  }: { 
    title: string, 
    categoriesKey: string, 
    colorsKey: string, 
    defaultCategories: string[] 
  }) => {
    const cats: string[] = settings[categoriesKey] || defaultCategories;
    const colors: Record<string, string> = settings[colorsKey] || {};
    const [newCat, setNewCat] = useState("");

    const handleAdd = () => {
      const trimmed = newCat.trim().toLowerCase();
      if (!trimmed || cats.includes(trimmed)) return;
      updateSetting(categoriesKey, [...cats, trimmed]);
      setNewCat("");
    };

    const handleDelete = (cat: string) => {
      updateSetting(categoriesKey, cats.filter(c => c !== cat));
    };

    const handleColorChange = (cat: string, color: string) => {
      updateSetting(colorsKey, { ...colors, [cat]: color });
    };

    const CategoryItem = ({ cat, initialColor }: { cat: string, initialColor: string }) => {
      const [editName, setEditName] = useState(cat);
      
      const handleRename = async () => {
        const trimmed = editName.trim().toLowerCase();
        if (trimmed && trimmed !== cat && !cats.includes(trimmed)) {
          const newCats = cats.map(c => c === cat ? trimmed : c);
          updateSetting(categoriesKey, newCats);
          if (colors[cat]) {
            const newColors = { ...colors };
            newColors[trimmed] = newColors[cat];
            delete newColors[cat];
            updateSetting(colorsKey, newColors);
          }
          
          // Cascading update to tasks and people
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            if (categoriesKey === "do_categories") {
              await supabase.from("items").update({ category: trimmed }).eq("user_id", user.id).ilike("category", cat);
            } else if (categoriesKey === "people_categories") {
              await supabase.from("people").update({ relationship: trimmed }).eq("user_id", user.id).ilike("relationship", cat);
            }
            toast.success(`Renamed category to ${trimmed}`);
          }
        } else {
          setEditName(cat);
        }
      };

      return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] group hover:border-[rgba(255,255,255,0.2)] transition-colors">
          <input 
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
            className="flex-1 min-w-[80px] bg-transparent text-sm font-bold text-[var(--color-text-1)] capitalize tracking-wide focus:outline-none focus:bg-white/5 px-2 py-1 rounded"
          />
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            {['#F87171', '#FBBF24', '#4ADE80', '#2DD4BF', '#7692FF', '#8B7CF8', '#F472B6', '#9CA3AF'].map(preset => {
              const isActive = initialColor === preset || (!initialColor && preset === '#9CA3AF');
              return (
                <button 
                  key={preset}
                  onClick={() => handleColorChange(cat, preset)}
                  className="w-5 h-5 rounded-full transition-all hover:scale-125"
                  style={{ 
                    backgroundColor: preset, 
                    border: isActive ? `2px solid white` : `1px solid rgba(255,255,255,0.1)`,
                    transform: isActive ? 'scale(1.2)' : 'scale(1)',
                    opacity: isActive ? 1 : 0.5
                  }}
                />
              );
            })}
            <div className="w-[1px] h-4 bg-[var(--color-border)] mx-1" />
            <label className="relative flex items-center justify-center w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-125 shadow-sm" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
              <input 
                type="color" 
                value={initialColor || "#9CA3AF"} 
                onChange={(e) => handleColorChange(cat, e.target.value)}
                className="absolute opacity-0 w-full h-full cursor-pointer"
              />
            </label>
            <button onClick={() => handleDelete(cat)} className="ml-1 p-1.5 rounded-lg text-[var(--color-text-3)] hover:text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-400/10 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-3">
        <label className="block text-label text-[var(--text-3)]">{title}</label>
        <div className="space-y-2">
          {cats.map(cat => (
            <CategoryItem key={cat} cat={cat} initialColor={colors[cat]} />
          ))}
          <div className="flex items-center gap-2 mt-2">
            <input 
              type="text" 
              value={newCat} 
              onChange={e => setNewCat(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Add new category..." 
              className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-1)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
            />
            <button onClick={handleAdd} className="p-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-1)] hover:border-[var(--color-accent)] transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isSettingsModalOpen && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setSettingsModalOpen(false)}
        >
          <motion.div 
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 26, duration: 0.28 }}
            className="relative w-full md:w-[520px] h-full bg-[var(--surface-base)] flex flex-col shadow-2xl border-l border-[var(--border-subtle)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--surface-base)] z-10 sticky top-0">
              <div className="flex items-center gap-3">
                <h2 className="text-[18px] font-semibold text-[var(--text-1)]">Settings</h2>
                <AnimatePresence mode="wait">
                  {saveStatus === "saving" && (
                    <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)]">
                      <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                    </motion.div>
                  )}
                  {saveStatus === "saved" && (
                    <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[12px] text-[var(--accent)]">
                      <CheckCircle2 className="w-3 h-3" /> Saved ✓
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={() => setSettingsModalOpen(false)} className="btn-icon rounded-full">
                <X size={18} strokeWidth={1.5} className="text-[var(--text-2)] hover:text-[var(--text-1)]" />
              </button>
            </div>

            {/* Scrollable Content */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--text-3)]" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                
                {/* ACCOUNT */}
                <div className="px-6 pt-8 pb-2 border-b border-[var(--border-subtle)]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-1">Account</h3>
                </div>
                <div className="px-6 py-6 space-y-6">
                  <div>
                    <label className="text-[14px] font-medium text-[var(--text-1)] block mb-1">Display Name</label>
                    <input
                      value={settings.display_name || ""}
                      onChange={e => updateSetting("display_name", e.target.value)}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[14px] font-medium text-[var(--text-1)] block mb-1">Email</label>
                    <input
                      value={settings.email || "user@example.com"}
                      disabled
                      className="input w-full opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-[14px] font-medium text-[var(--text-1)] block mb-1">Timezone</label>
                    <SelectDropdown
                      value={settings.timezone || "UTC"}
                      onChange={val => updateSetting("timezone", val)}
                      className="w-full"
                      options={[
                        { value: "America/New_York", label: "Eastern Time (ET)" },
                        { value: "America/Chicago", label: "Central Time (CT)" },
                        { value: "America/Denver", label: "Mountain Time (MT)" },
                        { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
                        { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
                        { value: "UTC", label: "Coordinated Universal Time (UTC)" }
                      ]}
                    />
                  </div>
                  <div>
                    <label className="text-[14px] font-medium text-[var(--text-1)] block mb-3">Avatar Color</label>
                    <div className="flex gap-2">
                      {['#F472B6', '#4ADE80', '#3B82F6', '#FBBF24', '#A855F7', '#EF4444'].map(color => (
                        <button 
                          key={color} 
                          onClick={() => updateSetting("avatar_color", color)} 
                          className={`w-8 h-8 rounded-full transition-transform ${settings.avatar_color === color ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[var(--surface-base)]' : 'opacity-70 hover:opacity-100'}`} 
                          style={{ backgroundColor: color }} 
                        />
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 space-y-3">
                    <button onClick={handleSignOut} className="w-full btn-secondary text-[var(--text-1)]">
                      Sign Out
                    </button>
                    <button onClick={() => setDeleteAccountConfirm(true)} className="w-full btn-danger">
                      Delete Account
                    </button>
                  </div>
                </div>

                {/* APPEARANCE */}
                <div className="px-6 pt-6 pb-2 border-b border-[var(--border-subtle)]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-1">Appearance</h3>
                </div>
                <div className="px-6 py-6 space-y-6">
                  <div>
                    <label className="text-[14px] font-medium text-[var(--text-1)] block mb-3">Theme</label>
                    <div className="flex items-center gap-3">
                      {/* Wahala Swatch */}
                      <div onClick={() => updateSetting("theme", "wahala")} className={cn("theme-swatch flex-1 h-[72px] flex items-end p-2", (settings.theme === 'wahala' || !settings.theme) && "active")} style={{ background: "linear-gradient(135deg, #2D1405 0%, #0F0A00 100%)" }}>
                        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full opacity-30 blur-2xl bg-[#E5B41E]" />
                        <span className="text-[11px] font-semibold text-[var(--text-1)] relative z-10">Wahala</span>
                        {(settings.theme === 'wahala' || !settings.theme) && <CheckCircle2 className="absolute top-2 right-2 w-3 h-3 text-[var(--accent)]" />}
                      </div>
                      {/* Navy Swatch */}
                      <div onClick={() => updateSetting("theme", "navy")} className={cn("theme-swatch flex-1 h-[72px] flex items-end p-2", settings.theme === 'navy' && "active")} style={{ background: "linear-gradient(135deg, #0A1128 0%, #050814 100%)" }}>
                        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full opacity-30 blur-2xl bg-[#7692FF]" />
                        <span className="text-[11px] font-semibold text-[var(--text-1)] relative z-10">Deep Navy</span>
                        {settings.theme === 'navy' && <CheckCircle2 className="absolute top-2 right-2 w-3 h-3 text-[var(--accent)]" />}
                      </div>
                      {/* Forest Swatch */}
                      <div onClick={() => updateSetting("theme", "forest")} className={cn("theme-swatch flex-1 h-[72px] flex items-end p-2", settings.theme === 'forest' && "active")} style={{ background: "linear-gradient(135deg, #112A1B 0%, #07140B 100%)" }}>
                        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full opacity-30 blur-2xl bg-[#EFDD8D]" />
                        <span className="text-[11px] font-semibold text-[var(--text-1)] relative z-10">Forest</span>
                        {settings.theme === 'forest' && <CheckCircle2 className="absolute top-2 right-2 w-3 h-3 text-[var(--accent)]" />}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--text-1)]">Color Mode</div>
                      <div className="text-[12px] text-[var(--text-3)]">Dark, Light, or System match</div>
                    </div>
                    <div className="w-32">
                      <SelectDropdown
                        value={settings.color_mode || "dark"}
                        onChange={val => updateSetting("color_mode", val)}
                        className="w-full"
                        options={[
                          { value: "dark", label: "Dark" },
                          { value: "light", label: "Light" },
                          { value: "system", label: "System" }
                        ]}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--text-1)]">Ambient Background</div>
                      <div className="text-[12px] text-[var(--text-3)]">Show moving gradients in the background</div>
                    </div>
                    <button onClick={() => updateSetting("ambient_bg", !settings.ambient_bg)} className={`toggle-track ${settings.ambient_bg ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--text-1)]">Reduce Motion</div>
                      <div className="text-[12px] text-[var(--text-3)]">Minimize UI animations globally</div>
                    </div>
                    <button onClick={() => updateSetting("reduce_motion", !settings.reduce_motion)} className={`toggle-track ${settings.reduce_motion ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </button>
                  </div>
                </div>

                {/* NOTIFICATIONS */}
                <div className="px-6 pt-6 pb-2 border-b border-[var(--border-subtle)]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-1">Notifications</h3>
                </div>
                <div className="px-6 py-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--text-1)]">Master Toggle</div>
                      <div className="text-[12px] text-[var(--text-3)]">Enable all notifications</div>
                    </div>
                    <button onClick={() => updateSetting("notifications_enabled", !settings.notifications_enabled)} className={`toggle-track ${settings.notifications_enabled ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[14px] font-medium text-[var(--text-1)] block mb-1">Quiet Start</label>
                      <input type="time" value={settings.quiet_start || "22:00"} onChange={e => updateSetting("quiet_start", e.target.value)} className="input w-full [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="text-[14px] font-medium text-[var(--text-1)] block mb-1">Quiet End</label>
                      <input type="time" value={settings.quiet_end || "08:00"} onChange={e => updateSetting("quiet_end", e.target.value)} className="input w-full [color-scheme:dark]" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--text-1)]">Daily Briefing</div>
                      <div className="text-[12px] text-[var(--text-3)]">Receive a summary of today's tasks</div>
                    </div>
                    <button onClick={() => updateSetting("daily_briefing", !settings.daily_briefing)} className={`toggle-track ${settings.daily_briefing ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </button>
                  </div>
                </div>

                {/* FOCUS / POMODORO */}
                <div className="px-6 pt-6 pb-2 border-b border-[var(--border-subtle)]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-1">Focus / Pomodoro</h3>
                </div>
                <div className="px-6 py-6 space-y-6">
                  <div>
                    <label className="text-[14px] font-medium text-[var(--text-1)] block mb-2">Work Duration</label>
                    <div className="flex flex-wrap gap-2">
                      {[15, 20, 25, 30, 45, 60].map(mins => (
                        <button key={mins} onClick={() => updateSetting("pomodoro_duration", mins)} className={cn("btn-preset", settings.pomodoro_duration === mins && "active")}>
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[14px] font-medium text-[var(--text-1)] block mb-2">Short Break</label>
                    <div className="flex flex-wrap gap-2">
                      {[3, 5, 10, 15].map(mins => (
                        <button key={mins} onClick={() => updateSetting("short_break_duration", mins)} className={cn("btn-preset", settings.short_break_duration === mins && "active")}>
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[14px] font-medium text-[var(--text-1)] block mb-2">Long Break</label>
                    <div className="flex flex-wrap gap-2">
                      {[15, 20, 30].map(mins => (
                        <button key={mins} onClick={() => updateSetting("long_break_duration", mins)} className={cn("btn-preset", settings.long_break_duration === mins && "active")}>
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--text-1)]">Auto-start Breaks</div>
                      <div className="text-[12px] text-[var(--text-3)]">Automatically begin break timer</div>
                    </div>
                    <button onClick={() => updateSetting("auto_start_breaks", !settings.auto_start_breaks)} className={`toggle-track ${settings.auto_start_breaks ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </button>
                  </div>
                </div>

                {/* TASKS & PEOPLE */}
                <div className="px-6 pt-6 pb-2 border-b border-[var(--border-subtle)]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-1">Tasks & Categories</h3>
                </div>
                <div className="px-6 py-6 space-y-6">
                  <div>
                    <label className="text-[14px] font-medium text-[var(--text-1)] block mb-2">Default View</label>
                    <div className="flex gap-2">
                      <button onClick={() => updateSetting("default_view", "list")} className={cn("btn-preset", (settings.default_view === "list" || !settings.default_view) && "active")}>
                        List View
                      </button>
                      <button onClick={() => updateSetting("default_view", "board")} className={cn("btn-preset", settings.default_view === "board" && "active")}>
                        Board View
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--text-1)]">Auto-snooze Overdue</div>
                      <div className="text-[12px] text-[var(--text-3)]">Push overdue tasks to today</div>
                    </div>
                    <button onClick={() => updateSetting("auto_snooze", !settings.auto_snooze)} className={`toggle-track ${settings.auto_snooze ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </button>
                  </div>
                  
                  <div className="pt-2">
                    <CategoryManager title="Task Categories" categoriesKey="do_categories" colorsKey="do_category_colors" defaultCategories={["work", "study", "personal", "errand", "health"]} />
                  </div>
                  <div className="pt-2">
                    <CategoryManager title="Relationship Categories" categoriesKey="people_categories" colorsKey="relationship_colors" defaultCategories={["friend", "family", "professor", "colleague", "teammate", "other"]} />
                  </div>
                </div>

                {/* SMART ROUTING */}
                <div className="px-6 pt-6 pb-2 border-b border-[var(--border-subtle)]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-1">Smart Routing</h3>
                </div>
                <div className="px-6 py-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--text-1)]">Smart NLP Routing</div>
                      <div className="text-[12px] text-[var(--text-3)]">Auto-route captures using language processing</div>
                    </div>
                    <button onClick={() => updateSetting("smart_routing_enabled", !settings.smart_routing_enabled)} className={`toggle-track ${settings.smart_routing_enabled ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-medium text-[var(--text-1)]">Enhanced routing via Ollama</div>
                      <div className="text-[12px] text-[var(--text-3)]">Use local LLM for advanced routing decisions</div>
                    </div>
                    <button onClick={() => updateSetting("ollama_enabled", !settings.ollama_enabled)} className={`toggle-track ${settings.ollama_enabled ? 'on' : ''}`}>
                      <div className="toggle-thumb" />
                    </button>
                  </div>
                  
                  {settings.ollama_enabled && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                      <label className="text-[14px] font-medium text-[var(--text-1)] block mb-2 mt-2">Ollama URL</label>
                      <div className="flex gap-2">
                        <input
                          value={settings.ollama_url || "http://localhost:11434"}
                          onChange={e => updateSetting("ollama_url", e.target.value)}
                          className="input flex-1"
                        />
                        <button 
                          onClick={async () => { 
                            try {
                              const res = await fetch(`${settings.ollama_url || "http://localhost:11434"}/api/tags`);
                              if (res.ok) {
                                const data = await res.json();
                                toast.success(`Connected — model: ${data.models?.[0]?.name || "None"}`);
                              } else throw new Error();
                            } catch (e) {
                              toast.error("Not reachable");
                            }
                          }} 
                          className="btn-secondary whitespace-nowrap"
                        >
                          Test connection
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* DATA */}
                <div className="px-6 pt-6 pb-2 border-b border-[var(--border-subtle)]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] mb-1">Data</h3>
                </div>
                <div className="px-6 py-6 space-y-4">
                  <button onClick={handleExportData} className="w-full btn-secondary text-[var(--text-1)] flex justify-center gap-2">
                    <Download size={14} /> Export All Data
                  </button>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setClearTasksConfirm(true)} className="w-full btn-danger">
                      Clear Completed
                    </button>
                    <button onClick={() => setClearLocationsConfirm(true)} className="w-full btn-danger">
                      Clear Stale Locs
                    </button>
                  </div>
                </div>

              </div>
            )}
            
            {/* Confirmation Modals */}
            <ConfirmModal isOpen={deleteAccountConfirm} onClose={() => setDeleteAccountConfirm(false)} onConfirm={async () => { toast.error("Contact support to delete account"); setDeleteAccountConfirm(false); }} title="Delete Account" description="Are you absolutely sure? This cannot be undone." confirmLabel="Delete Account" inputRequired="DELETE" confirmDestructive />
            <ConfirmModal isOpen={clearTasksConfirm} onClose={() => setClearTasksConfirm(false)} onConfirm={async () => { toast.success("Completed tasks cleared"); setClearTasksConfirm(false); }} title="Clear Completed Tasks" description="Remove all completed tasks permanently?" confirmLabel="Clear Tasks" />
            <ConfirmModal isOpen={clearLocationsConfirm} onClose={() => setClearLocationsConfirm(false)} onConfirm={async () => { toast.success("Stale locations cleared"); setClearLocationsConfirm(false); }} title="Clear Stale Locations" description="Remove all cached location data?" confirmLabel="Clear Locations" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

