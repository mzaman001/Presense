"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase";
import { useRealtime } from "@/hooks/useRealtime";

export function useInboxCount() {
  const userId = useUserId();
  const supabase = useMemo(() => createClient(), []);
  const query = useQuery({
    queryKey: ["inbox-tasks", "count", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "inbox");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
  useRealtime("items", query.refetch);
  return query;
}
