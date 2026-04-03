export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SourceBadge } from "@/components/companies/SourceBadge";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConvictionDots({ level }: { level: number }) {
  return (
    <span className="tracking-wide">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < level ? "\u25CF" : "\u25CB"}</span>
      ))}
    </span>
  );
}

export default async function DashboardPage() {
  const [recentDocuments, recentVotes, companies] = await Promise.all([
    prisma.document.findMany({
      include: {
        author: { select: { name: true } },
        companies: { include: { company: { select: { name: true, slug: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.vote.findMany({
      include: {
        user: { select: { name: true } },
        company: { select: { name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.company.findMany({
      include: {
        _count: { select: { documents: true, votes: true } },
        votes: {
          select: { conviction: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const topCompanies = companies
    .filter((c) => c.votes.length > 0)
    .map((c) => ({
      ...c,
      avgConviction: c.votes.reduce((s, v) => s + v.conviction, 0) / c.votes.length,
    }))
    .sort((a, b) => b.avgConviction - a.avgConviction)
    .slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-base font-bold uppercase tracking-wider mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Recent Documents */}
        <div>
          <h2 className="text-[10px] uppercase tracking-wider text-muted mb-3 border-b border-border pb-1">
            Latest Documents
          </h2>
          {recentDocuments.map((doc) => (
            <div key={doc.id} className="py-2 border-b border-border">
              <div className="flex items-center gap-2 mb-0.5">
                <SourceBadge source={doc.source} />
                <Link
                  href={`/documents/${doc.slug}`}
                  className="text-xs text-link no-underline hover:underline truncate"
                >
                  {doc.title}
                </Link>
              </div>
              <div className="text-[10px] text-muted">
                {doc.author.name} &middot; {formatDate(doc.createdAt)}
                {doc.companies.length > 0 && (
                  <span className="ml-2">
                    {doc.companies.map((dc) => dc.company.name).join(", ")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-8">
          {/* Top Convictions */}
          <div>
            <h2 className="text-[10px] uppercase tracking-wider text-muted mb-3 border-b border-border pb-1">
              Top Convictions
            </h2>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left">Company</th>
                  <th className="text-left">Conviction</th>
                  <th className="text-right">Votes</th>
                </tr>
              </thead>
              <tbody>
                {topCompanies.map((c) => (
                  <tr key={c.id} className="hover:bg-surface">
                    <td>
                      <Link
                        href={`/companies/${c.slug}`}
                        className="text-link no-underline hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td>
                      <ConvictionDots level={Math.round(c.avgConviction)} />
                      <span className="text-muted ml-1">{c.avgConviction.toFixed(1)}</span>
                    </td>
                    <td className="text-right text-muted">{c.votes.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent Votes */}
          <div>
            <h2 className="text-[10px] uppercase tracking-wider text-muted mb-3 border-b border-border pb-1">
              Recent Votes
            </h2>
            {recentVotes.map((vote) => (
              <div key={vote.id} className="py-2 border-b border-border flex items-center justify-between">
                <div>
                  <Link
                    href={`/companies/${vote.company.slug}`}
                    className="text-xs text-link no-underline hover:underline"
                  >
                    {vote.company.name}
                  </Link>
                  <span className="text-[10px] text-muted ml-2">{vote.user.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ConvictionDots level={vote.conviction} />
                  <span className="text-[10px] text-muted">{formatDate(vote.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
