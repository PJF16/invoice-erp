import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CompanySettings } from "@/lib/generated/prisma/client";

export async function getSettings() {
  return prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

function smtpEncryptionKey() {
  const secret = process.env.SMTP_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("SMTP_ENCRYPTION_KEY oder AUTH_SECRET ist für SMTP-Zugangsdaten erforderlich");
  return createHash("sha256").update(`invoice-erp-smtp:${secret}`).digest();
}

export function encryptSmtpSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", smtpEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSmtpSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Gespeicherte SMTP-Zugangsdaten sind ungültig");
  const decipher = createDecipheriv("aes-256-gcm", smtpEncryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

export function publicSmtpSettings(settings: CompanySettings) {
  return {
    host: settings.smtpHost,
    port: settings.smtpPort,
    security: settings.smtpSecurity as "STARTTLS" | "TLS" | "NONE",
    user: settings.smtpUser,
    from: settings.smtpFrom,
    passwordConfigured: Boolean(settings.smtpPasswordEncrypted),
    configured: Boolean(settings.smtpHost || process.env.SMTP_HOST || process.env.SMTP_JSON === "1"),
    source: process.env.SMTP_JSON === "1" ? "JSON" as const : settings.smtpHost ? "DATABASE" as const : process.env.SMTP_HOST ? "ENV" as const : "NONE" as const,
  };
}

export async function isSmtpConfigured(settings?: Pick<CompanySettings, "smtpHost">) {
  const current = settings ?? await getSettings();
  return Boolean(current.smtpHost || process.env.SMTP_HOST || process.env.SMTP_JSON === "1");
}
