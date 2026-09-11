import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireAdmin } from "@/lib/api-helpers";
import { verifySmtpConnection } from "@/lib/mail-transport";

type SmtpError = Error & { code?: string; responseCode?: number };

export async function POST() {
  try {
    await requireAdmin();
    const result = await verifySmtpConnection();
    return NextResponse.json({
      ok: true,
      message: result.simulated
        ? "SMTP_JSON ist aktiv – es wurde keine echte SMTP-Verbindung aufgebaut."
        : "Verbindung und Anmeldung beim SMTP-Server waren erfolgreich.",
    });
  } catch (unknownError) {
    if (unknownError instanceof ApiError) return handleApiError(unknownError);
    const error = (unknownError instanceof Error ? unknownError : new Error(String(unknownError))) as SmtpError;
    const code = error.code?.toUpperCase();
    const message = code === "EAUTH" || error.responseCode === 535
      ? "SMTP-Anmeldung fehlgeschlagen. Bitte Benutzername und Passwort prüfen."
      : code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT"
        ? "Zeitüberschreitung beim Verbindungsaufbau zum SMTP-Server."
        : ["ECONNECTION", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND", "ESOCKET"].includes(code ?? "")
          ? "Der SMTP-Server ist unter den angegebenen Verbindungsdaten nicht erreichbar."
          : `SMTP-Test fehlgeschlagen: ${error.message}`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
