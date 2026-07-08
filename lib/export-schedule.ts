import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { getSettings } from "@/lib/settings";
import { getMailTransport, fillMailTemplate } from "@/lib/mail-transport";
import { addInterval } from "@/lib/dates";
import { computePeriodRange, queryExportInvoices, buildDocumentsZip } from "@/lib/export";

function parseRecipients(recipientEmail: string) {
  return recipientEmail
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Führt eine Export-Vorlage sofort aus: Belege sammeln, ZIP bauen, per Mail versenden. */
export async function runExportSchedule(scheduleId: string) {
  const schedule = await prisma.exportSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw new ApiError(404, "Export-Vorlage nicht gefunden");

  const settings = await getSettings();
  const { from, to, label } = computePeriodRange(schedule.period, new Date());
  const invoices = await queryExportInvoices({ dateFrom: from, dateTo: to, types: schedule.types });

  if (invoices.length === 0) {
    await prisma.exportSchedule.update({
      where: { id: scheduleId },
      data: { nextRun: addInterval(schedule.nextRun, schedule.interval) },
    });
    return { sent: false, count: 0, reason: `Keine Belege für „${label}" gefunden` };
  }

  const zip = await buildDocumentsZip(invoices, settings);
  const vars = { zeitraum: label };
  const transport = getMailTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: parseRecipients(schedule.recipientEmail).join(","),
    subject: fillMailTemplate(schedule.emailSubject, vars),
    text: fillMailTemplate(schedule.emailBody, vars),
    attachments: [
      {
        filename: `Belege_${label.replace(/\s+/g, "_")}.zip`,
        content: zip,
        contentType: "application/zip",
      },
    ],
  });

  await prisma.exportSchedule.update({
    where: { id: scheduleId },
    data: { lastRunAt: new Date(), nextRun: addInterval(schedule.nextRun, schedule.interval) },
  });

  return { sent: true, count: invoices.length, recipient: schedule.recipientEmail, label };
}

/** Wird vom Scheduler (instrumentation.ts) aufgerufen. */
export async function runDueExportSchedules() {
  const due = await prisma.exportSchedule.findMany({
    where: { active: true, nextRun: { lte: new Date() } },
  });

  let sent = 0;
  for (const schedule of due) {
    try {
      const result = await runExportSchedule(schedule.id);
      if (result.sent) sent++;
    } catch (e) {
      console.error(`Export-Vorlage „${schedule.name}" fehlgeschlagen:`, e);
    }
  }
  return { sent };
}
