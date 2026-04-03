import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  type: z.enum([
    "COMPANY_RESEARCH",
    "SECTOR_ANALYSIS",
    "REGION_ANALYSIS",
    "BROKER_RESEARCH",
    "NEWS",
    "EARNINGS_TRANSCRIPT",
  ]),
  companyIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  authorId: z.string(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const companyId = searchParams.get("companyId");
  const source = searchParams.get("source");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (source) where.source = source;
  if (companyId) {
    where.companies = { some: { companyId } };
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true } },
        companies: { include: { company: true } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true, reactions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.document.count({ where }),
  ]);

  return NextResponse.json({ documents, total });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, content, type, companyIds, tags, authorId } = parsed.data;
  const slug = slugify(title);

  // Check for slug collision
  const existing = await prisma.document.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  // Upsert tags
  const tagRecords = tags
    ? await Promise.all(
        tags.map((name) =>
          prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name },
          })
        )
      )
    : [];

  const document = await prisma.document.create({
    data: {
      slug: finalSlug,
      title,
      content,
      type,
      source: "web",
      authorId,
      companies: companyIds
        ? { create: companyIds.map((companyId) => ({ companyId })) }
        : undefined,
      tags: tagRecords.length
        ? { create: tagRecords.map((tag) => ({ tagId: tag.id })) }
        : undefined,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      companies: { include: { company: true } },
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(document, { status: 201 });
}
