import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = `ak_${randomBytes(24).toString("hex")}`;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { apiKey },
  });

  return NextResponse.json({ apiKey });
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { apiKey: true },
  });

  const masked = user?.apiKey
    ? `${user.apiKey.slice(0, 6)}...${user.apiKey.slice(-4)}`
    : null;

  return NextResponse.json({ apiKey: masked });
}
