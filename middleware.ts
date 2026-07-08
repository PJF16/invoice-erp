import { NextResponse, type NextRequest } from "next/server";

// Schneller Cookie-Check für die Weiterleitung zum Login.
// Die eigentliche Autorisierung passiert serverseitig via auth() in Layout und API-Routen.
export function middleware(req: NextRequest) {
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");
  const isLogin = req.nextUrl.pathname.startsWith("/login");

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp)).*)"],
};
