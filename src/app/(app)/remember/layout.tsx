import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContextualTip } from "@/components/ui/ContextualTip";

// Server Component: the single-tab "Locations" bar that used to sit here
// was the only thing that needed the client (usePathname), and a tab bar
// with one tab is just a divider with a label. Removed.
export default function RememberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Remember"
        description="Where you keep things, so you don't have to remember."
      />

      <ContextualTip
        id="remember_space"
        title="Track where things are"
        description="Note where things are kept, and get a nudge about ones you haven't checked in a while."
      />

      <div>{children}</div>
    </div>
  );
}
