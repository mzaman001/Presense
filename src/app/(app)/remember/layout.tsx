"use client";
import { PageHeader } from "@/components/ui/PageHeader";


import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, MapPin } from "lucide-react";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { Icon as UiIcon } from "@/components/ui/Icon";

export default function RememberLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <div className="space-y-6">
      <PageHeader title="Remember" />

      <ContextualTip 
        id="remember_space" 
        title="Your personal CRM & Inventory" 
        description="Track people you meet and where you put things. Switch between People and Locations below." 
      />

      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-4">
        <Link 
          href="/remember/people"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-card-title transition-all",
            pathname.includes("/people") ? "bg-[var(--color-surface)] text-[var(--color-text-1)]" : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface)]"
          )}
        >
          <UiIcon className="w-4 h-4" icon={Users} /> People
        </Link>
        <Link 
          href="/remember/locations"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-card-title transition-all",
            pathname.includes("/locations") ? "bg-[var(--color-surface)] text-[var(--color-text-1)]" : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface)]"
          )}
        >
          <UiIcon className="w-4 h-4" icon={MapPin} /> Locations
        </Link>
      </div>

      <div>
        {children}
      </div>
    </div>
  );
}

