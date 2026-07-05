import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ 
  title, 
  subtitle = "Space", 
  actions, 
  children 
}: { 
  title: ReactNode; 
  subtitle?: string; 
  actions?: ReactNode; 
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-4 shrink-0">
      <div>
        <p className="text-label text-[var(--text-3)] mb-1">
          {subtitle}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-page-title text-[var(--color-text-1)] tracking-tight">{title}</h1>
          {children}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
