"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { createClient } from "@/lib/supabase";
import { X, Loader2, LogOut, Download, CheckCircle2, User, Palette, Bell, Timer, CheckSquare, Brain, Database, Users, Plus, Trash2, Sparkles, Moon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDebounce } from "use-debounce";
import { cn } from "@/lib/utils";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { ModalErrorBoundary } from "@/components/ui/ModalErrorBoundary";
import { useQueryClient } from "@tanstack/react-query";
const TABS = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "ritual", label: "Daily Ritual", icon: Sparkles },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "people", label: "People", icon: Users },
  { id: "routing", label: "Smart Routing", icon: Brain },
  { id: "data", label: "Data", icon: Database },
];

interface SettingsState {
  [key: string]: unknown;
  display_name?: string;
  avatar_color?: string;
  timezone?: string;
  theme?: string;
  color_mode?: string;
  ambient_bg?: boolean;
  reduce_motion?: boolean;
  notifications_enabled?: boolean;
  quiet_start?: string;
  quiet_end?: string;
  daily_briefing?: boolean;
  pomodoro_sound?: boolean;
  pomodoro_duration?: number;
  short_break_duration?: number;
  long_break_duration?: number;
  auto_start_breaks?: boolean;
  default_view?: string;
  auto_archive_days?: number;
  do_categories?: string[];
  do_category_colors?: Record<string, string>;
  people_categories?: string[];
  relationship_colors?: Record<string, string>;
  auto_snooze?: boolean;
  smart_routing_enabled?: boolean;
  nlp_date_parsing?: boolean;
  routing_confidence?: string;
  ollama_enabled?: boolean;
  ollama_url?: string;
  location_detection?: boolean;
  daily_briefing_time?: string;
  nudge_time?: string;
  shutdown_time?: string;
  pomodoro_long_break_interval?: number;
  daily_capacity_minutes?: number;
}

function CategoryItem({ cat, initialColor, cats, colors, categoriesKey, colorsKey, updateSetting, setSettings, supabase }: {
  cat: string;
  initialColor: string;
  cats: string[];
  colors: Record<string, string>;
  categoriesKey: string;
  colorsKey: string;
  updateSetting: (key: string, value: unknown) => void;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
  supabase: ReturnType<typeof createClient>;
}) {
  const [editName, setEditName] = useState(cat);
  
  const handleRename = async () => {
    const trimmed = editName.trim().toLowerCase();
    if (trimmed && trimmed !== cat && !cats.includes(trimmed)) {
      const newCats = cats.map(c => c === cat ? trimmed : c);
      
      try {
        // 1. Invoke Postgres SQL RPC to atomically rename category across tables
        const { error } = await supabase.rpc('rename_category', {
          p_categories_key: categoriesKey,
          p_colors_key: colorsKey,
          p_old_category: cat,
          p_new_category: trimmed
        });
        
        if (error) throw error;

        // 2. Synchronously update local modal state
        setSettings((prev: SettingsState) => {
          const next = { ...prev };
          next[categoriesKey] = newCats;
          if (colors[cat]) {
            const newColors = { ...colors };
            newColors[trimmed] = newColors[cat];
            delete newColors[cat];
            next[colorsKey] = newColors;
          }
          return next;
        });

        // 3. Synchronously update global AppStore state
        const currentStoreSettings = useAppStore.getState().userSettings;
        const updatedStoreSettings = {
          ...currentStoreSettings,
          [categoriesKey]: newCats,
        };
        if (colors[cat]) {
          const newColors = { ...colors };
          newColors[trimmed] = newColors[cat];
          delete newColors[cat];
          updatedStoreSettings[colorsKey] = newColors;
        }
        useAppStore.getState().setUserSettings(updatedStoreSettings);

        toast.success(`Renamed category to ${trimmed}`);
      } catch (err: any) {
        toast.error("Failed to rename category", { description: err.message });
        setEditName(cat);
      }
    } else {
      setEditName(cat);
    }
  };

  const handleDelete = (delCat: string) => {
    updateSetting(categoriesKey, cats.filter(c => c !== delCat));
  };

  const handleColorChange = (colorCat: string, color: string) => {
    updateSetting(colorsKey, { ...colors, [colorCat]: color });
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
}

function CategoryManager({ 
  title, 
  categoriesKey, 
  colorsKey, 
  defaultCategories,
  settings,
  updateSetting,
  setSettings,
  supabase,
}: { 
  title: string, 
  categoriesKey: string, 
  colorsKey: string, 
  defaultCategories: string[],
  settings: SettingsState,
  updateSetting: (key: string, value: unknown) => void,
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>,
  supabase: ReturnType<typeof createClient>,
}) {
  const cats: string[] = (settings[categoriesKey] as string[]) || defaultCategories;
  const colors: Record<string, string> = (settings[colorsKey] as Record<string, string>) || {};
  const [newCat, setNewCat] = useState("");

  const handleAdd = () => {
    const trimmed = newCat.trim().toLowerCase();
    if (!trimmed || cats.includes(trimmed)) return;
    updateSetting(categoriesKey, [...cats, trimmed]);
    setNewCat("");
  };

  return (
    <div className="space-y-3">
      <label className="block text-label text-[var(--text-3)]">{title}</label>
      <div className="space-y-2">
        {cats.map(cat => (
          <CategoryItem key={cat} cat={cat} initialColor={colors[cat]} cats={cats} colors={colors} categoriesKey={categoriesKey} colorsKey={colorsKey} updateSetting={updateSetting} setSettings={setSettings} supabase={supabase} />
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
}

export function SettingsModal() {
  const { isSettingsModalOpen, setSettingsModalOpen, setUserSettings, settingsActiveTab, setSettingsActiveTab } = useAppStore();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const activeTab = settingsActiveTab || "account";
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [initialLoaded, setInitialLoaded] = useState(false);
  
  // Settings State
  const [settings, setSettings] = useState<SettingsState>({});
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
  const [clearTasksConfirm, setClearTasksConfirm] = useState(false);
  const [clearLocationsConfirm, setClearLocationsConfirm] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [debouncedSettings] = useDebounce(settings, 1000);
  const dialogRef = useDialogFocus(isSettingsModalOpen);

  useEffect(() => {
    if (!isSettingsModalOpen) return;
    
    async function loadSettings() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || "");
      
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).single();
      if (data) {
        setSettings(data);
        setUserSettings(data);
      }
      setLoading(false);
      setTimeout(() => setInitialLoaded(true), 100);
    }
    loadSettings();
  }, [isSettingsModalOpen, supabase, setUserSettings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSettingsModalOpen) {
        setSettingsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsModalOpen, setSettingsModalOpen]);

  useEffect(() => {
    if (!initialLoaded) return;
    
    const save = async () => {
      setSaveStatus("saving");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { user_id: _, created_at: __, ...updateData } = debouncedSettings;
      
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
  }, [debouncedSettings, supabase, initialLoaded, setUserSettings]);

  const updateSetting = (key: string, value: unknown) => {
    setSettings((prev: SettingsState) => ({ ...prev, [key]: value }));
    
    // Immediately apply theme/mode changes
    if (key === 'theme') {
      localStorage.setItem('presense_theme', String(value));
      document.documentElement.classList.remove('theme-navy', 'theme-forest');
      
      if (value === 'blue') document.documentElement.classList.add('theme-navy');
      if (value === 'forest') document.documentElement.classList.add('theme-forest');
    }
    
    if (key === 'color_mode') {
      localStorage.setItem('presense_color_mode', String(value));
      document.documentElement.classList.remove('light');
      
      if (value === 'light') document.documentElement.classList.add('light');
      if (value === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.classList.add('light');
      }
    }

    if (key === 'reduce_motion') {
      localStorage.setItem('presense_reduce_motion', value ? 'true' : 'false');
      if (value) document.documentElement.classList.add('reduce-motion');
      else document.documentElement.classList.remove('reduce-motion');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSettingsModalOpen(false);
    router.push("/login");
  };
  
  const handleExportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      toast.info("Preparing export...");

      const [items, people, threads, explores, locations, settings] = await Promise.all([
        supabase.from("items").select("*").eq("user_id", user.id),
        supabase.from("people").select("*").eq("user_id", user.id),
        supabase.from("threads").select("*").eq("user_id", user.id),
        supabase.from("explores").select("*").eq("user_id", user.id),
        supabase.from("locations").select("*").eq("user_id", user.id),
        supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        items: items.data ?? [],
        people: people.data ?? [],
        threads: threads.data ?? [],
        explores: explores.data ?? [],
        locations: locations.data ?? [],
        settings: settings.data ?? {},
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `presense-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      toast.error("Export failed", { description: message });
    }
  };

  const handleClearCompleted = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("items").delete().eq("user_id", user.id).eq("status", "done");
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Completed tasks cleared");
      setClearTasksConfirm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear tasks";
      toast.error("Failed", { description: message });
    }
  };

  const handleClearStaleLocations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { error } = await supabase.from("locations").delete().eq("user_id", user.id).lt("updated_at", thirtyDaysAgo);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Stale locations cleared");
      setClearLocationsConfirm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear locations";
      toast.error("Failed", { description: message });
    }
  };
  const handleDeleteAccount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Delete all user data across tables
      await Promise.all([
        supabase.from("items").delete().eq("user_id", user.id),
        supabase.from("people").delete().eq("user_id", user.id),
        supabase.from("threads").delete().eq("user_id", user.id),
        supabase.from("explores").delete().eq("user_id", user.id),
        supabase.from("locations").delete().eq("user_id", user.id),
        supabase.from("session_logs").delete().eq("user_id", user.id),
        supabase.from("push_subscriptions").delete().eq("user_id", user.id),
        supabase.from("user_settings").delete().eq("user_id", user.id),
      ]);
      // Sign out — user data deleted, account auth record requires server-side cleanup
      await supabase.auth.signOut();
      toast.success("Account data deleted");
      setSettingsModalOpen(false);
      router.push("/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete account";
      toast.error("Failed", { description: message });
    }
  };

  return (
    <ModalErrorBoundary modalName="Settings Modal" onClose={() => setSettingsModalOpen(false)}>
      <AnimatePresence>
        {isSettingsModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSettingsModalOpen(false)}
          >
            <motion.div 
              ref={dialogRef}
              initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="modal relative w-full max-w-4xl h-[100dvh] md:h-[80vh] flex flex-col md:flex-row overflow-hidden md:rounded-2xl"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Settings"
            >
              <div className="w-full h-full flex flex-col md:flex-row">
                {/* Sidebar Tabs */}
                <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[var(--color-border)] bg-[var(--color-surface)] flex md:flex-col p-4 overflow-x-auto md:overflow-x-visible shrink-0 pb-0 md:pb-4">
                  <h2 className="hidden md:block text-xl font-bold text-[var(--color-text-1)] mb-8 px-2">Settings</h2>
                  <nav className="flex md:flex-col gap-1 w-full pb-2 md:pb-0">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setSettingsActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          activeTab === tab.id 
                            ? "bg-[var(--color-surface)] text-[var(--color-text-1)]" 
                            : "text-[var(--color-text-3)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
                        }`}
                      >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                  
                  <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
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
                    <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--status-danger)] hover:bg-[var(--status-danger-dim)] transition-colors">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 relative overflow-y-auto no-scrollbar">
                  <button 
                    onClick={() => setSettingsModalOpen(false)}
                    aria-label="Close settings"
                    className="btn-icon absolute top-4 right-4 z-10"
                  >
                    <X size={16} strokeWidth={1.5} className="shrink-0" />
                  </button>

                  {loading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-3)]" />
                    </div>
                  ) : (
                    <div className="p-10 max-w-2xl">
                      <h3 className="text-2xl font-bold text-[var(--color-text-1)] mb-8 border-b border-[var(--color-border)] pb-4">
                        {TABS.find(t => t.id === activeTab)?.label}
                      </h3>

                      {activeTab === "account" && (
                        <div className="space-y-6">
                          <div>
                            <label className="text-label text-[var(--text-3)] block mb-2">Email</label>
                            <input
                              value={userEmail}
                              readOnly
                              className="input opacity-60 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="text-label text-[var(--text-3)] block mb-2">Display Name</label>
                            <input
                              value={settings.display_name || ""}
                              onChange={e => updateSetting("display_name", e.target.value)}
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="text-label text-[var(--text-3)] block mb-3">Avatar Color</label>
                            <div className="flex flex-wrap gap-2">
                              {['#F472B6', '#4ADE80', '#3B82F6', '#FBBF24', '#A855F7', '#EF4444'].map(color => (
                                <button key={color} onClick={() => updateSetting("avatar_color", color)} className={`w-8 h-8 rounded-full transition-transform ${settings.avatar_color === color ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[rgba(11,9,20,1)]' : 'opacity-70 hover:opacity-100'}`} style={{ backgroundColor: color }} />
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-label text-[var(--text-3)] block mb-2">Timezone</label>
                            <Dropdown variant="select"
                              value={settings.timezone || "UTC"}
                              onChange={val => updateSetting("timezone", val)}
                              options={
                                typeof Intl !== "undefined" && "supportedValuesOf" in Intl
                                  ? (Intl as any).supportedValuesOf("timeZone").map((tz: string) => ({ value: tz, label: tz.replace(/_/g, " ") }))
                                  : [
                                      { value: "UTC", label: "UTC" },
                                      { value: "America/New_York", label: "Eastern Time (ET)" },
                                      { value: "America/Chicago", label: "Central Time (CT)" },
                                      { value: "America/Denver", label: "Mountain Time (MT)" },
                                      { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
                                      { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
                                      { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
                                    ]
                              }
                            />
                          </div>
                          <div className="pt-8 mt-8 border-t border-[var(--status-danger-border)]">
                            <h4 className="text-sm font-semibold text-[var(--status-danger)] mb-2 flex items-center gap-2">Danger Zone</h4>
                            <p className="text-xs text-[var(--color-text-3)] mb-4">Permanently delete your account and all data.</p>
                            <button onClick={() => setDeleteAccountConfirm(true)} className="w-full btn-danger mt-4">
                              Delete Account
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTab === "appearance" && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Theme Accent</div>
                              <div className="text-sm text-[var(--color-text-3)]">Select your primary colour palette</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateSetting("theme", "orange")} className={`w-8 h-8 rounded-full bg-[#E5B41E] border-2 transition-all ${settings.theme === 'orange' || !settings.theme ? 'border-[var(--color-text-1)] scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`} title="Wahala (Orange)" />
                              <button onClick={() => updateSetting("theme", "blue")} className={`w-8 h-8 rounded-full bg-[#7692FF] border-2 transition-all ${settings.theme === 'blue' ? 'border-[var(--color-text-1)] scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`} title="Deep Navy" />
                              <button onClick={() => updateSetting("theme", "forest")} className={`w-8 h-8 rounded-full bg-[#EFDD8D] border-2 transition-all ${settings.theme === 'forest' ? 'border-[var(--color-text-1)] scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`} title="Forest" />
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Color Mode</div>
                              <div className="text-sm text-[var(--color-text-3)]">Dark, Light, or System match</div>
                            </div>
                            <div className="w-40">
                              <Dropdown variant="select"
                                value={settings.color_mode || "dark"}
                                onChange={val => updateSetting("color_mode", val)}
                                className="w-full"
                                options={[
                                  { value: "dark", label: "Dark" },
                                  { value: "light", label: "Light" },
                                  { value: "system", label: "System Default" }
                                ]}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Ambient Background</div>
                              <div className="text-sm text-[var(--color-text-3)]">Show moving gradients in the background</div>
                            </div>
                            <button onClick={() => updateSetting("ambient_bg", !settings.ambient_bg)} className={`toggle-track ${settings.ambient_bg ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Reduce Motion</div>
                              <div className="text-sm text-[var(--color-text-3)]">Minimize UI animations</div>
                            </div>
                            <button onClick={() => updateSetting("reduce_motion", !settings.reduce_motion)} className={`toggle-track ${settings.reduce_motion ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTab === "notifications" && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] mb-6">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Master Toggle</div>
                              <div className="text-sm text-[var(--color-text-3)]">Enable all notifications</div>
                            </div>
                            <button onClick={() => updateSetting("notifications_enabled", !settings.notifications_enabled)} className={`toggle-track ${settings.notifications_enabled ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-label text-[var(--text-3)] block mb-2">Quiet Start</label>
                              <input type="time" value={settings.quiet_start || "22:00"} onChange={e => updateSetting("quiet_start", e.target.value)} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:border-[var(--color-accent)] focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-label text-[var(--text-3)] block mb-2">Quiet End</label>
                              <input type="time" value={settings.quiet_end || "08:00"} onChange={e => updateSetting("quiet_end", e.target.value)} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:border-[var(--color-accent)] focus:outline-none" />
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Daily Briefing</div>
                              <div className="text-sm text-[var(--color-text-3)]">Receive a summary of today&apos;s tasks</div>
                            </div>
                            <button onClick={() => updateSetting("daily_briefing", !settings.daily_briefing)} className={`toggle-track ${settings.daily_briefing ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Pomodoro Finish Sound</div>
                              <div className="text-sm text-[var(--color-text-3)]">Play a sound when timer completes</div>
                            </div>
                            <button onClick={() => updateSetting("pomodoro_sound", !settings.pomodoro_sound)} className={`toggle-track ${settings.pomodoro_sound ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Deadline Reminders</div>
                              <div className="text-sm text-[var(--color-text-3)]">Get notified as deadlines approach</div>
                            </div>
                            <button onClick={() => updateSetting("notif_overdue", !settings.notif_overdue)} className={`toggle-track ${settings.notif_overdue ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Stale Location Alerts</div>
                              <div className="text-sm text-[var(--color-text-3)]">Remind to update locations older than 90 days</div>
                            </div>
                            <button onClick={() => updateSetting("notif_stale_threads", !settings.notif_stale_threads)} className={`toggle-track ${settings.notif_stale_threads ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTab === "focus" && (
                        <div className="space-y-6">
                          <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-5">
                            <div className="font-semibold text-sm text-[var(--color-text-1)]">Timer Durations</div>
                            
                            <div>
                              <label className="text-label text-[var(--text-3)] block mb-2">Work Duration (mins)</label>
                              <div className="flex flex-wrap gap-2">
                                {[15, 20, 25, 30, 45, 60].map(mins => (
                                  <button key={mins} onClick={() => updateSetting("pomodoro_duration", mins)} className={cn("btn-preset", settings.pomodoro_duration === mins && "active")}>
                                    {mins}m
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-label text-[var(--text-3)] block mb-2">Short Break (mins)</label>
                              <div className="flex flex-wrap gap-2">
                                {[3, 5, 10, 15].map(mins => (
                                  <button key={mins} onClick={() => updateSetting("short_break_duration", mins)} className={cn("btn-preset", settings.short_break_duration === mins && "active")}>
                                    {mins}m
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-label text-[var(--text-3)] block mb-2">Long Break (mins)</label>
                              <div className="flex flex-wrap gap-2">
                                {[15, 20, 30].map(mins => (
                                  <button key={mins} onClick={() => updateSetting("long_break_duration", mins)} className={cn("btn-preset", settings.long_break_duration === mins && "active")}>
                                    {mins}m
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                              <div>
                                <div className="font-medium text-[var(--color-text-1)] text-sm">Auto-start Breaks</div>
                                <div className="text-xs text-[var(--color-text-3)]">Automatically begin break timer when work finishes</div>
                              </div>
                              <button onClick={() => updateSetting("auto_start_breaks", !settings.auto_start_breaks)} className={`toggle-track ${settings.auto_start_breaks ? 'on' : ''}`}>
                                <div className="toggle-thumb" />
                              </button>
                            </div>
                          </div>

                          <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <label className="text-label text-[var(--text-3)] block mb-3">Long Break After (sessions)</label>
                            <div className="flex flex-wrap gap-2">
                              {[2, 3, 4, 5].map(n => (
                                <button key={n} onClick={() => updateSetting("pomodoro_long_break_interval", n)} className={cn("btn-preset", (settings.pomodoro_long_break_interval || 4) === n && "active")}>
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "ritual" && (
                        <div className="space-y-6">
                          <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-6">
                            <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--accent-dim)]">
                                <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-[var(--text-1)]">Daily Ritual</h4>
                                <p className="text-xs text-[var(--text-4)]">Configure your morning planning and evening review times.</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <label className="text-label text-[var(--text-3)] block mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-orange-400" /> Morning Nudge</label>
                                <input type="time" value={settings.nudge_time || "10:00"} onChange={e => updateSetting("nudge_time", e.target.value)} className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:border-[var(--color-accent)] focus:outline-none" />
                                <p className="text-[11px] text-[var(--text-4)] mt-2">When should we remind you to plan your day?</p>
                              </div>
                              <div>
                                <label className="text-label text-[var(--text-3)] block mb-2 flex items-center gap-1.5"><Moon className="w-3.5 h-3.5 text-blue-400" /> Evening Shutdown</label>
                                <input type="time" value={settings.shutdown_time || "17:00"} onChange={e => updateSetting("shutdown_time", e.target.value)} className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:border-[var(--color-accent)] focus:outline-none" />
                                <p className="text-[11px] text-[var(--text-4)] mt-2">When do you usually finish work?</p>
                              </div>
                            </div>

                            <div>
                              <label className="text-label text-[var(--text-3)] block mb-2">Daily Capacity (mins)</label>
                              <div className="flex items-center gap-4">
                                <input
                                  type="range"
                                  min="60" max="720" step="30"
                                  value={settings.daily_capacity_minutes || 240}
                                  onChange={e => updateSetting("daily_capacity_minutes", parseInt(e.target.value))}
                                  className="flex-1 accent-[var(--accent)]"
                                />
                                <span className="w-16 text-right font-medium text-[var(--text-1)]">{Math.floor((settings.daily_capacity_minutes || 240) / 60)}h {(settings.daily_capacity_minutes || 240) % 60}m</span>
                              </div>
                              <p className="text-[11px] text-[var(--text-4)] mt-2">Used for workload visualization during morning planning.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "tasks" && (
                        <div className="space-y-6">
                          <div>
                            <label className="text-label text-[var(--text-3)] block mb-3">Default View</label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateSetting("default_view", "list")}
                                className={cn("btn-preset", (settings.default_view === "list" || !settings.default_view) && "active")}
                              >
                                List View
                              </button>
                              <button
                                onClick={() => updateSetting("default_view", "board")}
                                className={cn("btn-preset", settings.default_view === "board" && "active")}
                              >
                                Board View
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-label text-[var(--text-3)] block mb-2">Auto-archive completed tasks after (days)</label>
                            <input
                              type="number"
                              min={1} max={30}
                              value={settings.auto_archive_days || 7}
                              onChange={e => updateSetting("auto_archive_days", parseInt(e.target.value))}
                              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                            />
                          </div>
                          <CategoryManager 
                            title="Task Categories" 
                            categoriesKey="do_categories" 
                            colorsKey="do_category_colors" 
                            defaultCategories={["work", "study", "personal", "errand", "health"]} 
                            settings={settings}
                            updateSetting={updateSetting}
                            setSettings={setSettings}
                            supabase={supabase}
                          />
                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] mt-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Auto-snooze Overdue</div>
                              <div className="text-sm text-[var(--color-text-3)]">Automatically push overdue tasks to today</div>
                            </div>
                            <button onClick={() => updateSetting("auto_snooze", !settings.auto_snooze)} className={`toggle-track ${settings.auto_snooze ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTab === "people" && (
                        <div className="space-y-6">
                          <CategoryManager 
                            title="Relationship Categories" 
                            categoriesKey="people_categories" 
                            colorsKey="relationship_colors" 
                            defaultCategories={["friend", "family", "professor", "colleague", "teammate", "other"]} 
                            settings={settings}
                            updateSetting={updateSetting}
                            setSettings={setSettings}
                            supabase={supabase}
                          />
                        </div>
                      )}

                      {activeTab === "routing" && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Smart NLP Routing</div>
                              <div className="text-sm text-[var(--color-text-3)]">Automatically route captures based on natural language</div>
                            </div>
                            <button onClick={() => updateSetting("smart_routing_enabled", !settings.smart_routing_enabled)} className={`toggle-track ${settings.smart_routing_enabled ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>



                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Enhanced routing via Ollama</div>
                              <div className="text-sm text-[var(--color-text-3)]">Use local LLM for advanced routing decisions</div>
                            </div>
                            <button onClick={() => updateSetting("ollama_enabled", !settings.ollama_enabled)} className={`toggle-track ${settings.ollama_enabled ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                          {settings.ollama_enabled && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                              <label className="text-label text-[var(--text-3)] block mb-2 mt-4">Ollama URL</label>
                              <div className="flex gap-2">
                                <input
                                  value={settings.ollama_url || "http://localhost:11434"}
                                  onChange={e => updateSetting("ollama_url", e.target.value)}
                                  className="flex-1 bg-[var(--surface-input)] border border-[var(--border-input)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:border-[var(--border-input-focus)] focus:outline-none transition-colors"
                                />
                                <button 
                                  onClick={async () => { 
                                    const url = settings.ollama_url || "http://localhost:11434";
                                    try {
                                      const res = await fetch(`${url}/api/tags`);
                                      if (res.ok) {
                                        const data = await res.json();
                                        const models = data.models || [];
                                        const modelName = models.length > 0 ? models[0].name : "No models found";
                                        toast.success(`Connected — model: ${modelName}`);
                                      } else {
                                        toast.error("Not reachable");
                                      }
                                    } catch {
                                      toast.error("Not reachable");
                                    }
                                  }} 
                                  className="px-4 py-3 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent-border)] text-[var(--accent)] text-sm font-semibold hover:bg-[var(--accent-dim-hover)] transition-colors whitespace-nowrap"
                                >
                                  Test connection
                                </button>
                              </div>
                            </motion.div>
                          )}
                          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] mt-4">
                            <div>
                              <div className="font-medium text-[var(--color-text-1)]">Location Context</div>
                              <div className="text-sm text-[var(--color-text-3)]">Use location to prompt relevant tasks</div>
                            </div>
                            <button onClick={() => updateSetting("location_detection", !settings.location_detection)} className={`toggle-track ${settings.location_detection ? 'on' : ''}`}>
                              <div className="toggle-thumb" />
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTab === "data" && (
                        <div className="space-y-6">
                          <p className="text-sm text-[var(--color-text-3)]">Manage your data and account. All data stays synced across devices.</p>
                          <button
                            type="button"
                            onClick={handleExportData}
                            className="w-full btn-secondary"
                          >
                            <Download size={14} strokeWidth={1.5} className="shrink-0" /> Export All Data
                          </button>
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <button
                              type="button"
                              onClick={() => setClearTasksConfirm(true)}
                              className="w-full btn-danger"
                            >
                              Clear Completed Tasks
                            </button>
                            <button
                              type="button"
                              onClick={() => setClearLocationsConfirm(true)}
                              className="w-full btn-danger"
                            >
                              Clear Stale Locations
                            </button>
                          </div>
                        </div>
                      )}

                      <ConfirmModal isOpen={deleteAccountConfirm} onClose={() => setDeleteAccountConfirm(false)} onConfirm={handleDeleteAccount} title="Delete Account" description="This will permanently delete all your data. This cannot be undone." confirmLabel="Delete Account" inputRequired="DELETE" confirmDestructive />
                      <ConfirmModal isOpen={clearTasksConfirm} onClose={() => setClearTasksConfirm(false)} onConfirm={handleClearCompleted} title="Clear Completed Tasks" description="Remove all completed tasks permanently?" confirmLabel="Clear Tasks" confirmDestructive />
                      <ConfirmModal isOpen={clearLocationsConfirm} onClose={() => setClearLocationsConfirm(false)} onConfirm={handleClearStaleLocations} title="Clear Stale Locations" description="Remove locations not updated in 30+ days?" confirmLabel="Clear Locations" confirmDestructive />

                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalErrorBoundary>
  );
}
