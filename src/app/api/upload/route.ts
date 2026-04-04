import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { auth } from "@/lib/auth";
import { authenticateApiKey } from "@/lib/apiAuth";

export async function POST(request: NextRequest) {
  // Support both session auth and API key auth
  const session = await auth();
  const apiUser = !session ? await authenticateApiKey(request) : null;
  const userId = session?.user?.id ?? apiUser?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string | null;
  const type = (formData.get("type") as string) || "BROKER_RESEARCH";
  const companiesRaw = formData.get("companies") as string | null;
  const tagsRaw = formData.get("tags") as string | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  // 20MB limit
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }

  // Extract text from PDF
  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    const { extractTextFromPdf } = await import("@/lib/pdfParse");
    text = await extractTextFromPdf(buffer);
  } catch {
    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 422 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "PDF contains no extractable text" }, { status: 422 });
  }

  const docTitle = title || file.name.replace(/\.pdf$/i, "");

  // Resolve company names
  const companyIds: string[] = [];
  if (companiesRaw) {
    const names = companiesRaw.split(",").map((s) => s.trim()).filter(Boolean);
    for (const name of names) {
      const company = await prisma.company.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (company) companyIds.push(company.id);
    }
  }

  // Upsert tags
  const tagNames = tagsRaw ? tagsRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
  const tagRecords = tagNames.length
    ? await Promise.all(
        tagNames.map((name) =>
          prisma.tag.upsert({ where: { name }, update: {}, create: { name } }),
        ),
      )
    : [];

  const slug = slugify(docTitle);
  const existingSlug = await prisma.document.findUnique({ where: { slug } });
  const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

  const doc = await prisma.document.create({
    data: {
      slug: finalSlug,
      title: docTitle,
      content: text,
      type: type as "COMPANY_RESEARCH" | "SECTOR_ANALYSIS" | "REGION_ANALYSIS" | "BROKER_RESEARCH" | "NEWS" | "EARNINGS_TRANSCRIPT",
      source: "web",
      sourceRef: file.name,
      authorId: userId,
      companies: companyIds.length
        ? { create: companyIds.map((companyId) => ({ companyId })) }
        : undefined,
      tags: tagRecords.length
        ? { create: tagRecords.map((tag) => ({ tagId: tag.id })) }
        : undefined,
    },
    select: { slug: true, title: true },
  });

  return NextResponse.json(
    { slug: doc.slug, title: doc.title, url: `/documents/${doc.slug}` },
    { status: 201 },
  );
}
