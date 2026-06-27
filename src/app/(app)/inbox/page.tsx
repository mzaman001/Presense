"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { Inbox, Loader2, FolderInput, CheckCircle2, MessageSquare, Compass, Brain, X, MapPin } from "lucide-react";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { motion } from "framer-motion";

interface InboxItem {
  id: string;
  title: string;
  user_id: string;
}

export default function InboxPage() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  
  const [activeRouteItem, setActiveRouteItem] = useState<string | null>(null);
  const [slidingOut, setSlidingOut] = useState<string | null>(null);
  const activeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        activeRouteItem &&
        activeDropdownRef.current &&
        !activeDropdownRef.current.contains(event.target as Node)
      ) {
        setActiveRouteItem(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeRouteItem]);

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

    const item = inboxItems.find(i => i.id === id);
    if (!item) return;

    setSlidingOut(id);
    setActiveRouteItem(null);

    setTimeout(async () => {
      // Optimistically remove from cache after animation starts
      queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], old => old?.filter(i => i.id !== id) ?? []);

      try {
        let routedId: string | null = null;

        if (space === 'do') {
          await supabase.from('items').update({ status: 'active' }).eq('id', id);
        } else if (space === 'remember') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
            const { data: inserted, error: insertError } = await supabase.from('people').insert({
              user_id: user.id,
              name: item.title,
              notes: [{ text: item.title, created_at: new Date().toISOString(), tag: "note" }]
            }).select('id').single();

            if (insertError) throw insertError;
            if (inserted) {
              routedId = inserted.id;
            }
          }
        } else if (space === 'explore') {
          await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
          const { data: inserted, error: insertError } = await supabase.from('explores').insert({
            user_id: item.user_id,
            title: item.title,
            type: 'other',
            status: 'active'
          }).select('id').single();

          if (insertError) throw insertError;
          if (inserted) {
            routedId = inserted.id;
          }
        } else if (space === 'think') {
          await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
          const { data: inserted, error: insertError } = await supabase.from('threads').insert({
            user_id: item.user_id,
            title: item.title,
            status: 'active',
            color_accent: '#2DD4BF'
          }).select('id').single();

          if (insertError) throw insertError;
          if (inserted) {
            routedId = inserted.id;
          }
        } else if (space === 'location') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
            const { data: inserted, error: insertError } = await supabase.from('locations').insert({
              user_id: user.id,
              item_name: item.title,
              location_text: item.title
            }).select('id').single();

            if (insertError) throw insertError;
            if (inserted) {
              routedId = inserted.id;
            }
          }
        }

        toast.success(`Routed to ${space}`, {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                // Reverse the operation
                if (space === 'do') {
                  await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
                } else if (space === 'remember') {
                  if (routedId) {
                    await supabase.from('people').delete().eq('id', routedId);
                  }
                  await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
                } else if (space === 'explore') {
                  if (routedId) {
                    await supabase.from('explores').delete().eq('id', routedId);
                  }
                  await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
                } else if (space === 'think') {
                  if (routedId) {
                    await supabase.from('threads').delete().eq('id', routedId);
                  }
                  await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
                } else if (space === 'location') {
                  if (routedId) {
                    await supabase.from('locations').delete().eq('id', routedId);
                  }
                  await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
                }
                // Restore to cache
                queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], old => [item, ...(old ?? [])]);
                toast.success("Restored to inbox");
              } catch {
                toast.error("Failed to undo");
                refetch();
              }
            }
          }
        });
      } catch (e) {
        // Restore to cache on error
        queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], old => [item, ...(old ?? [])]);
        toast.error('Failed to route item');
      } finally {
        setSlidingOut(null);
      }
    }, 280);
  };

  const dismissInboxItem = async (id: string) => {
    const item = inboxItems.find(i => i.id === id);
    if (!item) return;

    // Optimistically remove from cache
    queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], old => old?.filter(i => i.id !== id) ?? []);

    try {
      await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
      toast.success("Dismissed", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await supabase.from('items').update({ status: 'inbox' }).eq('id', id);
              queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], old => [item, ...(old ?? [])]);
              toast.success("Restored to inbox");
            } catch {
              toast.error("Failed to undo");
              refetch();
            }
          }
        }
      });
    } catch (e) {
      queryClient.setQueryData<InboxItem[]>(["inbox-tasks"], old => [item, ...(old ?? [])]);
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
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={slidingOut === item.id ? { opacity: 0, x: 60, scale: 0.96 } : { opacity: 1, y: 0, x: 0, scale: 1 }}
                transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="glass-card !overflow-visible flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-amber-500/5 border-amber-500/20 group hover:bg-amber-500/10 transition-colors"
              >
                <p className="text-card-title text-[var(--text-1)] flex-1 text-lg">{item.title}</p>
                <div className="flex items-center gap-2 w-full md:w-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                  <div 
                    className="relative flex-1 md:flex-none"
                    ref={activeRouteItem === item.id ? activeDropdownRef : null}
                  >
                    <button 
                      onClick={() => { setActiveRouteItem(activeRouteItem === item.id ? null : item.id); }}
                      className="btn-secondary w-full"
                    >
                      <FolderInput className="w-3.5 h-3.5" />
                      Route it
                    </button>
                    {activeRouteItem === item.id && (
                      <div className="dropdown-panel absolute top-full mt-2 right-0 w-48 p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <button onClick={() => routeInboxItem(item.id, 'do')} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-do)]" /> Do (Task)
                        </button>
                        <button onClick={() => routeInboxItem(item.id, 'think')} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-[var(--color-think)]" /> Think (Thread)
                        </button>
                        <button onClick={() => routeInboxItem(item.id, 'explore')} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <Compass className="w-4 h-4 text-[var(--color-explore)]" /> Explore (Saved)
                        </button>
                        <button onClick={() => routeInboxItem(item.id, 'remember')} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <Brain className="w-4 h-4 text-[var(--color-people)]" /> Remember (Person)
                        </button>
                        <button onClick={() => routeInboxItem(item.id, 'location')} className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-1)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[var(--color-people)]" /> Locations
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
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
