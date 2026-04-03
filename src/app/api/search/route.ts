import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Search documents
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      source: true,
      createdAt: true,
      author: { select: { name: true } },
    },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });

  // Search companies
  const companies = await prisma.company.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: {
      id: true,
      slug: true,
      name: true,
      sector: { select: { name: true } },
    },
    take: 5,
  });

  return NextResponse.json({ documents, companies });
}
