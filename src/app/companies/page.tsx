import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function CompaniesPage() {
  const regions = await prisma.region.findMany({
    include: {
      sectors: {
        include: {
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
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-base font-bold uppercase tracking-wider mb-6">Companies</h1>

      {regions.map((region) => (
        <div key={region.id} className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider border-b border-border-strong pb-1 mb-3">
            {region.name}
          </h2>

          {region.sectors.map((sector) => (
            <div key={sector.id} className="mb-4">
              <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">
                {sector.name}
              </h3>

              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left">Name</th>
                    <th className="text-right w-20">Docs</th>
                    <th className="text-right w-20">Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {sector.companies.map((company) => (
                    <tr key={company.id} className="hover:bg-surface">
                      <td>
                        <Link
                          href={`/companies/${company.slug}`}
                          className="text-link no-underline hover:underline"
                        >
                          {company.name}
                        </Link>
                      </td>
                      <td className="text-right text-muted">{company._count.documents}</td>
                      <td className="text-right text-muted">{company._count.votes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
