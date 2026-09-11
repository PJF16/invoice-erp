import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_PREFIX = "ierp_";

export function hashApiKey(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createApiKeySecret() {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function visibleApiKeyPrefix(token: string) {
  return token.slice(0, 13);
}

export function readBearerToken(authorization: string | null) {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  return match?.[1] ?? null;
}

export async function authenticateApiKey(token: string) {
  if (!token.startsWith(TOKEN_PREFIX) || token.length < 30) return null;

  const apiKey = await prisma.apiKey.findUnique({
    where: { tokenHash: hashApiKey(token) },
    include: { user: true },
  });
  if (!apiKey || (apiKey.expiresAt && apiKey.expiresAt <= new Date())) return null;

  // Schreibfehler beim Aktualisieren des Nutzungszeitpunkts dürfen eine gültige
  // Anfrage nicht fehlschlagen lassen.
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return apiKey.user;
}
