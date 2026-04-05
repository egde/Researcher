import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

interface DocResult {
  id: string;
  slug: string;
  title: string;
  type: string;
  source: string;
  createdAt: Date;
  authorName: string;
  rank: number;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ documents: [], companies: [], tags: [] });
  }

  // Build tsquery: split words, add prefix matching, join with &
  const terms = q.trim().split(/\s+/).filter(Boolean);
  const tsquery = terms.map((t) => `${t}:*`).join(" & ");

  // Full-text search on documents using tsvector with ranking
  const documents = await prisma.$queryRaw<DocResult[]>(Prisma.sql`
    SELECT
      d.id,
      d.slug,
      d.title,
      d.type,
      d.source,
      d."createdAt",
      u.name AS "authorName",
      ts_rank(d."searchVector", to_tsquery('english', ${tsquery})) AS rank
    FROM "Document" d
    JOIN "User" u ON u.id = d."authorId"
    WHERE d."searchVector" @@ to_tsquery('english', ${tsquery})
    ORDER BY rank DESC, d."updatedAt" DESC
    LIMIT 15
  `);

  // Search companies (ILIKE is fine — small table)
  const companies = await prisma.company.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: {
      id: true,
      slug: true,
      name: true,
      sector: { select: { name: true } },
    },
    take: 5,
    orderBy: { name: "asc" },
  });

  // Search tags
  const tags = await prisma.tag.findMany({
    where: { name: { contains: q.toLowerCase(), mode: "insensitive" } },
    select: { id: true, name: true },
    take: 5,
    orderBy: { name: "asc" },
  });

  // Map documents to match expected response shape
  const docs = documents.map((d) => ({
    id: d.id,
    slug: d.slug,
    title: d.title,
    type: d.type,
    source: d.source,
    createdAt: d.createdAt,
    author: { name: d.authorName },
  }));

  return NextResponse.json({ documents: docs, companies, tags });
}
