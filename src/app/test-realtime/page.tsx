"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { useRealtime } from "@/hooks/useRealtime";
import { useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function ItemsSubscriber1() {
  const [count, setCount] = useState(0);
  useRealtime("items", () => {
    setCount((prev) => prev + 1);
  });
  return (
    <div data-testid="subscriber-items-1">
      items-1: subscribed ({count} updates)
    </div>
  );
}

function ItemsSubscriber2() {
  const [count, setCount] = useState(0);
  useRealtime("items", () => {
    setCount((prev) => prev + 1);
  });
  return (
    <div data-testid="subscriber-items-2">
      items-2: subscribed ({count} updates)
    </div>
  );
}

function PeopleSubscriber() {
  const [count, setCount] = useState(0);
  useRealtime("people", () => {
    setCount((prev) => prev + 1);
  });
  return (
    <div data-testid="subscriber-people">
      people: subscribed ({count} updates)
    </div>
  );
}

export default function TestRealtimePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <div style={{ padding: "20px" }}>
          <h1>Realtime Test Page</h1>
          <ItemsSubscriber1 />
          <ItemsSubscriber2 />
          <PeopleSubscriber />
        </div>
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
