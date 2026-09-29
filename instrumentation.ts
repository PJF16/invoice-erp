// Startet den Scheduler für wiederkehrende Rechnungen, Mahnungen, Exporte und Backups
// im Next.js-Serverprozess. Deaktivierbar mit DISABLE_RECURRING_SCHEDULER=1.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_RECURRING_SCHEDULER === "1") return;

  const { runDueRecurringInvoices } = await import("@/lib/recurring");
  const { runAutoReminders } = await import("@/lib/reminders");
  const { runDueExportSchedules } = await import("@/lib/export-schedule");
  const { runDueBackup } = await import("@/lib/backup");

  const run = async () => {
    const jobs = [
      async () => {
        const result = await runDueRecurringInvoices();
        if (result.generated || result.sent || result.failed || result.review) console.log(`Scheduler: ${result.generated} Rechnungen erzeugt, ${result.sent} Versandaufträge erledigt, ${result.failed} fehlgeschlagen, ${result.review} zu prüfen.`);
      },
      async () => { const { sent } = await runAutoReminders(); if (sent) console.log(`Scheduler: ${sent} Zahlungserinnerung(en) versendet.`); },
      async () => { const { sent } = await runDueExportSchedules(); if (sent) console.log(`Scheduler: ${sent} Belegexport(e) versendet.`); },
      async () => { const backup = await runDueBackup(); if (backup.ran) console.log(`Scheduler: Backup ${backup.filename} erstellt.`); },
    ];
    for (const job of jobs) {
      try { await job(); } catch (error) { console.error("Scheduler-Fehler:", error); }
    }
  };

  // Beim Start einmal nachholen (z.B. nach Server-Downtime), danach stündlich.
  setTimeout(run, 15_000);
  setInterval(run, 60 * 60 * 1000);
}
