import type { Prisma } from "@/lib/generated/prisma/client";

export function customerSearchWhere(query: unknown): Prisma.CustomerWhereInput {
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) return {};
  const match = { contains: q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
  return { OR: [
    { name: match },
    { customerNumber: match },
    { email: match },
    { zip: match },
    { city: match },
    { uid: match },
  ] };
}
