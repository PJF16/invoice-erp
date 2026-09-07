import type { MailErrorCategory, MailKind, MailStatus } from "@/lib/generated/prisma/client";

export const MAIL_STATUS_LABELS: Record<MailStatus, { label: string; className: string }> = {
  PENDING: { label: "Wird versendet", className: "border-blue-200 bg-blue-50 text-blue-700" },
  SIMULATED: { label: "Testtransport", className: "border-violet-200 bg-violet-50 text-violet-700" },
  ACCEPTED: { label: "Serverseitig angenommen", className: "border-green-200 bg-green-50 text-green-700" },
  PARTIALLY_REJECTED: { label: "Teilweise abgelehnt", className: "border-amber-200 bg-amber-50 text-amber-700" },
  REJECTED: { label: "Empfänger abgelehnt", className: "border-red-200 bg-red-50 text-red-700" },
  FAILED: { label: "Versand fehlgeschlagen", className: "border-red-200 bg-red-50 text-red-700" },
};

export const MAIL_KIND_LABELS: Record<MailKind, string> = {
  INVOICE: "Rechnung",
  REMINDER: "Zahlungserinnerung",
  EXPORT: "Belegexport",
  PORTAL_LOGIN: "Portal-Anmeldung",
};

export const MAIL_ERROR_LABELS: Record<MailErrorCategory, string> = {
  CONFIGURATION: "SMTP nicht konfiguriert",
  RECIPIENT_REJECTED: "Empfänger nicht gefunden oder abgelehnt",
  AUTHENTICATION: "SMTP-Anmeldung fehlgeschlagen",
  CONNECTION: "Mailserver nicht erreichbar",
  TIMEOUT: "Zeitüberschreitung beim Mailserver",
  SERVER: "Mailserver meldet einen Fehler",
  UNKNOWN: "Unbekannter Versandfehler",
};

export function formatMailDate(value: Date | string) {
  return new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
