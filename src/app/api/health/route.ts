import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const masked = dbUrl
    ? dbUrl.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")
    : "NOT SET";

  try {
    const docCount = await prisma.document.count();
    const companyCount = await prisma.company.count();
    return NextResponse.json({
      status: "ok",
      database: masked,
      counts: { documents: docCount, companies: companyCount },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { status: "error", database: masked, error: message },
      { status: 500 },
    );
  }
}
