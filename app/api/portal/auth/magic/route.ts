import { NextResponse, type NextRequest } from "next/server";
import { consumePortalMagicLink, setPortalSessionCookie } from "@/lib/portal-auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/portal/login?error=link", req.url));

  try {
    const session = await consumePortalMagicLink(token);
    const response = NextResponse.redirect(new URL("/portal", req.url));
    setPortalSessionCookie(response, session, req);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/portal/login?error=link", req.url));
  }
}
