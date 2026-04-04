import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const upsertSchema = z.object({
  companyId: z.string().min(1),
  conviction: z.number().int().min(1).max(5),
  rationale: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const votes = await prisma.vote.findMany({
    where: { companyId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const avg =
    votes.length > 0
      ? votes.reduce((sum, v) => sum + v.conviction, 0) / votes.length
      : 0;

  return NextResponse.json({ votes, avg, count: votes.length });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = upsertSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { companyId, conviction, rationale } = parsed.data;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const vote = await prisma.vote.upsert({
    where: {
      userId_companyId: { userId: session.user.id, companyId },
    },
    update: { conviction, rationale },
    create: { userId: session.user.id, companyId, conviction, rationale },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(vote);
}
