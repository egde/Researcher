"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Company {
  id: string;
  name: string;
  slug: string;
}

interface DocumentFormProps {
  mode: "create" | "edit";
  slug?: string;
  initialData?: {
    title: string;
    type: string;
    content: string;
    companyIds: string[];
    tags: string[];
  };
}

const DOCUMENT_TYPES = [
  "COMPANY_RESEARCH",
  "SECTOR_ANALYSIS",
  "REGION_ANALYSIS",
  "BROKER_RESEARCH",
  "NEWS",
  "EARNINGS_TRANSCRIPT",
];

export function DocumentForm({ mode, slug, initialData }: DocumentFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [type, setType] = useState(initialData?.type ?? "COMPANY_RESEARCH");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [tagInput, setTagInput] = useState(initialData?.tags.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Company picker state
  const [selected, setSelected] = useState<Company[]>([]);
  const [companyQuery, setCompanyQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Resolve initial company IDs to names on mount (edit mode)
  useEffect(() => {
    if (initialData?.companyIds.length) {
      fetch(`/api/companies/search?ids=${initialData.companyIds.join(",")}`)
        .then((r) => r.json())
        .then((data: Company[]) => setSelected(data))
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Search companies via debounced input
  function handleCompanySearch(value: string) {
    setCompanyQuery(value);
    if (value.length < 1) {
      setSearchResults([]);
      setDropdownOpen(false);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetch(`/api/companies/search?q=${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then((data: Company[]) => {
          const selectedIds = new Set(selected.map((c) => c.id));
          setSearchResults(data.filter((c) => !selectedIds.has(c.id)));
          setDropdownOpen(true);
        })
        .catch(() => {});
    }, 250);
  }
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addCompany(company: Company) {
    setSelected((prev) => [...prev, company]);
    setCompanyQuery("");
    setSearchResults([]);
    setDropdownOpen(false);
  }

  function removeCompany(id: string) {
    setSelected((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setSaving(true);
    setError("");

    const tags = tagInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const companyIds = selected.map((c) => c.id);
    const body = { title, type, content, source: "web", companyIds, tags };

    const url = mode === "create" ? "/api/documents" : `/api/documents/${slug}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save document");
      return;
    }

    const doc = await res.json();
    router.push(`/documents/${doc.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          Title
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document title"
          required
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          Type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full border border-border px-3 py-2 text-sm font-mono bg-background"
        >
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Companies — typeahead picker */}
      <div ref={pickerRef}>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          Companies
        </label>

        {/* Selected pills */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selected.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 bg-foreground text-background"
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => removeCompany(c.id)}
                  className="hover:opacity-70 cursor-pointer"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <Input
            value={companyQuery}
            onChange={(e) => handleCompanySearch(e.target.value)}
            placeholder="Search companies..."
          />

          {/* Dropdown */}
          {dropdownOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 border border-foreground bg-background max-h-60 overflow-y-auto">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addCompany(c)}
                  className="block w-full text-left px-3 py-2 text-xs font-mono hover:bg-foreground hover:text-background cursor-pointer"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {dropdownOpen && companyQuery.length >= 1 && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 z-50 border border-border bg-background px-3 py-2 text-[11px] text-muted">
              No companies found
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          Tags (comma separated)
        </label>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="earnings, ai, semiconductor"
        />
      </div>

      {/* Editor */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          Content
        </label>
        <Editor content={content} onChange={setContent} />
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving
            ? "Saving..."
            : mode === "create"
              ? "Publish"
              : "Update"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
