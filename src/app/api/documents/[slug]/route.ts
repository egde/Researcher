import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
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

  // Fetch related documents (same companies or tags)
  const companyIds = document.companies.map((dc) => dc.companyId);
  const tagIds = document.tags.map((dt) => dt.tagId);

  const related = await prisma.document.findMany({
    where: {
      id: { not: document.id },
      OR: [
        companyIds.length ? { companies: { some: { companyId: { in: companyIds } } } } : {},
        tagIds.length ? { tags: { some: { tagId: { in: tagIds } } } } : {},
      ].filter((o) => Object.keys(o).length > 0),
    },
    select: { id: true, slug: true, title: true, type: true, source: true, createdAt: true },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ...document, related });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json();

  const document = await prisma.document.update({
    where: { slug },
    data: {
      title: body.title,
      content: body.content,
      type: body.type,
      updatedAt: new Date(),
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      companies: { include: { company: true } },
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(document);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  await prisma.document.delete({ where: { slug } });

  return NextResponse.json({ ok: true });
}
