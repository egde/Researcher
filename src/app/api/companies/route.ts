import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const sectorId = searchParams.get("sectorId");
  const regionId = searchParams.get("regionId");
  const letter = searchParams.get("letter");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

  const where: Record<string, unknown> = {};

  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }
  if (letter) {
    where.name = { ...(where.name as object || {}), startsWith: letter, mode: "insensitive" };
  }
  if (sectorId) {
    where.sectorId = sectorId;
  }
  if (regionId) {
    where.sector = { regionId };
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        sector: {
          include: { region: { select: { name: true, slug: true } } },
        },
        _count: { select: { documents: true, votes: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.company.count({ where }),
  ]);

  return NextResponse.json({
    companies,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, sectorId } = body;

  if (!name || !sectorId) {
    return NextResponse.json({ error: "name and sectorId are required" }, { status: 400 });
  }

  const sector = await prisma.sector.findUnique({ where: { id: sectorId } });
  if (!sector) {
    return NextResponse.json({ error: "Sector not found" }, { status: 404 });
  }

  const slug = slugify(name);
  const existing = await prisma.company.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const company = await prisma.company.create({
    data: { name, slug: finalSlug, sectorId },
    include: {
      sector: {
        include: { region: { select: { name: true, slug: true } } },
      },
    },
  });

  return NextResponse.json(company, { status: 201 });
}
