import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPagination, handleApiError, requireModule } from "@/lib/api-helpers";
import type { MailKind, MailStatus } from "@/lib/generated/prisma/enums";

const statuses = new Set<MailStatus>(["PENDING", "SIMULATED", "ACCEPTED", "PARTIALLY_REJECTED", "REJECTED", "FAILED"]);
const kinds = new Set<MailKind>(["INVOICE", "REMINDER", "EXPORT", "PORTAL_LOGIN"]);

export async function GET(req: NextRequest) {
  try {
    await requireModule("INVOICES");
    const statusRaw = req.nextUrl.searchParams.get("status") as MailStatus | null;
    const kindRaw = req.nextUrl.searchParams.get("kind") as MailKind | null;
    return NextResponse.json(await prisma.mailEvent.findMany({
      where: {
        status: statusRaw && statuses.has(statusRaw) ? statusRaw : undefined,
        kind: kindRaw && kinds.has(kindRaw) ? kindRaw : undefined,
      },
      orderBy: { createdAt: "desc" },
      ...getPagination(req.nextUrl.searchParams, { limit: 200, max: 500 }),
      include: { invoice: { select: { id: true, number: true } } },
    }));
  } catch (error) {
    return handleApiError(error);
  }
}
