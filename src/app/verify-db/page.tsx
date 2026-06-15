"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type TestResult = { name: string; status: "pending" | "success" | "error"; error?: string };

export default function VerifyDbPage() {
  const supabase = createClient();
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const runTests = async () => {
    setRunning(true);
    setResults([]);

    const log = (name: string, status: "success" | "error", error?: string) => {
      setResults((prev) => [...prev, { name, status, error }]);
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        log("Auth Check", "error", "No user logged in. Please log in first.");
        setRunning(false);
        return;
      }
      setUserId(user.id);
      log("Auth Check", "success");

      const uid = user.id;

      // 1. Items Table
      const { data: itemsData, error: itemsErr } = await supabase.from("items").insert({
        user_id: uid,
        title: "DB Verification Test Task",
        category: "work",
        status: "active",
        first_step: "Run the test"
      }).select();
      if (itemsErr) log("Items Table Insert", "error", itemsErr.message);
      else {
        log("Items Table Insert", "success");
        if (itemsData?.[0]?.id) await supabase.from("items").delete().eq("id", itemsData[0].id);
      }

      // 2. People Table
      const { data: peopleData, error: peopleErr } = await supabase.from("people").insert({
        user_id: uid,
        name: "Test Person",
        relationship: "friend",
        color: "#ffffff",
        notes: [] // Crucial check for the JSONB array
      }).select();
      if (peopleErr) log("People Table Insert", "error", peopleErr.message);
      else {
        log("People Table Insert", "success");
        if (peopleData?.[0]?.id) await supabase.from("people").delete().eq("id", peopleData[0].id);
      }

      // 3. Threads Table
      const { data: threadsData, error: threadsErr } = await supabase.from("threads").insert({
        user_id: uid,
        title: "Test Thread",
        color_accent: "#ffffff",
        entries: [{ text: "Test Entry", created_at: new Date().toISOString() }],
        last_updated: new Date().toISOString()
      }).select();
      if (threadsErr) log("Threads Table Insert", "error", threadsErr.message);
      else {
        log("Threads Table Insert", "success");
        if (threadsData?.[0]?.id) await supabase.from("threads").delete().eq("id", threadsData[0].id);
      }

      // 4. Explores Table
      const { data: exploresData, error: exploresErr } = await supabase.from("explores").insert({
        user_id: uid,
        title: "Test Explore",
        type: "link",
        note: "Test Note"
      }).select();
      if (exploresErr) log("Explores Table Insert", "error", exploresErr.message);
      else {
        log("Explores Table Insert", "success");
        if (exploresData?.[0]?.id) await supabase.from("explores").delete().eq("id", exploresData[0].id);
      }

      // 5. Locations Table
      const { data: locData, error: locErr } = await supabase.from("locations").insert({
        user_id: uid,
        item_name: "Test Location Item",
        location_text: "In the test DB"
      }).select();
      if (locErr) log("Locations Table Insert", "error", locErr.message);
      else {
        log("Locations Table Insert", "success");
        if (locData?.[0]?.id) await supabase.from("locations").delete().eq("id", locData[0].id);
      }

      // 6. User Settings
      const { error: settingsErr } = await supabase.from("user_settings").upsert({
        user_id: uid,
        quiet_start: "22:00:00",
        quiet_end: "08:00:00"
      });
      if (settingsErr) log("User Settings Upsert", "error", settingsErr.message);
      else log("User Settings Upsert", "success");

    } catch (e: any) {
      log("Global Execution Error", "error", e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0914] text-[var(--color-text-1)] p-8 font-mono">
      <h1 className="text-2xl font-bold mb-4">DB & RLS Verification Tool</h1>
      <p className="text-gray-400 mb-8 max-w-2xl">
        This tool executes Step 1 of the PRESENSE Fix Order. It attempts to insert and delete a dummy row in every table using your authenticated user context to verify that RLS policies are not silently blocking writes.
      </p>

      <button
        onClick={runTests}
        disabled={running}
        className="bg-purple-600 hover:bg-purple-700 text-[var(--color-text-1)] px-6 py-2 rounded mb-8 disabled:opacity-50 flex items-center gap-2"
      >
        {running && <Loader2 className="w-4 h-4 animate-spin" />}
        {running ? "Running Tests..." : "Run DB Verification"}
      </button>

      {userId && <p className="mb-4 text-green-400 text-sm">Authenticated User ID: {userId}</p>}

      <div className="space-y-3">
        {results.map((r, i) => (
          <div key={i} className={`p-4 rounded border ${r.status === "success" ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"}`}>
            <div className="flex items-center gap-3">
              {r.status === "success" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
              <span className="font-semibold">{r.name}</span>
            </div>
            {r.error && (
              <div className="mt-2 text-sm text-red-300 ml-8 font-mono bg-red-950/50 p-2 rounded">
                {r.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
