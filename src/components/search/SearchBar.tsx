"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface SearchResult {
  documents: {
    id: string;
    slug: string;
    title: string;
    type: string;
    source: string;
    author: { name: string };
  }[];
  companies: {
    id: string;
    slug: string;
    name: string;
    sector: { name: string };
  }[];
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
      setOpen(true);
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="SEARCH..."
        className="w-full border border-border bg-transparent px-3 py-1.5 text-xs tracking-wider placeholder:text-muted focus:outline-none focus:border-foreground"
      />
      {open && results && (
        <div className="absolute top-full left-0 right-0 mt-px border border-foreground bg-background z-50 max-h-80 overflow-y-auto">
          {results.companies.length > 0 && (
            <div className="border-b border-border">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted">
                Companies
              </div>
              {results.companies.map((c) => (
                <Link
                  key={c.id}
                  href={`/companies/${c.slug}`}
                  onClick={() => { setOpen(false); setQuery(""); }}
                  className="block px-3 py-2 text-xs no-underline text-foreground hover:bg-surface"
                >
                  {c.name}
                  <span className="text-muted ml-2">{c.sector.name}</span>
                </Link>
              ))}
            </div>
          )}
          {results.documents.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted">
                Documents
              </div>
              {results.documents.map((d) => (
                <Link
                  key={d.id}
                  href={`/documents/${d.slug}`}
                  onClick={() => { setOpen(false); setQuery(""); }}
                  className="block px-3 py-2 text-xs no-underline text-foreground hover:bg-surface"
                >
                  {d.title}
                  <span className="text-muted ml-2">{d.author.name}</span>
                </Link>
              ))}
            </div>
          )}
          {results.documents.length === 0 && results.companies.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted">No results</div>
          )}
        </div>
      )}
    </div>
  );
}
