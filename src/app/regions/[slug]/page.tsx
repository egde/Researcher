export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function RegionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const region = await prisma.region.findUnique({
    where: { slug },
    include: {
      sectors: {
        include: {
          _count: { select: { companies: true } },
          companies: {
            include: {
              _count: { select: { documents: true, votes: true } },
            },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!region) notFound();

  const totalCompanies = region.sectors.reduce(
    (sum, s) => sum + s.companies.length,
    0
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="text-[10px] text-muted uppercase tracking-wider mb-1">
        <Link href="/companies" className="text-link no-underline hover:underline">
          Companies
        </Link>
      </div>

      <h1 className="text-lg font-bold mb-6">{region.name}</h1>

      <p className="text-xs text-muted mb-6">
        {region.sectors.length} {region.sectors.length === 1 ? "sector" : "sectors"},{" "}
        {totalCompanies} {totalCompanies === 1 ? "company" : "companies"}
      </p>

      <div className="space-y-8">
        {region.sectors.map((sector) => (
          <div key={sector.id}>
            <div className="flex items-center justify-between border-b border-border pb-1 mb-3">
              <Link
                href={`/sectors/${sector.slug}`}
                className="text-[10px] uppercase tracking-wider text-foreground no-underline hover:underline font-bold"
              >
                {sector.name}
              </Link>
              <span className="text-[10px] text-muted">
                {sector._count.companies} companies
              </span>
            </div>

            {sector.companies.length === 0 ? (
              <p className="text-xs text-muted">No companies yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full text-sm">
                  <tbody>
                    {sector.companies.map((c) => (
                      <tr key={c.id} className="border-b border-border">
                        <td className="py-1.5">
                          <Link
                            href={`/companies/${c.slug}`}
                            className="text-foreground no-underline hover:underline"
                          >
                            {c.name}
                          </Link>
                        </td>
                        <td className="py-1.5 text-right text-muted text-xs">
                          {c._count.documents} docs
                        </td>
                        <td className="py-1.5 text-right text-muted text-xs">
                          {c._count.votes} votes
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
