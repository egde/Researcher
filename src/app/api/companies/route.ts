import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const sectorId = request.nextUrl.searchParams.get("sectorId");

  const where = sectorId ? { sectorId } : {};

  const companies = await prisma.company.findMany({
    where,
    include: {
      sector: {
        include: { region: { select: { name: true, slug: true } } },
      },
      _count: { select: { documents: true, votes: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(companies);
}
