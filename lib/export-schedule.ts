import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { getSettings } from "@/lib/settings";
import { sendMonitoredMail, fillMailTemplate } from "@/lib/mail-transport";
import { addInterval } from "@/lib/dates";
import { computePeriodRange, queryExportInvoices, buildDocumentsZip } from "@/lib/export";
import type { ExportSchedule, MailEvent } from "@/lib/generated/prisma/client";

const STALE_RUN_MS = 60 * 60 * 1000;
const MAX_CATCH_UP_RUNS = 12;
const SAFE_RETRY_ERRORS = ["CONFIGURATION", "AUTHENTICATION", "RECIPIENT_REJECTED", "SERVER"];
const SAFE_CONNECTION_ERRORS = ["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH"];

export const clearedExportRun = {
  exportRunId: null,
  exportRunPhase: null,
  exportRunStartedAt: null,
  exportRunReference: null,
  exportRunScheduled: false,
};

type ClaimedExport = ExportSchedule & { exportRunId: string; exportRunReference: Date };

function updateClaim(run: ClaimedExport, data: Parameters<typeof prisma.exportSchedule.updateMany>[0]["data"]) {
  return prisma.exportSchedule.updateMany({
    where: { id: run.id, exportRunId: run.exportRunId },
    data,
  });
}

function finishRun(run: ClaimedExport, sent: boolean) {
  return updateClaim(run, {
    ...clearedExportRun,
    ...(run.exportRunScheduled ? { nextRun: addInterval(run.exportRunReference, run.interval) } : {}),
    ...(sent ? { lastRunAt: new Date() } : {}),
  });
}

function canRetryMail(event: Pick<MailEvent, "status" | "errorCategory" | "errorCode">) {
  return event.status === "REJECTED" || (event.status === "FAILED" && (
    SAFE_RETRY_ERRORS.includes(event.errorCategory ?? "") || SAFE_CONNECTION_ERRORS.includes(event.errorCode ?? "")
  ));
}

async function recoverRun(run: ClaimedExport, workerStopped: boolean) {
  if (run.exportRunPhase === "PREPARING") {
    await prisma.exportSchedule.updateMany({
      where: { id: run.id, exportRunId: run.exportRunId, exportRunPhase: "PREPARING" },
      data: clearedExportRun,
    });
    return false;
  }
  const event = await prisma.mailEvent.findUnique({ where: { exportRunId: run.exportRunId } });
  if (event?.status === "ACCEPTED" || event?.status === "SIMULATED") {
    await finishRun(run, true);
    return true;
  }
  if ((event && canRetryMail(event)) || (!event && !workerStopped)) {
    await updateClaim(run, clearedExportRun);
  } else {
    await updateClaim(run, { exportRunPhase: "REVIEW" });
  }
  return false;
}

/** Ein fälliger manueller Aufruf übernimmt den Plantermin. Ein vorgezogener Versand ist separat. */
export async function runExportSchedule(scheduleId: string, options: { expectedRun?: Date; retryRunId?: string; now?: Date } = {}) {
  const schedule = await prisma.exportSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw new ApiError(404, "Export-Vorlage nicht gefunden");

  const now = options.now ?? new Date();
  const retry = Boolean(options.retryRunId && schedule.exportRunPhase === "REVIEW" && schedule.exportRunId === options.retryRunId);
  if ((options.retryRunId && !retry) || (schedule.exportRunId && !retry)) {
    throw new ApiError(409, schedule.exportRunPhase === "REVIEW"
      ? "Der Versand muss vor dem erneuten Senden geprüft werden."
      : "Der Export läuft bereits oder sein Status hat sich geändert.");
  }

  if (options.expectedRun && (!schedule.active || schedule.nextRun > now ||
      schedule.nextRun.getTime() !== options.expectedRun.getTime())) {
    throw new ApiError(409, "Der Exporttermin hat sich geändert.");
  }

  if (retry && schedule.exportRunId && schedule.exportRunReference) {
    const event = await prisma.mailEvent.findUnique({ where: { exportRunId: schedule.exportRunId } });
    if (event?.status === "ACCEPTED" || event?.status === "SIMULATED") {
      await finishRun({ ...schedule, exportRunId: schedule.exportRunId, exportRunReference: schedule.exportRunReference }, true);
      return { sent: false, count: 0, reason: "Der frühere Versand wurde bereits vom Mailserver angenommen." };
    }
  }

  const planned = retry ? schedule.exportRunScheduled : schedule.active && schedule.nextRun <= now;
  const reference = (retry ? schedule.exportRunReference : null) ?? (planned ? schedule.nextRun : now);
  const claim = {
    exportRunId: randomUUID(),
    exportRunPhase: "PREPARING" as const,
    exportRunStartedAt: new Date(),
    exportRunReference: reference,
    exportRunScheduled: planned,
  };
  const [acquired] = await prisma.exportSchedule.updateManyAndReturn({
    where: { id: scheduleId, nextRun: schedule.nextRun, active: schedule.active,
      exportRunId: schedule.exportRunId, exportRunPhase: schedule.exportRunPhase },
    data: claim,
  });
  if (!acquired) throw new ApiError(409, "Der Export wurde bereits übernommen.");

  const run: ClaimedExport = { ...acquired, ...claim };
  // Plantermine kommen als UTC-Datum aus dem Formular. Die Beleggrenzen folgen
  // weiterhin dem lokalen Kalender, den der Export auch beim manuellen Lauf nutzt.
  const periodDate = run.exportRunScheduled
    ? new Date(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate())
    : reference;
  const { from, to, label } = computePeriodRange(run.period, periodDate);
  const recipient = run.recipientEmail.split(/[,;]/).map((part) => part.trim()).filter(Boolean).join(",");
  let count = 0;

  try {
    const invoices = await queryExportInvoices({ dateFrom: from, dateTo: to, types: run.types });
    count = invoices.length;
    if (count === 0) {
      await finishRun(run, false);
      return { sent: false, count, reason: `Keine Belege für „${label}“ gefunden` };
    }

    const zip = await buildDocumentsZip(invoices, await getSettings());
    const sending = await prisma.exportSchedule.updateMany({
      where: { id: run.id, exportRunId: run.exportRunId, exportRunPhase: "PREPARING" },
      data: { exportRunPhase: "SENDING", exportRunStartedAt: new Date() },
    });
    if (sending.count !== 1) throw new ApiError(409, "Die Exportausführung wurde unterbrochen.");
    run.exportRunPhase = "SENDING";

    const vars = { zeitraum: label };
    const subject = fillMailTemplate(run.emailSubject, vars);
    await sendMonitoredMail({ kind: "EXPORT", recipient, subject, exportRunId: run.exportRunId }, {
      to: recipient,
      subject,
      text: fillMailTemplate(run.emailBody, vars),
      attachments: [{
        filename: `Belege_${label.replace(/\s+/g, "_")}.zip`,
        content: zip,
        contentType: "application/zip",
      }],
    });
    await finishRun(run, true);
  } catch (error) {
    if (!await recoverRun(run, false)) throw error;
  }

  return { sent: true, count, recipient: run.recipientEmail, label };
}

export async function runDueExportSchedules(now = new Date()) {
  const stale = await prisma.exportSchedule.findMany({
    where: { exportRunPhase: { in: ["PREPARING", "SENDING"] }, exportRunStartedAt: { lt: new Date(now.getTime() - STALE_RUN_MS) } },
  });
  for (const run of stale) {
    if (!run.exportRunId || !run.exportRunReference) continue;
    try {
      await recoverRun({ ...run, exportRunId: run.exportRunId, exportRunReference: run.exportRunReference }, true);
    } catch (error) {
      console.error(`Export „${run.name}“ konnte nicht abgeglichen werden:`, error);
    }
  }

  const due = await prisma.exportSchedule.findMany({
    where: { active: true, nextRun: { lte: now }, exportRunId: null },
  });
  let sent = 0;
  for (const schedule of due) {
    let expectedRun = schedule.nextRun;
    for (let period = 0; period < MAX_CATCH_UP_RUNS && expectedRun <= now; period++) {
      try {
        const result = await runExportSchedule(schedule.id, { expectedRun, now });
        if (result.sent) sent++;
        expectedRun = addInterval(expectedRun, schedule.interval);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 409)) {
          console.error(`Export-Vorlage „${schedule.name}“ fehlgeschlagen:`, error);
        }
        break;
      }
    }
  }
  return { sent };
}
