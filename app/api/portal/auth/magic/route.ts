import { NextResponse, type NextRequest } from "next/server";
import { consumePortalMagicLink, portalOrigin, setPortalSessionCookie } from "@/lib/portal-auth";
import { handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const origin = portalOrigin();
    const invalidLink = new URL("/portal/login?error=link", origin);
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.redirect(invalidLink);
    try {
      const session = await consumePortalMagicLink(token);
      const response = NextResponse.redirect(new URL("/portal", origin));
      setPortalSessionCookie(response, session);
      return response;
    } catch {
      return NextResponse.redirect(invalidLink);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
