import nodemailer from "nodemailer";
import { ApiError } from "@/lib/api-helpers";

export function getMailTransport() {
  // Für Tests/Entwicklung: SMTP_JSON=1 gibt die Mail als JSON aus statt zu senden.
  if (process.env.SMTP_JSON === "1") {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  if (!process.env.SMTP_HOST) {
    throw new ApiError(
      400,
      "SMTP ist nicht konfiguriert. Bitte SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS und SMTP_FROM in der .env setzen.",
    );
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export function fillMailTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (m, key) => vars[key] ?? m);
}
