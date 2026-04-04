"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Region {
  id: string;
  name: string;
  slug: string;
  sectors: Sector[];
}

interface Sector {
  id: string;
  name: string;
  slug: string;
}

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  sector: { name: string; region: { name: string } };
  _count: { documents: number; votes: number };
}

interface CompanyResponse {
  companies: CompanyRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function CompanyDirectory({ regions }: { regions: Region[] }) {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [regionId, setRegionId] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [letter, setLetter] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CompanyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Add company form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSectorId, setNewSectorId] = useState("");
  const [adding, setAdding] = useState(false);

  const sectors = regionId
    ? regions.find((r) => r.id === regionId)?.sectors ?? []
    : regions.flatMap((r) => r.sectors);

  const fetchCompanies = useCallback(
    async (params: {
      q?: string;
      regionId?: string;
      sectorId?: string;
      letter?: string;
      page?: number;
    }) => {
      setLoading(true);
      const sp = new URLSearchParams();
      if (params.q) sp.set("q", params.q);
      if (params.regionId) sp.set("regionId", params.regionId);
      if (params.sectorId) sp.set("sectorId", params.sectorId);
      if (params.letter) sp.set("letter", params.letter);
      sp.set("page", String(params.page ?? 1));
      sp.set("limit", "50");

      const res = await fetch(`/api/companies?${sp}`);
      const json = await res.json();
      setData(json);
      setLoading(false);
      setFetched(true);
    },
    [],
  );

  // Initial fetch on first render
  if (!fetched && !loading) {
    fetchCompanies({ q: query, regionId, sectorId, letter, page });
  }

  // Debounce timer ref
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      fetchCompanies({ q: value, regionId, sectorId, letter, page: 1 });
    }, 300);
    setDebounceTimer(timer);
  }

  function handleRegionChange(value: string) {
    setRegionId(value);
    setSectorId("");
    setPage(1);
    fetchCompanies({ q: query, regionId: value, sectorId: "", letter, page: 1 });
  }

  function handleSectorChange(value: string) {
    setSectorId(value);
    setPage(1);
    fetchCompanies({ q: query, regionId, sectorId: value, letter, page: 1 });
  }

  function handleLetterChange(value: string) {
    setLetter(value);
    setPage(1);
    fetchCompanies({ q: query, regionId, sectorId, letter: value, page: 1 });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchCompanies({ q: query, regionId, sectorId, letter, page: newPage });
  }

  async function handleAddCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newSectorId) return;

    setAdding(true);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, sectorId: newSectorId }),
    });
    setAdding(false);

    if (res.ok) {
      setNewName("");
      setNewSectorId("");
      setShowAddForm(false);
      fetchCompanies({ q: query, regionId, sectorId, letter, page });
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <Input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Search companies..."
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <select
            value={regionId}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="border border-border px-2 py-1.5 text-[11px] font-mono bg-background flex-1 sm:flex-none"
          >
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <select
            value={sectorId}
            onChange={(e) => handleSectorChange(e.target.value)}
            className="border border-border px-2 py-1.5 text-[11px] font-mono bg-background flex-1 sm:flex-none"
          >
            <option value="">All sectors</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Alphabet strip */}
        <div className="flex items-center gap-0.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleLetterChange("")}
            className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 cursor-pointer ${
              letter === ""
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            ALL
          </button>
          {ALPHABET.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => handleLetterChange(l)}
              className={`text-[9px] px-1 py-0.5 cursor-pointer ${
                letter === l
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {l}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleLetterChange("#")}
            className={`text-[9px] px-1 py-0.5 cursor-pointer ${
              letter === "#"
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            #
          </button>
        </div>
      </div>

      {/* Add company */}
      {session && (
        <div>
          {showAddForm ? (
            <form onSubmit={handleAddCompany} className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1">
                <label className="block text-[9px] uppercase tracking-wider text-muted mb-0.5">
                  Name
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Company name"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-[9px] uppercase tracking-wider text-muted mb-0.5">
                  Sector
                </label>
                <select
                  value={newSectorId}
                  onChange={(e) => setNewSectorId(e.target.value)}
                  required
                  className="w-full border border-border px-2 py-1.5 text-sm font-mono bg-background"
                >
                  <option value="">Select...</option>
                  {regions.flatMap((r) =>
                    r.sectors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {r.name} / {s.name}
                      </option>
                    )),
                  )}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" variant="primary" disabled={adding}>
                  {adding ? "Adding..." : "Add"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="text-[10px] uppercase tracking-wider text-muted hover:text-foreground cursor-pointer"
            >
              + Add company
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading && !data ? (
        <p className="text-sm text-muted py-8">Loading...</p>
      ) : !data || data.companies.length === 0 ? (
        <p className="text-sm text-muted py-8">No companies found.</p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                  <th className="text-left py-2 font-normal">Name</th>
                  <th className="text-left py-2 font-normal">Sector</th>
                  <th className="text-left py-2 font-normal hidden sm:table-cell">Region</th>
                  <th className="text-right py-2 font-normal">Docs</th>
                  <th className="text-right py-2 font-normal">Votes</th>
                </tr>
              </thead>
              <tbody>
                {data.companies.map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <td className="py-2">
                      <Link
                        href={`/companies/${c.slug}`}
                        className="text-foreground no-underline hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2 text-muted">{c.sector.name}</td>
                    <td className="py-2 text-muted hidden sm:table-cell">{c.sector.region.name}</td>
                    <td className="py-2 text-right text-muted">
                      {c._count.documents}
                    </td>
                    <td className="py-2 text-right text-muted">
                      {c._count.votes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] text-muted">
              Page {data.page} of {data.totalPages} ({data.total} companies)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                disabled={page >= data.totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
