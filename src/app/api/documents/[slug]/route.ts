import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { parseWikiLinks } from "@/lib/links";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const document = await prisma.document.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, email: true } },
      companies: { include: { company: true } },
      tags: { include: { tag: true } },
      comments: {
        where: { parentId: null },
        include: {
          user: { select: { id: true, name: true } },
          replies: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      reactions: true,
      incomingLinks: {
        include: {
          sourceDoc: { select: { id: true, slug: true, title: true } },
        },
      },
      _count: { select: { comments: true, reactions: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const companyIds = document.companies.map((dc) => dc.companyId);
  const tagIds = document.tags.map((dt) => dt.tagId);

  const orConditions = [
    ...(companyIds.length
      ? [{ companies: { some: { companyId: { in: companyIds } } } }]
      : []),
    ...(tagIds.length
      ? [{ tags: { some: { tagId: { in: tagIds } } } }]
      : []),
  ];

  const related =
    orConditions.length > 0
      ? await prisma.document.findMany({
          where: { id: { not: document.id }, OR: orConditions },
          select: {
            id: true,
            slug: true,
            title: true,
            type: true,
            source: true,
            createdAt: true,
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        })
      : [];

  return NextResponse.json({ ...document, related });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json();

  // Update core fields
  const document = await prisma.document.update({
    where: { slug },
    data: {
      title: body.title,
      content: body.content,
      type: body.type,
      updatedAt: new Date(),
    },
  });

  // Update company associations if provided
  if (body.companyIds) {
    await prisma.documentCompany.deleteMany({
      where: { documentId: document.id },
    });
    if (body.companyIds.length > 0) {
      await prisma.documentCompany.createMany({
        data: body.companyIds.map((companyId: string) => ({
          documentId: document.id,
          companyId,
        })),
      });
    }
  }

  // Update tags if provided
  if (body.tags) {
    await prisma.documentTag.deleteMany({
      where: { documentId: document.id },
    });
    if (body.tags.length > 0) {
      const tagRecords = await Promise.all(
        body.tags.map((name: string) =>
          prisma.tag.upsert({ where: { name }, update: {}, create: { name } }),
        ),
      );
      await prisma.documentTag.createMany({
        data: tagRecords.map((tag) => ({
          documentId: document.id,
          tagId: tag.id,
        })),
      });
    }
  }

  // Update wiki-link backlinks
  if (body.content) {
    await populateBacklinks(document.id, body.content);
  }

  const updated = await prisma.document.findUnique({
    where: { id: document.id },
    include: {
      author: { select: { id: true, name: true, email: true } },
      companies: { include: { company: true } },
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  await prisma.document.delete({ where: { slug } });
  return NextResponse.json({ ok: true });
}

async function populateBacklinks(sourceDocId: string, content: string) {
  const wikiLinks = parseWikiLinks(content);

  await prisma.documentLink.deleteMany({ where: { sourceDocId } });

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

    if (target && target.id !== sourceDocId) {
      await prisma.documentLink.upsert({
        where: {
          sourceDocId_targetDocId: { sourceDocId, targetDocId: target.id },
        },
        update: {},
        create: { sourceDocId, targetDocId: target.id },
      });
    }
  }
}
