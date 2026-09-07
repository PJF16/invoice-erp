import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMailDate, MAIL_ERROR_LABELS, MAIL_KIND_LABELS, MAIL_STATUS_LABELS } from "@/lib/mail-monitoring";

export const dynamic = "force-dynamic";

export default async function MailMonitoringPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [events, accepted, problems, pending] = await Promise.all([
    prisma.mailEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { invoice: { select: { id: true, number: true } } },
    }),
    prisma.mailEvent.count({ where: { createdAt: { gte: since }, status: "ACCEPTED" } }),
    prisma.mailEvent.count({
      where: { createdAt: { gte: since }, status: { in: ["PARTIALLY_REJECTED", "REJECTED", "FAILED"] } },
    }),
    prisma.mailEvent.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="mx-auto max-w-[100rem]">
      <h1 className="mb-1 text-2xl font-semibold">Mail-Monitoring</h1>
      <p className="mb-6 text-sm text-gray-500">
        SMTP-Versandstatus und Fehlerdiagnose. „Angenommen“ bestätigt die Übernahme durch den Mailserver,
        nicht das Lesen der Nachricht oder eine später erfolgte Zustellung.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Angenommen · 30 Tage</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{accepted}</p>
        </div>
        <div className={`rounded-xl border bg-white p-5 shadow-sm ${problems > 0 ? "border-red-300" : "border-gray-200"}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Probleme · 30 Tage</p>
          <p className={`mt-1 text-2xl font-bold ${problems > 0 ? "text-red-600" : ""}`}>{problems}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Noch offen</p>
          <p className={`mt-1 text-2xl font-bold ${pending > 0 ? "text-blue-700" : ""}`}>{pending}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold">Letzte Versandversuche</h2>
          <p className="text-xs text-gray-500">Maximal 200 Einträge; Mailtexte und Anhänge werden nicht gespeichert.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Zeitpunkt</th>
                <th className="px-2 py-3">Art</th>
                <th className="px-2 py-3">Empfänger</th>
                <th className="px-2 py-3">Betreff</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-5 py-3">Diagnose</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">Noch keine Versandversuche protokolliert.</td></tr>
              )}
              {events.map((event) => {
                const badge = MAIL_STATUS_LABELS[event.status];
                const diagnosis = event.errorCategory
                  ? MAIL_ERROR_LABELS[event.errorCategory]
                  : event.smtpResponse || "–";
                return (
                  <tr key={event.id} className="border-b border-gray-100 align-top last:border-0 hover:bg-gray-50">
                    <td className="whitespace-nowrap px-5 py-3 text-gray-500">{formatMailDate(event.createdAt)}</td>
                    <td className="whitespace-nowrap px-2 py-3">
                      {event.invoice ? (
                        <Link href={`/invoices/${event.invoice.id}`} className="text-blue-700 hover:underline">
                          {MAIL_KIND_LABELS[event.kind]} {event.invoice.number}
                        </Link>
                      ) : MAIL_KIND_LABELS[event.kind]}
                    </td>
                    <td className="max-w-64 break-all px-2 py-3">{event.recipient}</td>
                    <td className="max-w-72 truncate px-2 py-3 text-gray-500" title={event.subject}>{event.subject}</td>
                    <td className="whitespace-nowrap px-2 py-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="max-w-80 px-5 py-3 text-xs text-gray-600">
                      <span title={event.errorMessage ?? event.smtpResponse ?? undefined}>{diagnosis}</span>
                      {event.errorCode && <span className="ml-1 text-gray-400">({event.errorCode})</span>}
                      {event.rejected.length > 0 && <div className="mt-1 break-all text-red-600">Abgelehnt: {event.rejected.join(", ")}</div>}
                      {event.errorMessage && <div className="mt-1 line-clamp-2 text-gray-500" title={event.errorMessage}>{event.errorMessage}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
