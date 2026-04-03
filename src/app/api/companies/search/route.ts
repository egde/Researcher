import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  const ids = request.nextUrl.searchParams.get("ids");

  // Resolve by IDs (for edit mode pre-population)
  if (ids) {
    const idList = ids.split(",").filter(Boolean);
    const companies = await prisma.company.findMany({
      where: { id: { in: idList } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(companies);
  }

  // Search by name
  if (!q || q.length < 1) {
    return NextResponse.json([]);
  }

  const companies = await prisma.company.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json(companies);
}
