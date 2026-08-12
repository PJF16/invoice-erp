import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api-helpers";
import { getMailTransport } from "@/lib/mail-transport";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export const PORTAL_COOKIE = "invoice-erp.portal-session";
const LOGIN_VALID_MS = 10 * 60 * 1000;
const SESSION_VALID_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

export function normalizePortalEmail(email: string) {
  return email.trim().toLocaleLowerCase("de-AT");
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET ist nicht konfiguriert");
  return value;
}

function keyedHash(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function sessionHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requestIpHash(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  return ip ? keyedHash(`ip:${ip}`) : null;
}

export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;

  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const expected = forwardedHost ? `${forwardedProto}://${forwardedHost}` : req.nextUrl.origin;
  if (origin !== expected) throw new ApiError(403, "Ungültige Anfrage");
}

function publicOrigin(req: NextRequest) {
  const configured = process.env.PORTAL_BASE_URL || process.env.AUTH_URL;
  if (configured) return configured.replace(/\/$/, "");

  const incomingHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  // 0.0.0.0 ist nur die Bind-Adresse des Servers und kein sinnvoller Link für
  // den Browser. Beim lokalen Direktzugriff stattdessen localhost verwenden.
  const host = incomingHost?.replace(/^0\.0\.0\.0(?=:|$)/, "localhost");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

function usesSecurePortalCookie(req: NextRequest) {
  return publicOrigin(req).startsWith("https://");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

export async function requestPortalLogin(emailInput: string, req: NextRequest) {
  const email = normalizePortalEmail(emailInput);
  const now = new Date();
  const recent = new Date(now.getTime() - 15 * 60 * 1000);
  const ipHash = requestIpHash(req);

  await prisma.portalLoginToken.deleteMany({ where: { expiresAt: { lt: now } } });

  const [emailRequests, ipRequests] = await Promise.all([
    prisma.portalLoginToken.count({ where: { email, createdAt: { gt: recent } } }),
    ipHash
      ? prisma.portalLoginToken.count({ where: { requestIpHash: ipHash, createdAt: { gt: recent } } })
      : Promise.resolve(0),
  ]);
  if (emailRequests >= 3 || ipRequests >= 12) {
    throw new ApiError(429, "Bitte warten Sie, bevor Sie einen neuen Code anfordern.");
  }

  // Die Antwort verrät nicht, ob die Adresse als Kunde hinterlegt ist.
  const customer = await prisma.customer.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!customer) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const linkToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + LOGIN_VALID_MS);
  const loginToken = await prisma.portalLoginToken.create({
    data: {
      email,
      codeHash: keyedHash(`code:${email}:${code}`),
      linkHash: keyedHash(`link:${linkToken}`),
      requestIpHash: ipHash,
      expiresAt,
    },
  });

  const settings = await getSettings();
  const baseUrl = publicOrigin(req);
  const magicUrl = `${baseUrl}/api/portal/auth/magic?token=${encodeURIComponent(linkToken)}`;
  const company = settings.name || "Kundenportal";

  try {
    await getMailTransport().sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: `Ihr Zugangscode für ${company}`,
      text: `Ihr Zugangscode lautet: ${code}\n\nAlternativ können Sie diesen Anmeldelink verwenden:\n${magicUrl}\n\nCode und Link sind 10 Minuten gültig und nur einmal verwendbar.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033">
        <h2 style="margin-bottom:8px">Anmeldung bei ${escapeHtml(company)}</h2>
        <p>Geben Sie diesen einmaligen Code im Kundenportal ein:</p>
        <p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p>
        <p>Oder öffnen Sie direkt den sicheren Anmeldelink:</p>
        <p style="margin:24px 0"><a href="${magicUrl}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Kundenportal öffnen</a></p>
        <p style="font-size:13px;color:#667085">Code und Link sind 10 Minuten gültig und nur einmal verwendbar. Falls Sie diese Nachricht nicht angefordert haben, können Sie sie ignorieren.</p>
      </div>`,
    });
    // SMTP_JSON ist ein ausdrücklich aktivierter Testtransport, der nichts
    // versendet. Die Ausgabe wird daher auch im produktionsnahen Docker-Build
    // benötigt, damit dieser Modus dort testbar ist.
    if (process.env.SMTP_JSON === "1") {
      console.info(
        `[Kundenportal – Test-Anmeldung]\nE-Mail: ${email}\nEinmalcode: ${code}\nMagic-Link: ${magicUrl}`,
      );
    }
  } catch (error) {
    await prisma.portalLoginToken.delete({ where: { id: loginToken.id } }).catch(() => undefined);
    throw error;
  }
}

type NewSession = { rawToken: string; expiresAt: Date };

function newSession(): NewSession & { id: string } {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    id: sessionHash(rawToken),
    rawToken,
    expiresAt: new Date(Date.now() + SESSION_VALID_MS),
  };
}

export async function verifyPortalCode(emailInput: string, code: string): Promise<NewSession> {
  const email = normalizePortalEmail(emailInput);
  const loginToken = await prisma.portalLoginToken.findFirst({
    where: {
      email,
      usedAt: null,
      attempts: { lt: MAX_CODE_ATTEMPTS },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  const suppliedHash = keyedHash(`code:${email}:${code}`);
  if (!loginToken || !safeEqual(loginToken.codeHash, suppliedHash)) {
    if (loginToken) {
      await prisma.portalLoginToken.update({
        where: { id: loginToken.id },
        data: { attempts: { increment: 1 } },
      });
    }
    throw new ApiError(401, "Der Code ist ungültig oder abgelaufen.");
  }

  const session = newSession();
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.portalLoginToken.updateMany({
      where: { id: loginToken.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw new ApiError(401, "Der Code wurde bereits verwendet.");
    await tx.portalSession.create({
      data: { id: session.id, email, expiresAt: session.expiresAt },
    });
  });
  return session;
}

export async function consumePortalMagicLink(linkToken: string): Promise<NewSession> {
  const loginToken = await prisma.portalLoginToken.findUnique({
    where: { linkHash: keyedHash(`link:${linkToken}`) },
  });
  if (!loginToken || loginToken.usedAt || loginToken.expiresAt <= new Date()) {
    throw new ApiError(401, "Der Anmeldelink ist ungültig oder abgelaufen.");
  }

  const session = newSession();
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.portalLoginToken.updateMany({
      where: { id: loginToken.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw new ApiError(401, "Der Anmeldelink wurde bereits verwendet.");
    await tx.portalSession.create({
      data: { id: session.id, email: loginToken.email, expiresAt: session.expiresAt },
    });
  });
  return session;
}

export function setPortalSessionCookie(response: NextResponse, session: NewSession, req: NextRequest) {
  response.cookies.set(PORTAL_COOKIE, session.rawToken, {
    httpOnly: true,
    secure: usesSecurePortalCookie(req),
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
}

export async function getPortalSession() {
  const rawToken = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (!rawToken) return null;

  const session = await prisma.portalSession.findUnique({ where: { id: sessionHash(rawToken) } });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.portalSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return { email: session.email, expiresAt: session.expiresAt };
}

export async function requirePortalSession() {
  const session = await getPortalSession();
  if (!session) throw new ApiError(401, "Nicht im Kundenportal angemeldet");
  return session;
}

export async function requirePortalPageSession() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  return session;
}

export async function clearPortalSession(response: NextResponse, req: NextRequest) {
  const rawToken = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (rawToken) {
    await prisma.portalSession.delete({ where: { id: sessionHash(rawToken) } }).catch(() => undefined);
  }
  response.cookies.set(PORTAL_COOKIE, "", {
    httpOnly: true,
    secure: usesSecurePortalCookie(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
