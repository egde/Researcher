import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { auth } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const body = await request.json();

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, string> = {};
  if (body.name) {
    data.name = body.name;
    data.slug = slugify(body.name);
  }
  if (body.sectorId) {
    data.sectorId = body.sectorId;
  }

  const updated = await prisma.company.update({
    where: { id: company.id },
    data,
    include: {
      sector: {
        include: { region: { select: { name: true, slug: true } } },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  const company = await prisma.company.findUnique({
    where: { slug },
    include: { _count: { select: { documents: true, votes: true } } },
  });

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (company._count.documents > 0 || company._count.votes > 0) {
    return NextResponse.json(
      { error: "Cannot delete company with existing documents or votes" },
      { status: 409 },
    );
  }

  await prisma.company.delete({ where: { id: company.id } });
  return NextResponse.json({ ok: true });
}
