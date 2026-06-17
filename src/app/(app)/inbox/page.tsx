"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Inbox, Loader2, FolderInput, CheckCircle2, MessageSquare, Compass, X } from "lucide-react";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";

interface InboxItem {
  id: string;
  title: string;
  user_id: string;
}

export default function InboxPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  
  const [activeRouteItem, setActiveRouteItem] = useState<string | null>(null);

  const { data: inboxItems = [], isLoading: loading, refetch } = useQuery({
    queryKey: ["inbox-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("status", "inbox")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InboxItem[];
    }
  });

  useRealtime("items", refetch);

  const routeInboxItem = async (id: string, space: string) => {
    if (!space) return;
    try {
      if (space === 'do') {
        await supabase.from('items').update({ status: 'active' }).eq('id', id);
      } else if (space === 'explore') {
        const item = inboxItems.find(i => i.id === id);
        if (item) {
          await supabase.from('items').delete().eq('id', id);
          await supabase.from('explores').insert({ user_id: item.user_id, title: item.title, type: 'other', status: 'active' });
        }
      } else if (space === 'think') {
        const item = inboxItems.find(i => i.id === id);
        if (item) {
          await supabase.from('items').delete().eq('id', id);
          await supabase.from('threads').insert({ user_id: item.user_id, title: item.title, status: 'active', color_accent: '#2DD4BF' });
        }
      }
      toast.success(`Routed to ${space}`);
      queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    } catch (e) {
      toast.error('Failed to route item');
    }
  };

  const dismissInboxItem = async (id: string) => {
    try {
      await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
      queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    } catch (e) {
      toast.error('Failed to dismiss');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.35)] font-semibold mb-1">Space</p>
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-medium text-[var(--color-text-1)] tracking-tight flex items-center gap-2">
              <Inbox size={22} className="text-[var(--accent)]" />
              Inbox
            </h1>
          </div>
        </div>
      </div>

      <ContextualTip 
        id="inbox_space" 
        title="Unload your brain" 
        description="Dump everything here. Process them later by routing them to the Do, Think, or Explore space." 
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-3)]" />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-4 pt-4">
          {inboxItems.length === 0 ? (
            <div className="text-sm text-[var(--color-text-3)] text-center py-16 border border-dashed border-[rgba(255,255,255,0.08)] rounded-xl">
              Inbox zero. Mind clear.
            </div>
          ) : (
            inboxItems.map((item) => (
              <GlassCard key={item.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-amber-500/5 border-amber-500/20 group hover:bg-amber-500/10 transition-colors">
                <p className="text-card-title text-[var(--text-1)] flex-1 text-lg">{item.title}</p>
                <div className="flex items-center gap-2 w-full md:w-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                  <div className="relative flex-1 md:flex-none">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveRouteItem(activeRouteItem === item.id ? null : item.id); }}
                      className="btn-secondary w-full"
                    >
                      <FolderInput className="w-3.5 h-3.5" />
                      Route it
                    </button>
                    {activeRouteItem === item.id && (
                      <div className="dropdown-panel absolute top-full mt-2 right-0 w-48 p-1 z-50 animate-in fade-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { routeInboxItem(item.id, 'do'); setActiveRouteItem(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-do)]" /> Do (Task)
                        </button>
                        <button onClick={() => { routeInboxItem(item.id, 'think'); setActiveRouteItem(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-[var(--color-think)]" /> Think (Thread)
                        </button>
                        <button onClick={() => { routeInboxItem(item.id, 'explore'); setActiveRouteItem(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <Compass className="w-4 h-4 text-[var(--color-explore)]" /> Explore (Saved)
                        </button>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => dismissInboxItem(item.id)}
                    className="btn-icon !bg-transparent !border-transparent hover:!bg-red-500/10 hover:!text-red-400 shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}
    </div>
  );
}
