import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, requireAdmin } from "@/lib/api-helpers";
import {
  assertSameOrigin,
  clearPortalImpersonationCookie,
  setPortalImpersonationCookie,
} from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { portalImpersonationSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const session = await requireAdmin();
    const parsed = portalImpersonationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: parsed.data.customerId },
      select: { id: true },
    });
    if (!customer) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

    const response = NextResponse.json({ ok: true });
    setPortalImpersonationCookie(response, req, customer.id, session.user.id);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const response = NextResponse.json({ ok: true });
    clearPortalImpersonationCookie(response, req);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
