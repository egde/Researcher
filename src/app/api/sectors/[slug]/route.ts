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

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const sector = await prisma.sector.findUnique({ where: { slug } });
  if (!sector) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.sector.update({
    where: { id: sector.id },
    data: { name: body.name, slug: slugify(body.name) },
    include: {
      region: { select: { id: true, name: true, slug: true } },
      _count: { select: { companies: true } },
    },
  });

  return NextResponse.json(updated);
}
