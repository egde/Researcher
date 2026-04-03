"use client";

import { useState, useEffect } from "react";
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
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(
    initialData?.companyIds ?? [],
  );
  const [companies, setCompanies] = useState<Company[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(data))
      .catch(() => {});
  }, []);

  function toggleCompany(id: string) {
    setSelectedCompanies((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required");
      return;
    }

    setSaving(true);
    setError("");

    const tags = tagInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const body = { title, type, content, source: "web", companyIds: selectedCompanies, tags };

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

      {/* Companies */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          Companies
        </label>
        <div className="flex flex-wrap gap-1">
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCompany(c.id)}
              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border cursor-pointer ${
                selectedCompanies.includes(c.id)
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted hover:border-foreground hover:text-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
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
