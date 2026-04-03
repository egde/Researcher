import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { auth } from "@/lib/auth";

export async function GET() {
  const regions = await prisma.region.findMany({
    include: { _count: { select: { sectors: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(regions);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = slugify(body.name);
  const region = await prisma.region.create({
    data: { name: body.name, slug },
  });

  return NextResponse.json(region, { status: 201 });
}
