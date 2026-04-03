"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface HistoryEntry {
  path: string;
  title: string;
}

export function HistoryRail() {
  const pathname = usePathname();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory((prev) => {
      // Don't add duplicates of the current page
      if (prev.length > 0 && prev[prev.length - 1].path === pathname) {
        return prev;
      }

      // Derive a short title from the pathname
      const title = pathname === "/"
        ? "home"
        : pathname.split("/").filter(Boolean).pop() || pathname;

      const next = [...prev, { path: pathname, title }];
      // Keep last 12 entries
      return next.slice(-12);
    });
  }, [pathname]);

  if (history.length <= 1) return null;

  return (
    <div className="border-b border-border bg-background overflow-x-auto">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-7 gap-1">
        <span className="text-[9px] uppercase tracking-wider text-muted mr-2 shrink-0">
          history
        </span>
        {history.map((entry, i) => (
          <Link
            key={`${entry.path}-${i}`}
            href={entry.path}
            className={`text-[10px] tracking-wider no-underline px-2 py-0.5 shrink-0 ${
              entry.path === pathname
                ? "text-foreground border-b border-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {entry.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
