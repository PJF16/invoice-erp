import { NextResponse, type NextRequest } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { assertSameOrigin, clearPortalSession } from "@/lib/portal-auth";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const response = NextResponse.json({ ok: true });
    await clearPortalSession(response);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
