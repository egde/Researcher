export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ConvictionHeatmap } from "@/components/votes/ConvictionHeatmap";

export default async function VotesPage() {
  const [analysts, companies, votes] = await Promise.all([
    prisma.user.findMany({
      where: { votes: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { votes: { some: {} } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.vote.findMany({
      select: { conviction: true, userId: true, companyId: true },
    }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-base font-bold uppercase tracking-wider mb-6">
        Conviction Heatmap
      </h1>
      <ConvictionHeatmap
        analysts={analysts}
        companies={companies}
        votes={votes}
      />
    </div>
  );
}
