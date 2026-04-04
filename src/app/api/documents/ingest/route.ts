import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { parseWikiLinks } from "@/lib/links";
import { authenticateApiKey } from "@/lib/apiAuth";
import { z } from "zod";

const ingestSchema = z.object({
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
  companies: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const user = await authenticateApiKey(request);
  if (!user) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = ingestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, content, type, companies, tags } = parsed.data;

  // Resolve company names to IDs
  const companyIds: string[] = [];
  if (companies?.length) {
    for (const name of companies) {
      const company = await prisma.company.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (company) companyIds.push(company.id);
    }
  }

  // Upsert tags
  const tagRecords = tags?.length
    ? await Promise.all(
        tags.map((name) =>
          prisma.tag.upsert({ where: { name }, update: {}, create: { name } }),
        ),
      )
    : [];

  // Upsert by title + author
  const slug = slugify(title);
  const existing = await prisma.document.findFirst({
    where: { title, authorId: user.id },
    select: { id: true, slug: true },
  });

  if (existing) {
    // Update existing document
    await prisma.documentCompany.deleteMany({ where: { documentId: existing.id } });
    await prisma.documentTag.deleteMany({ where: { documentId: existing.id } });

    const updated = await prisma.document.update({
      where: { id: existing.id },
      data: {
        content,
        type,
        source: "obsidian",
        companies: companyIds.length
          ? { create: companyIds.map((companyId) => ({ companyId })) }
          : undefined,
        tags: tagRecords.length
          ? { create: tagRecords.map((tag) => ({ tagId: tag.id })) }
          : undefined,
      },
      select: { slug: true },
    });

    await populateBacklinks(existing.id, content);

    return NextResponse.json({ slug: updated.slug, url: `/documents/${updated.slug}` });
  }

  // Create new document
  const existingSlug = await prisma.document.findUnique({ where: { slug } });
  const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

  const doc = await prisma.document.create({
    data: {
      slug: finalSlug,
      title,
      content,
      type,
      source: "obsidian",
      authorId: user.id,
      companies: companyIds.length
        ? { create: companyIds.map((companyId) => ({ companyId })) }
        : undefined,
      tags: tagRecords.length
        ? { create: tagRecords.map((tag) => ({ tagId: tag.id })) }
        : undefined,
    },
    select: { slug: true },
  });

  await populateBacklinks(doc.slug, content);

  return NextResponse.json({ slug: doc.slug, url: `/documents/${doc.slug}` }, { status: 201 });
}

async function populateBacklinks(docIdOrSlug: string, content: string) {
  // Resolve to ID if slug was passed
  let docId = docIdOrSlug;
  if (!docIdOrSlug.startsWith("c")) {
    const doc = await prisma.document.findUnique({
      where: { slug: docIdOrSlug },
      select: { id: true },
    });
    if (!doc) return;
    docId = doc.id;
  }

  const wikiLinks = parseWikiLinks(content);
  if (wikiLinks.length === 0) return;

  await prisma.documentLink.deleteMany({ where: { sourceDocId: docId } });

  for (const ref of wikiLinks) {
    const target = await prisma.document.findFirst({
      where: {
        OR: [
          { slug: slugify(ref) },
          { title: { equals: ref, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (target && target.id !== docId) {
      await prisma.documentLink.upsert({
        where: {
          sourceDocId_targetDocId: { sourceDocId: docId, targetDocId: target.id },
        },
        update: {},
        create: { sourceDocId: docId, targetDocId: target.id },
      });
    }
  }
}
