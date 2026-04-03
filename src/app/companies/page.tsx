export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { CompanyDirectory } from "@/components/companies/CompanyDirectory";

export default async function CompaniesPage() {
  const regions = await prisma.region.findMany({
    include: {
      sectors: { orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-base font-bold uppercase tracking-wider mb-6">
        Companies
      </h1>
      <CompanyDirectory regions={regions} />
    </div>
  );
}
