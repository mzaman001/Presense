"use client";
import { PageHeader } from "@/components/ui/PageHeader";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, MapPin } from "lucide-react";
import { ContextualTip } from "@/components/ui/ContextualTip";
import { Icon as UiIcon } from "@/components/ui/Icon";

export default function RememberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <PageHeader title="Remember" />

      <ContextualTip
        id="remember_space"
        title="Your personal CRM & Inventory"
        description="Track people you meet and where you put things. Switch between People and Locations below."
      />

      <div className="flex items-center gap-2 border-b border-[var(--border-default)] pb-4">
        <Link
          href="/remember/locations"
          className={cn(
            "text-card-title flex items-center gap-2 rounded-lg px-4 py-2 transition-all",
            pathname.includes("/locations")
              ? "bg-[var(--surface-1)] text-[var(--text-1)]"
              : "text-[var(--text-3)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]",
          )}
        >
          <UiIcon className="h-4 w-4" icon={MapPin} /> Locations
        </Link>
        <Link
          href="/remember/people"
          className={cn(
            "text-card-title flex items-center gap-2 rounded-lg px-4 py-2 transition-all",
            pathname.includes("/people")
              ? "bg-[var(--surface-1)] text-[var(--text-1)]"
              : "text-[var(--text-3)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]",
          )}
        >
          <UiIcon className="h-4 w-4" icon={Users} /> People
        </Link>
      </div>

      <div>{children}</div>
    </div>
  );
}
