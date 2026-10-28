"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function CollapsibleSection({
  defaultOpen = true,
  header,
  children,
}: {
  defaultOpen?: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-gold/15 bg-cocoa overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between cursor-pointer hover:bg-white/5/5 transition-colors"
      >
        <div className="flex-1 min-w-0">{header}</div>
        <div className="shrink-0 pr-4">
          {open ? (
            <ChevronDown className="h-4 w-4 text-white/40" />
          ) : (
            <ChevronRight className="h-4 w-4 text-white/40" />
          )}
        </div>
      </button>
      {open && children}
    </section>
  );
}
