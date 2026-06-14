"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { createClient } from "@/lib/supabase";
import { ArrowLeft, Loader2, Save, Trash2, Archive, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/GlassCard";

export default function ExploreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("other");
  const [tagsStr, setTagsStr] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("active");
  const [linkedThreadId, setLinkedThreadId] = useState<string | null>(null);
  
  const [threads, setThreads] = useState<any[]>([]);

  const fetchItem = useCallback(async () => {
    const { data: item } = await supabase.from("explores").select("*").eq("id", id).single();
    if (item) {
      setTitle(item.title);
      setUrl(item.url || "");
      setType(item.type);
      setTagsStr((item.tags || []).join(", "));
      setNote(item.note || "");
      setStatus(item.status || "active");
      setLinkedThreadId(item.linked_thread_id);

      if (!item.revisited_at) {
        supabase.from("explores").update({ revisited_at: new Date().toISOString() }).eq("id", id).then();
      }
    }

    const { data: threadData } = await supabase.from("threads").select("id, title").eq("status", "active");
    setThreads(threadData || []);
    
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchItem(); }, [fetchItem]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
      const { error } = await supabase.from("explores").update({
        title,
        url: url || null,
        type,
        note,
        tags,
        linked_thread_id: linkedThreadId || null
      }).eq("id", id);
      if (error) throw error;
      toast.success("Saved");
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    try {
      const newStatus = status === "archived" ? "active" : "archived";
      const { error } = await supabase.from("explores").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
      toast.success(newStatus === "archived" ? "Archived" : "Restored");
      router.push("/explore");
    } catch (err: any) {
      toast.error("Failed to archive", { description: err.message });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this? It will be permanently removed in 30 days.")) return;
    try {
      const { error } = await supabase.from("explores").update({ status: "deleted" }).eq("id", id);
      if (error) throw error;
      toast.success("Deleted (30-day trash)");
      router.push("/explore");
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[rgba(255,255,255,0.3)]" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <Link href="/explore" className="inline-flex items-center gap-2 text-sm text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Explore
        </Link>
        <div className="flex items-center gap-2">
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-[rgba(255,255,255,0.05)] text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button onClick={handleArchive} className="p-2 rounded-lg bg-[rgba(255,255,255,0.05)] text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors">
            <Archive className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} className="p-2 rounded-lg bg-[rgba(248,113,113,0.1)] text-[#F87171] hover:bg-[rgba(248,113,113,0.2)] transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <GlassCard className="p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FBBF24]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FBBF24]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-[#13111C] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FBBF24]"
              >
                <option value="link">Link</option>
                <option value="book">Book</option>
                <option value="quote">Quote</option>
                <option value="concept">Concept</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">Tags (comma separated)</label>
              <input
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FBBF24]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">Link to Think Thread</label>
            <select
              value={linkedThreadId || ""}
              onChange={(e) => setLinkedThreadId(e.target.value || null)}
              className="w-full bg-[#13111C] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FBBF24]"
            >
              <option value="">-- No Thread Linked --</option>
              {threads.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">Notes</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FBBF24] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center w-full gap-2 px-4 py-2 rounded-lg bg-[#FBBF24] text-black font-semibold hover:bg-[#F59E0B] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
