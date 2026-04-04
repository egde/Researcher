import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Authenticate a request via Bearer API key.
 * Returns the user if valid, null otherwise.
 */
export async function authenticateApiKey(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const apiKey = header.slice(7);
  if (!apiKey) return null;

  const user = await prisma.user.findUnique({
    where: { apiKey },
    select: { id: true, name: true, email: true, role: true },
  });

  return user;
}
