interface Vote {
  id: string;
  conviction: number;
  rationale?: string | null;
  updatedAt: Date;
  user: { id: string; name: string };
}

interface VoteSummaryProps {
  votes: Vote[];
}

function ConvictionDots({ level }: { level: number }) {
  return (
    <span className="text-sm tracking-wide">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < level ? "●" : "○"}</span>
      ))}
    </span>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function VoteSummary({ votes }: VoteSummaryProps) {
  if (votes.length === 0) return null;

  const avg = votes.reduce((sum, v) => sum + v.conviction, 0) / votes.length;

  // Distribution: count how many votes at each level
  const dist = [0, 0, 0, 0, 0];
  for (const v of votes) {
    dist[v.conviction - 1]++;
  }
  const maxCount = Math.max(...dist);

  return (
    <div className="border-b border-border pb-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] uppercase tracking-wider text-muted">
          Conviction
        </h2>
        <div className="flex items-center gap-2">
          <ConvictionDots level={Math.round(avg)} />
          <span className="text-xs text-muted">
            {avg.toFixed(1)} avg ({votes.length} {votes.length === 1 ? "vote" : "votes"})
          </span>
        </div>
      </div>

      {/* Distribution bar */}
      <div className="flex items-end gap-1 h-8 mb-4">
        {dist.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full bg-foreground"
              style={{ height: maxCount > 0 ? `${(count / maxCount) * 28}px` : 0 }}
            />
            <span className="text-[9px] text-muted">{i + 1}</span>
          </div>
        ))}
      </div>

      {/* Per-analyst breakdown */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted">
              <th className="text-left py-1 font-normal">Analyst</th>
              <th className="text-left py-1 font-normal">Conviction</th>
              <th className="text-left py-1 font-normal hidden sm:table-cell">Rationale</th>
              <th className="text-right py-1 font-normal">Updated</th>
            </tr>
          </thead>
          <tbody>
            {votes.map((vote) => (
              <tr key={vote.id} className="border-t border-border">
                <td className="py-1.5">{vote.user.name}</td>
                <td className="py-1.5">
                  <ConvictionDots level={vote.conviction} />
                </td>
                <td className="py-1.5 text-muted max-w-xs truncate hidden sm:table-cell">
                  {vote.rationale || "—"}
                </td>
                <td className="py-1.5 text-right text-muted">
                  {formatDate(vote.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
