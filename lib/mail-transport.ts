import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { ApiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decryptSmtpSecret, getSettings } from "@/lib/settings";
import type { MailErrorCategory, MailKind } from "@/lib/generated/prisma/client";

type SmtpConfiguration = {
  host: string;
  port: number;
  security: "STARTTLS" | "TLS" | "NONE";
  user: string;
  password: string;
  from: string;
  simulated: boolean;
};

export async function getSmtpConfiguration(): Promise<SmtpConfiguration> {
  // Für Tests/Entwicklung: SMTP_JSON=1 gibt die Mail als JSON aus statt zu senden.
  if (process.env.SMTP_JSON === "1") {
    return {
      host: "", port: 587, security: "NONE", user: "", password: "",
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "test@localhost",
      simulated: true,
    };
  }
  const settings = await getSettings();
  if (settings.smtpHost) {
    return {
      host: settings.smtpHost,
      port: settings.smtpPort,
      security: settings.smtpSecurity as SmtpConfiguration["security"],
      user: settings.smtpUser,
      password: settings.smtpPasswordEncrypted ? decryptSmtpSecret(settings.smtpPasswordEncrypted) : "",
      from: settings.smtpFrom || settings.smtpUser,
      simulated: false,
    };
  }
  if (!process.env.SMTP_HOST) {
    throw new ApiError(
      400,
      "SMTP ist nicht konfiguriert. Bitte die SMTP-Einstellungen im Backend hinterlegen.",
    );
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host: process.env.SMTP_HOST,
    port,
    security: port === 465 ? "TLS" : "STARTTLS",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
    simulated: false,
  };
}

function createMailTransport(config: SmtpConfiguration) {
  if (config.simulated) return nodemailer.createTransport({ jsonTransport: true });
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.security === "TLS",
    requireTLS: config.security === "STARTTLS",
    auth: config.user
      ? { user: config.user, pass: config.password }
      : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

export async function verifySmtpConnection() {
  const config = await getSmtpConfiguration();
  if (config.simulated) return { simulated: true };
  const transport = createMailTransport(config);
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
  return { simulated: false };
}

export function fillMailTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (m, key) => vars[key] ?? m);
}

type MonitoredMailContext = {
  kind: MailKind;
  recipient: string;
  subject: string;
  invoiceId?: string;
};

type MailResult = {
  accepted?: unknown[];
  rejected?: unknown[];
  messageId?: string;
  response?: string;
};

type MailError = Error & {
  code?: string;
  command?: string;
  response?: string;
  responseCode?: number;
  rejected?: unknown[];
};

function addresses(values: unknown[] | undefined) {
  return (values ?? []).map((value) =>
    typeof value === "string"
      ? value
      : typeof value === "object" && value && "address" in value
        ? String(value.address)
        : String(value),
  );
}

function classifyMailError(error: MailError): MailErrorCategory {
  const code = error.code?.toUpperCase();
  if (error instanceof ApiError && error.message.startsWith("SMTP ist nicht konfiguriert")) return "CONFIGURATION";
  if (code === "EAUTH" || error.responseCode === 535) return "AUTHENTICATION";
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") return "TIMEOUT";
  if (["ECONNECTION", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND", "ESOCKET"].includes(code ?? "")) {
    return "CONNECTION";
  }
  if (code === "EENVELOPE" || error.command === "RCPT TO" || (error.responseCode ?? 0) === 550) {
    return "RECIPIENT_REJECTED";
  }
  if ((error.responseCode ?? 0) >= 400) return "SERVER";
  return "UNKNOWN";
}

/**
 * Versendet eine Mail und protokolliert ausschließlich Zustellmetadaten. Inhalte
 * und Anhänge werden bewusst nicht gespeichert. ACCEPTED bedeutet, dass der
 * angesprochene SMTP-Server die Mail angenommen hat, nicht dass sie gelesen wurde.
 */
export async function sendMonitoredMail(context: MonitoredMailContext, options: Mail.Options) {
  const event = await prisma.mailEvent.create({
    data: {
      kind: context.kind,
      recipient: context.recipient,
      subject: context.subject,
      invoiceId: context.invoiceId,
    },
  });

  let result: MailResult;
  try {
    const config = await getSmtpConfiguration();
    result = (await createMailTransport(config).sendMail({ ...options, from: options.from || config.from })) as MailResult;
  } catch (unknownError) {
    const error = (unknownError instanceof Error ? unknownError : new Error(String(unknownError))) as MailError;
    const errorCategory = classifyMailError(error);
    await prisma.mailEvent.update({
      where: { id: event.id },
      data: {
        status: errorCategory === "RECIPIENT_REJECTED" ? "REJECTED" : "FAILED",
        rejected: addresses(error.rejected),
        smtpResponse: error.response,
        errorCategory,
        errorCode: error.code ?? (error.responseCode ? String(error.responseCode) : undefined),
        errorMessage: error.message.slice(0, 2000),
        completedAt: new Date(),
      },
    });
    throw unknownError;
  }

  const accepted = addresses(result.accepted);
  const rejected = addresses(result.rejected);
  const status = process.env.SMTP_JSON === "1"
    ? "SIMULATED"
    : rejected.length > 0
      ? accepted.length > 0
        ? "PARTIALLY_REJECTED"
        : "REJECTED"
      : "ACCEPTED";

  await prisma.mailEvent.update({
    where: { id: event.id },
    data: {
      status,
      accepted,
      rejected,
      messageId: result.messageId,
      smtpResponse: result.response ?? (process.env.SMTP_JSON === "1" ? "Testtransport (kein SMTP-Versand)" : undefined),
      errorCategory: rejected.length > 0 ? "RECIPIENT_REJECTED" : undefined,
      errorMessage: rejected.length > 0 ? `${rejected.length} Empfänger vom Mailserver abgelehnt` : undefined,
      completedAt: new Date(),
    },
  });

  if (status === "REJECTED") {
    throw new ApiError(502, "Der Mailserver hat alle Empfänger abgelehnt.");
  }
  return result;
}
