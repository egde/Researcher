import Link from "next/link";

interface HeatmapVote {
  conviction: number;
  userId: string;
  companyId: string;
}

interface Analyst {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
}

interface ConvictionHeatmapProps {
  analysts: Analyst[];
  companies: Company[];
  votes: HeatmapVote[];
}

function cellColor(conviction: number | null): string {
  if (conviction === null) return "bg-background";
  // Grayscale: 1=lightest, 5=darkest
  const shades = [
    "bg-neutral-200 dark:bg-neutral-800",
    "bg-neutral-300 dark:bg-neutral-700",
    "bg-neutral-400 dark:bg-neutral-600",
    "bg-neutral-600 dark:bg-neutral-400",
    "bg-neutral-800 dark:bg-neutral-200",
  ];
  return shades[conviction - 1] ?? "bg-background";
}

function cellText(conviction: number | null): string {
  if (conviction === null) return "";
  if (conviction >= 4) return "text-white dark:text-black";
  return "text-black dark:text-white";
}

export function ConvictionHeatmap({
  analysts,
  companies,
  votes,
}: ConvictionHeatmapProps) {
  // Build lookup: voteMap[companyId][userId] = conviction
  const voteMap = new Map<string, Map<string, number>>();
  for (const v of votes) {
    if (!voteMap.has(v.companyId)) voteMap.set(v.companyId, new Map());
    voteMap.get(v.companyId)!.set(v.userId, v.conviction);
  }

  // Compute averages per company for sorting
  const companyAvg = companies.map((c) => {
    const row = voteMap.get(c.id);
    if (!row || row.size === 0) return { ...c, avg: 0 };
    const vals = [...row.values()];
    return { ...c, avg: vals.reduce((s, v) => s + v, 0) / vals.length };
  });
  companyAvg.sort((a, b) => b.avg - a.avg);

  if (companies.length === 0 || analysts.length === 0) {
    return <p className="text-xs text-muted">No votes yet.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="text-[11px] border-collapse">
        <thead>
          <tr>
            <th className="text-left py-1 pr-3 font-normal text-[10px] uppercase tracking-wider text-muted sticky left-0 bg-background z-10">
              Company
            </th>
            {analysts.map((a) => (
              <th
                key={a.id}
                className="py-1 px-1 font-normal text-[9px] uppercase tracking-wider text-muted text-center"
                style={{ writingMode: "vertical-lr", minWidth: 28 }}
              >
                {a.name}
              </th>
            ))}
            <th className="py-1 px-2 font-normal text-[10px] uppercase tracking-wider text-muted text-center">
              Avg
            </th>
          </tr>
        </thead>
        <tbody>
          {companyAvg.map((c) => (
            <tr key={c.id}>
              <td className="py-0.5 pr-3 sticky left-0 bg-background z-10 whitespace-nowrap">
                <Link
                  href={`/companies/${c.slug}`}
                  className="text-link no-underline hover:underline"
                >
                  {c.name}
                </Link>
              </td>
              {analysts.map((a) => {
                const val = voteMap.get(c.id)?.get(a.id) ?? null;
                return (
                  <td
                    key={a.id}
                    className={`text-center py-0.5 px-1 ${cellColor(val)} ${cellText(val)}`}
                  >
                    {val ?? ""}
                  </td>
                );
              })}
              <td className="text-center py-0.5 px-2 text-muted font-mono">
                {c.avg > 0 ? c.avg.toFixed(1) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4">
        <span className="text-[9px] text-muted uppercase tracking-wider">Low</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`w-5 h-5 flex items-center justify-center text-[9px] ${cellColor(n)} ${cellText(n)}`}
          >
            {n}
          </div>
        ))}
        <span className="text-[9px] text-muted uppercase tracking-wider">High</span>
      </div>
    </div>
  );
}
