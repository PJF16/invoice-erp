import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { eur, formatDate } from "@/lib/format";
import { getSettings, isSmtpConfigured } from "@/lib/settings";
import { overdueWhere, daysOverdue } from "@/lib/reminders";
import { ReminderButton } from "@/components/reminder-button";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const [overdue, settings] = await Promise.all([
    prisma.invoice.findMany({
      where: overdueWhere(),
      orderBy: { dueDate: "asc" },
      include: { customer: { select: { name: true, email: true } } },
    }),
    getSettings(),
  ]);
  const smtp = isSmtpConfigured();
  const totalOverdue = overdue.reduce((sum, i) => sum + Number(i.grossTotal), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mahnwesen</h1>
          <p className="text-sm text-gray-500">
            {overdue.length > 0
              ? `${overdue.length} überfällige Rechnung(en) über ${eur.format(totalOverdue)}`
              : "Keine überfälligen Rechnungen."}
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          <p>
            Automatische Erinnerungen:{" "}
            <span className={settings.autoReminders ? "font-semibold text-green-700" : "font-semibold"}>
              {settings.autoReminders
                ? `aktiv (ab ${settings.reminderDays} Tagen, max. ${settings.maxReminders}×)`
                : "aus"}
            </span>
          </p>
          <p>
            Konfigurierbar in den{" "}
            <Link href="/settings" className="text-blue-600 hover:underline">
              Einstellungen
            </Link>
          </p>
        </div>
      </div>

      {!smtp && overdue.length > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          SMTP ist nicht konfiguriert — Erinnerungen können derzeit nicht versendet werden.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Nummer</th>
              <th className="px-4 py-3">Kunde</th>
              <th className="px-4 py-3">Fällig seit</th>
              <th className="px-4 py-3 text-right">Überfällig</th>
              <th className="px-4 py-3 text-right">Brutto</th>
              <th className="px-4 py-3">Mahnstufe</th>
              <th className="px-4 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {overdue.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  Alle Rechnungen sind bezahlt oder noch nicht fällig. 🎉
                </td>
              </tr>
            )}
            {overdue.map((inv) => {
              const days = daysOverdue(inv.dueDate);
              return (
                <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/invoices/${inv.id}`} className="hover:text-blue-700 hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{inv.customerName || inv.customer.name}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.dueDate)}</td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${days > 30 ? "text-red-600" : "text-amber-600"}`}>
                    {days} Tage
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {eur.format(Number(inv.grossTotal))}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {inv.reminderCount === 0
                      ? "–"
                      : `${inv.reminderCount}× gemahnt${inv.lastReminderAt ? `, zuletzt ${formatDate(inv.lastReminderAt)}` : ""}`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ReminderButton
                      invoiceId={inv.id}
                      number={inv.number!}
                      customerEmail={inv.customer.email}
                      smtpConfigured={smtp}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
