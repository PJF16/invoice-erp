// Startet den Scheduler für wiederkehrende Rechnungen im Next.js-Serverprozess.
// Läuft auch im Docker-Standalone-Build. Deaktivierbar mit DISABLE_RECURRING_SCHEDULER=1.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_RECURRING_SCHEDULER === "1") return;

  const { runDueRecurringInvoices } = await import("@/lib/recurring");
  const { runAutoReminders } = await import("@/lib/reminders");
  const { runDueExportSchedules } = await import("@/lib/export-schedule");

  const run = async () => {
    try {
      const { generated } = await runDueRecurringInvoices();
      if (generated > 0) {
        console.log(`Scheduler: ${generated} wiederkehrende Rechnung(en) erzeugt.`);
      }
      const { sent } = await runAutoReminders();
      if (sent > 0) {
        console.log(`Scheduler: ${sent} Zahlungserinnerung(en) versendet.`);
      }
      const { sent: exportsSent } = await runDueExportSchedules();
      if (exportsSent > 0) {
        console.log(`Scheduler: ${exportsSent} Belegexport(e) versendet.`);
      }
    } catch (e) {
      console.error("Scheduler-Fehler:", e);
    }
  };

  // Beim Start einmal nachholen (z.B. nach Server-Downtime), danach stündlich.
  setTimeout(run, 15_000);
  setInterval(run, 60 * 60 * 1000);
}
