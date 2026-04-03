import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const regionId = request.nextUrl.searchParams.get("regionId");
  const where = regionId ? { regionId } : {};

  const sectors = await prisma.sector.findMany({
    where,
    include: {
      region: { select: { id: true, name: true, slug: true } },
      _count: { select: { companies: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(sectors);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.name || !body.regionId) {
    return NextResponse.json({ error: "name and regionId are required" }, { status: 400 });
  }

  const region = await prisma.region.findUnique({ where: { id: body.regionId } });
  if (!region) {
    return NextResponse.json({ error: "Region not found" }, { status: 404 });
  }

  const slug = slugify(body.name);
  const sector = await prisma.sector.create({
    data: { name: body.name, slug, regionId: body.regionId },
    include: { region: { select: { id: true, name: true, slug: true } } },
  });

  return NextResponse.json(sector, { status: 201 });
}
