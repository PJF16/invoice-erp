import { prisma } from "@/lib/prisma";
import { ExportPanel } from "@/components/export-panel";
import { ExportScheduleForm, ExportScheduleRowActions } from "@/components/export-schedule-form";
import { formatDate, INTERVAL_LABELS, EXPORT_PERIOD_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const [customers, schedules] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.exportSchedule.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold">Export</h1>
      <p className="mb-6 text-sm text-gray-500">
        Belege als ZIP herunterladen oder automatisch zu einem festen Zeitpunkt per E-Mail versenden lassen.
      </p>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold">Sofortiger Export</h2>
        <p className="mb-4 text-xs text-gray-500">
          Wähle Zeitraum und Dokumenttyp und lade die passenden Belege als ZIP herunter.
        </p>
        <ExportPanel customers={customers} />
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Geplante Exporte</h2>
            <p className="text-xs text-gray-500">
              Werden automatisch erzeugt und per E-Mail versendet, z.B. „alle Rechnungen des Vormonats" am 1. jeden Monats.
            </p>
          </div>
          <ExportScheduleForm customers={customers} />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">Name</th>
              <th className="px-2 py-3">Zeitraum</th>
              <th className="px-2 py-3">Intervall</th>
              <th className="px-2 py-3">Dokumente</th>
              <th className="px-2 py-3">Nächster Versand</th>
              <th className="px-2 py-3">Status</th>
              <th className="px-5 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                  Noch keine geplanten Exporte.
                </td>
              </tr>
            )}
            {schedules.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-5 py-3 font-medium">{s.name}</td>
                <td className="px-2 py-3 text-gray-500">{EXPORT_PERIOD_LABELS[s.period]}</td>
                <td className="px-2 py-3 text-gray-500">{INTERVAL_LABELS[s.interval]}</td>
                <td className="px-2 py-3 text-xs text-gray-500">
                  {s.types.map((t) => DOCUMENT_TYPE_LABELS[t]).join(", ")}
                </td>
                <td className="px-2 py-3 text-gray-500">{formatDate(s.nextRun)}</td>
                <td className="px-2 py-3">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                      s.active
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    {s.active ? "Aktiv" : "Pausiert"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <ExportScheduleRowActions
                    customers={customers}
                    schedule={{
                      id: s.id,
                      name: s.name,
                      active: s.active,
                      interval: s.interval,
                      nextRun: s.nextRun.toISOString(),
                      period: s.period,
                      types: s.types,
                      recipientEmail: s.recipientEmail,
                      emailSubject: s.emailSubject,
                      emailBody: s.emailBody,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
