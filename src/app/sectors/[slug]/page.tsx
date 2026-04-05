export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function SectorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const sector = await prisma.sector.findUnique({
    where: { slug },
    include: {
      region: { select: { name: true, slug: true } },
      companies: {
        include: {
          _count: { select: { documents: true, votes: true } },
          votes: { select: { conviction: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!sector) notFound();

  const companiesWithAvg = sector.companies.map((c) => ({
    ...c,
    avgConviction:
      c.votes.length > 0
        ? c.votes.reduce((s, v) => s + v.conviction, 0) / c.votes.length
        : 0,
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="text-[10px] text-muted uppercase tracking-wider mb-1">
        <Link href="/companies" className="text-link no-underline hover:underline">
          Companies
        </Link>
        {" / "}
        <Link
          href={`/regions/${sector.region.slug}`}
          className="text-link no-underline hover:underline"
        >
          {sector.region.name}
        </Link>
      </div>

      <h1 className="text-lg font-bold mb-6">{sector.name}</h1>

      <p className="text-xs text-muted mb-4">
        {sector.companies.length} {sector.companies.length === 1 ? "company" : "companies"}
      </p>

      {sector.companies.length === 0 ? (
        <p className="text-sm text-muted py-8">No companies in this sector yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                <th className="text-left py-2 font-normal">Company</th>
                <th className="text-left py-2 font-normal">Conviction</th>
                <th className="text-right py-2 font-normal">Docs</th>
                <th className="text-right py-2 font-normal">Votes</th>
              </tr>
            </thead>
            <tbody>
              {companiesWithAvg.map((c) => (
                <tr key={c.id} className="border-b border-border">
                  <td className="py-2">
                    <Link
                      href={`/companies/${c.slug}`}
                      className="text-foreground no-underline hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-2">
                    {c.avgConviction > 0 ? (
                      <span className="text-xs">
                        <span className="tracking-wide">
                          {Array.from({ length: 5 }, (_, i) =>
                            i < Math.round(c.avgConviction) ? "●" : "○"
                          ).join("")}
                        </span>
                        <span className="text-muted ml-1">{c.avgConviction.toFixed(1)}</span>
                      </span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-muted">{c._count.documents}</td>
                  <td className="py-2 text-right text-muted">{c._count.votes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
