"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface HistoryEntry {
  path: string;
  title: string;
}

let entries: HistoryEntry[] = [];
const listeners = new Set<() => void>();

function pushEntry(path: string) {
  const last = entries[entries.length - 1];
  if (last?.path === path) return;

  const title = path === "/"
    ? "home"
    : path.split("/").filter(Boolean).pop() || path;

  entries = [...entries, { path, title }].slice(-12);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return entries;
}

function getServerSnapshot() {
  return [] as HistoryEntry[];
}

export function HistoryRail() {
  const pathname = usePathname();
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    pushEntry(pathname);
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
