"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface ConvictionVoterProps {
  companyId: string;
  companyName: string;
  existingVote?: { conviction: number; rationale?: string | null };
  onVoted?: () => void;
}

export function ConvictionVoter({
  companyId,
  companyName,
  existingVote,
  onVoted,
}: ConvictionVoterProps) {
  const { data: session } = useSession();
  const [conviction, setConviction] = useState(existingVote?.conviction ?? 0);
  const [hovered, setHovered] = useState(0);
  const [rationale, setRationale] = useState(existingVote?.rationale ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  if (!session) return null;

  const displayLevel = hovered || conviction;

  async function handleSubmit() {
    if (conviction < 1) {
      setError("Select a conviction level");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        conviction,
        rationale: rationale.trim() || undefined,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save vote");
      return;
    }

    setSaved(true);
    onVoted?.();
  }

  return (
    <div className="border border-border p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted mb-3">
        Your conviction — {companyName}
      </div>

      {/* Dots selector */}
      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: 5 }, (_, i) => {
          const level = i + 1;
          return (
            <button
              key={level}
              type="button"
              onMouseEnter={() => setHovered(level)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setConviction(level)}
              className="text-xl cursor-pointer select-none leading-none"
              aria-label={`Conviction ${level}`}
            >
              {level <= displayLevel ? "●" : "○"}
            </button>
          );
        })}
        {conviction > 0 && (
          <span className="text-xs text-muted ml-2">
            {conviction}/5
          </span>
        )}
      </div>

      {/* Rationale */}
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="Rationale (optional)"
        rows={2}
        className="w-full border border-border px-3 py-2 text-xs font-mono bg-background resize-none mb-3"
      />

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || conviction < 1}
          className="text-[10px] uppercase tracking-wider px-3 py-1.5 bg-foreground text-background disabled:opacity-40 cursor-pointer"
        >
          {saving ? "Saving..." : existingVote ? "Update vote" : "Submit vote"}
        </button>
        {saved && <span className="text-[10px] text-muted">Saved</span>}
        {error && <span className="text-[10px] text-red-600">{error}</span>}
      </div>
    </div>
  );
}
