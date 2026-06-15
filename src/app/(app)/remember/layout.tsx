"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, MapPin } from "lucide-react";
import { ContextualTip } from "@/components/ui/ContextualTip";

export default function RememberLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.35)] font-semibold mb-1">Space</p>
          <h1 className="text-[22px] font-medium text-white tracking-tight">Remember</h1>
        </div>
      </div>

      <ContextualTip 
        id="remember_space" 
        title="Your personal CRM & Inventory" 
        description="Track people you meet and where you put things. Switch between People and Locations below." 
      />

      <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.05)] pb-4">
        <Link 
          href="/remember/people"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            pathname.includes("/people") ? "bg-[rgba(255,255,255,0.1)] text-white" : "text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]"
          )}
        >
          <Users className="w-4 h-4" /> People
        </Link>
        <Link 
          href="/remember/locations"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            pathname.includes("/locations") ? "bg-[rgba(255,255,255,0.1)] text-white" : "text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]"
          )}
        >
          <MapPin className="w-4 h-4" /> Locations
        </Link>
      </div>

      <div>
        {children}
      </div>
    </div>
  );
}
