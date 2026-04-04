import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { authenticateApiKey } from "@/lib/apiAuth";
import { z } from "zod";

const docSchema = z.object({
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
  sourceRef: z.string().min(1),
});

const batchSchema = z.object({
  documents: z.array(docSchema).min(1).max(100),
});

export async function POST(request: NextRequest) {
  const user = await authenticateApiKey(request);
  if (!user) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  // Require ADMIN role for batch ingest
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required for batch ingest" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = batchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const results: { sourceRef: string; slug: string; status: "created" | "updated" | "error"; error?: string }[] = [];

  for (const doc of parsed.data.documents) {
    try {
      // Resolve company names to IDs
      const companyIds: string[] = [];
      if (doc.companies?.length) {
        for (const name of doc.companies) {
          const company = await prisma.company.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
            select: { id: true },
          });
          if (company) companyIds.push(company.id);
        }
      }

      // Upsert tags
      const tagRecords = doc.tags?.length
        ? await Promise.all(
            doc.tags.map((name) =>
              prisma.tag.upsert({ where: { name }, update: {}, create: { name } }),
            ),
          )
        : [];

      // Check if document exists by sourceRef
      const existing = await prisma.document.findFirst({
        where: { sourceRef: doc.sourceRef },
        select: { id: true, slug: true },
      });

      if (existing) {
        // Update
        await prisma.documentCompany.deleteMany({ where: { documentId: existing.id } });
        await prisma.documentTag.deleteMany({ where: { documentId: existing.id } });

        await prisma.document.update({
          where: { id: existing.id },
          data: {
            title: doc.title,
            content: doc.content,
            type: doc.type,
            companies: companyIds.length
              ? { create: companyIds.map((companyId) => ({ companyId })) }
              : undefined,
            tags: tagRecords.length
              ? { create: tagRecords.map((tag) => ({ tagId: tag.id })) }
              : undefined,
          },
        });

        results.push({ sourceRef: doc.sourceRef, slug: existing.slug, status: "updated" });
      } else {
        // Create
        const slug = slugify(doc.title);
        const existingSlug = await prisma.document.findUnique({ where: { slug } });
        const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

        const created = await prisma.document.create({
          data: {
            slug: finalSlug,
            title: doc.title,
            content: doc.content,
            type: doc.type,
            source: "databricks",
            sourceRef: doc.sourceRef,
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

        results.push({ sourceRef: doc.sourceRef, slug: created.slug, status: "created" });
      }
    } catch (err) {
      results.push({
        sourceRef: doc.sourceRef,
        slug: "",
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    summary: { total: results.length, created, updated, errors },
    results,
  });
}
