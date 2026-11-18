import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const database = process.env.TEST_DATABASE_URL;
test("PostgreSQL: Parallelität, Storno und wiederkehrende Rechnungen", { skip: !database }, async (t) => {
  assert.match(new URL(database!).pathname, /_test$/, "Nur eine ausdrücklich benannte Testdatenbank verwenden");
  process.env.DATABASE_URL = database;
  const { prisma } = await import("../../lib/prisma");
  const { bookMovement } = await import("../../lib/movements");
  const { createDraftInvoice, finalizeInvoice, createStornoInvoice } = await import("../../lib/invoices");
  const { recordPayment, settleFully, deletePayment } = await import("../../lib/payments");
  const { generateInvoiceFromTemplate } = await import("../../lib/recurring");
  const { retryPendingRecurringDeliveries, sendInvoiceEmail } = await import("../../lib/mailer");
  const { createDeliveryNote } = await import("../../lib/delivery-notes");
  const { runDueExportSchedules } = await import("../../lib/export-schedule");
  const tag = crypto.randomUUID();
  const user = await prisma.user.create({ data: { email: `${tag}@example.com`, name: "Regression", passwordHash: "unused", role: "ADMIN" } });
  const warehouse = await prisma.warehouse.create({ data: { name: `Test ${tag}` } });
  const customer = await prisma.customer.create({ data: { name: `Test ${tag}` } });
  const item = await prisma.item.create({ data: { name: `Test ${tag}` } });
  const movementInput = { itemId: item.id, warehouseId: warehouse.id, userId: user.id };
  const base = { customerId: customer.id, issueDate: new Date("2026-09-01"), dueDate: new Date("2026-09-15"), deliveryDate: new Date("2026-09-01"), servicePeriodStart: new Date("2026-09-01"), servicePeriodEnd: new Date("2026-09-30"), taxTreatment: "STANDARD" as const, lines: [{ description: "Wartung", quantity: 1, unit: "Monat", unitPrice: 100, taxRate: 20, supplyKind: "SERVICE" as const }] };
  const newInvoice = async () => { const draft = await createDraftInvoice(base); return finalizeInvoice(draft.id, user.id); };
  try {
    await t.test("gleichzeitige erstmalige Eingänge gehen nicht verloren", async () => {
      await Promise.all(Array.from({ length: 10 }, () => bookMovement({ ...movementInput, type: "IN", quantity: 1 })));
      assert.equal((await prisma.stock.findUniqueOrThrow({ where: { itemId_warehouseId: { itemId: item.id, warehouseId: warehouse.id } } })).quantity, 10);
    });
    await t.test("Überverkauf verhindern und Bewegungen konsistent halten", async () => {
      const results = await Promise.allSettled(Array.from({ length: 10 }, () => bookMovement({ ...movementInput, type: "OUT", quantity: 2 })));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
      assert.equal((await prisma.stock.findFirstOrThrow({ where: { itemId: item.id } })).quantity, 0);
      assert.equal(await prisma.movement.count({ where: { itemId: item.id, type: "OUT" } }), 5);
    });
    await t.test("gleichzeitige Teilzahlungen ergeben den vollständigen Saldo", async () => {
      const invoice = await newInvoice();
      await Promise.all([60, 60].map((amount) => recordPayment(invoice.id, { amount, date: new Date(), method: "BANK_TRANSFER" }, user.id)));
      const actual = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      assert.equal(Number(actual.paidTotal), 120); assert.equal(actual.status, "PAID");
      const payment = await prisma.payment.findFirstOrThrow({ where: { invoiceId: invoice.id } });
      await deletePayment(payment.id);
      assert.equal(Number((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).paidTotal), 60);
    });
    await t.test("mehrfaches Bezahlt-Markieren erzeugt nur eine Zahlung", async () => {
      const invoice = await newInvoice();
      await Promise.all(Array.from({ length: 5 }, () => settleFully(invoice.id, user.id)));
      assert.equal(await prisma.payment.count({ where: { invoiceId: invoice.id } }), 1);
      assert.equal(Number((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).paidTotal), 120);
    });
    await t.test("Kundenübergabe nach Storno erneut verrechnen, Herkunft bewahren", async () => {
      await bookMovement({ ...movementInput, type: "IN", quantity: 10 });
      const { movement } = await bookMovement({ ...movementInput, type: "OUT", quantity: 1, customerId: customer.id });
      const input = { ...base, lines: [{ ...base.lines[0], supplyKind: "GOODS" as const, itemId: item.id, warehouseId: warehouse.id, sourceMovementId: movement.id }] };
      const first = await createDraftInvoice(input); await finalizeInvoice(first.id, user.id); await createStornoInvoice(first.id, user.id);
      const second = await createDraftInvoice(input); await finalizeInvoice(second.id, user.id);
      const originalLine = await prisma.invoiceLine.findFirstOrThrow({ where: { invoiceId: first.id } });
      assert.equal(originalLine.sourceMovementId, null); assert.equal(originalLine.historicalSourceMovementId, movement.id);
      assert.equal((await prisma.stock.findFirstOrThrow({ where: { itemId: item.id } })).quantity, 9);
    });
    await t.test("Lieferschein nach Storno erneut verrechnen", async () => {
      const note = await createDeliveryNote({ customerId: customer.id, lines: [{ itemId: item.id, warehouseId: warehouse.id, quantity: 1 }], deliveryMethod: "STOCK" }, user.id);
      const input = { ...base, lines: [{ ...base.lines[0], supplyKind: "GOODS" as const, itemId: item.id, warehouseId: warehouse.id, sourceDeliveryNoteLineId: note.lines[0].id }] };
      const first = await createDraftInvoice(input); await finalizeInvoice(first.id, user.id); await createStornoInvoice(first.id, user.id);
      const second = await createDraftInvoice(input); await finalizeInvoice(second.id, user.id);
      assert.equal((await prisma.invoiceLine.findFirstOrThrow({ where: { invoiceId: first.id } })).historicalSourceDeliveryNoteLineId, note.lines[0].id);
    });
    await t.test("paralleles Teilstorno verhindert die Reservierung der veralteten Menge", async () => {
      const note = await createDeliveryNote({
        customerId: customer.id, deliveryMethod: "DISTRIBUTOR_DIRECT", distributor: "Testdistributor",
        lines: [{ itemId: item.id, quantity: 5 }],
      }, user.id);
      const lineId = note.lines[0].id;
      const line = { ...base.lines[0], supplyKind: "GOODS" as const, itemId: item.id, sourceDeliveryNoteLineId: lineId };
      let attempt: Promise<unknown> | undefined;
      await prisma.$transaction(async (tx) => {
        // Halte das Update des Teilstornos offen, bis der Entwurf mit der zuvor gelesenen Menge darauf wartet.
        await tx.deliveryNoteLine.update({ where: { id: lineId }, data: { canceledQuantity: 2 } });
        const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        attempt = createDraftInvoice({ ...base, lines: [{ ...line, quantity: 5 }] }).then(() => null, (error: unknown) => error);
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          const [{ blocked }] = await tx.$queryRaw<{ blocked: boolean }[]>`
            SELECT EXISTS (
              SELECT 1 FROM pg_stat_activity
              WHERE ${pid}::integer = ANY (pg_blocking_pids(pid))
            ) AS blocked
          `;
          if (blocked) return;
          await delay(15);
        }
        assert.fail("Rechnungsentwurf wartete nicht auf das Teilstorno");
      });
      const result = await attempt;
      assert.equal((result as { status?: number } | null)?.status, 409);
      const draft = await createDraftInvoice({ ...base, lines: [{ ...line, quantity: 3 }] });
      assert.equal(Number(draft.lines[0].quantity), 3);
    });
    await t.test("Jahreszähler bleiben bei rückdatierten Rechnungen unabhängig", async () => {
      const issue = async (date: string) => {
        const issueDate = new Date(date + "T12:00:00Z");
        const draft = await createDraftInvoice({ ...base, issueDate, dueDate: issueDate });
        return (await finalizeInvoice(draft.id, user.id)).number!;
      };
      const prior = await issue("2025-12-30");
      const current = await issue("2026-01-02");
      const backdated = await issue("2025-12-31");
      const next = await issue("2026-01-03");
      const seq = (number: string) => Number(number.split("-").at(-1));
      assert.match(backdated, /2025-\d+$/);
      assert.match(next, /2026-\d+$/);
      assert.equal(seq(backdated), seq(prior) + 1);
      assert.equal(seq(next), seq(current) + 1);
    });
    await t.test("Rechnung und Storno frieren ihren Aussteller ein und spiegeln die Steuer", async () => {
      const settings = await prisma.companySettings.findUniqueOrThrow({ where: { id: "singleton" } });
      try {
        await prisma.companySettings.update({ where: { id: settings.id }, data: { name: "Alt GmbH", iban: "AT111" } });
        const draft = await createDraftInvoice({ ...base, lines: [{ ...base.lines[0], unitPrice: 0.05, taxRate: 10 }] });
        const invoice = await finalizeInvoice(draft.id, user.id);
        await prisma.companySettings.update({ where: { id: settings.id }, data: { name: "Neu GmbH", iban: "AT222" } });
        const reversal = await createStornoInvoice(invoice.id, user.id);
        const original = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
        assert.equal((original.issuerSnapshot as { iban: string }).iban, "AT111");
        assert.equal((reversal.issuerSnapshot as { iban: string }).iban, "AT222");
        assert.deepEqual(invoice.taxBreakdown, [{ rate: 10, net: 0.05, tax: 0.01 }]);
        assert.deepEqual(reversal.taxBreakdown, [{ rate: 10, net: -0.05, tax: -0.01 }]);
      } finally {
        await prisma.companySettings.update({ where: { id: settings.id }, data: { name: settings.name, iban: settings.iban } });
      }
    });
    await t.test("parallele Export-Worker holen jeden verpassten Monat einmal nach", async () => {
      process.env.SMTP_JSON = "1";
      const recipientEmail = `export-${tag}@example.invalid`;
      for (const month of ["01", "02", "03"]) {
        const issueDate = new Date(`2026-${month}-01T00:00:00Z`);
        const draft = await createDraftInvoice({ ...base, issueDate, dueDate: issueDate });
        await finalizeInvoice(draft.id, user.id);
      }
      const schedule = await prisma.exportSchedule.create({
        data: { name: "Nachholtest", recipientEmail, nextRun: new Date("2026-02-01"), emailSubject: "Test {zeitraum}" },
      });
      const now = new Date("2026-04-01T01:00:00Z");
      await Promise.all([runDueExportSchedules(now), runDueExportSchedules(now), runDueExportSchedules(now)]);
      const events = await prisma.mailEvent.findMany({ where: { recipient: recipientEmail }, orderBy: { createdAt: "asc" } });
      assert.deepEqual(events.map(({ subject }) => subject), ["Test Jänner 2026", "Test Februar 2026", "Test März 2026"]);
      assert.ok(events.every(({ status, exportRunId }) => status === "SIMULATED" && exportRunId));
      const updated = await prisma.exportSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
      assert.equal(updated.nextRun.toISOString(), "2026-05-01T00:00:00.000Z");
      assert.equal(updated.exportRunId, null);
    });
    await t.test("ein bereits vom Mailserver angenommener Export wird nach einem Abbruch abgeglichen", async () => {
      const recipientEmail = `recover-${tag}@example.invalid`;
      const nextRun = new Date("2026-02-01");
      const exportRunId = crypto.randomUUID();
      const schedule = await prisma.exportSchedule.create({ data: {
        name: "Abgleich", nextRun, recipientEmail, exportRunId, exportRunPhase: "SENDING",
        exportRunStartedAt: nextRun, exportRunReference: nextRun, exportRunScheduled: true,
      } });
      await prisma.mailEvent.create({ data: { kind: "EXPORT", recipient: recipientEmail, subject: "Test", status: "ACCEPTED", exportRunId } });
      await runDueExportSchedules(new Date("2026-02-03"));
      const updated = await prisma.exportSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
      assert.equal(updated.nextRun.toISOString(), "2026-03-01T00:00:00.000Z");
      assert.ok(updated.lastRunAt);
      assert.equal(await prisma.mailEvent.count({ where: { recipient: recipientEmail } }), 1);
    });
    await t.test("ein unterbrochener Export mit unklarem Versand bleibt zur Prüfung stehen", async () => {
      const recipientEmail = `review-${tag}@example.invalid`;
      const nextRun = new Date("2026-02-01");
      const exportRunId = crypto.randomUUID();
      const schedule = await prisma.exportSchedule.create({ data: {
        name: "Versand unklar", nextRun, recipientEmail, exportRunId, exportRunPhase: "SENDING",
        exportRunStartedAt: nextRun, exportRunReference: nextRun, exportRunScheduled: true,
      } });
      await prisma.mailEvent.create({ data: { kind: "EXPORT", recipient: recipientEmail, subject: "Test", status: "PENDING", exportRunId } });
      await runDueExportSchedules(new Date("2026-02-03"));
      const updated = await prisma.exportSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
      assert.equal(updated.exportRunPhase, "REVIEW");
      assert.equal(updated.nextRun.toISOString(), nextRun.toISOString());
      assert.equal(await prisma.mailEvent.count({ where: { recipient: recipientEmail } }), 1);
    });
    await t.test("Vorlage pro Termin nur einmal, aktuelle Preise bei Folgeperiode", async () => {
      const software = await prisma.softwareItem.create({ data: { name: "Abo", unitPrice: 100 } });
      const template = await prisma.recurringInvoice.create({ data: { name: "Test Abo", customerId: customer.id, nextRun: new Date("2026-01-31"), autoSend: false, lines: { create: { position: 1, softwareItemId: software.id, quantity: 1, unit: "Monat" } } } });
      const results = await Promise.allSettled(Array.from({ length: 3 }, () => generateInvoiceFromTemplate(template.id, user.id, template.nextRun)));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(await prisma.invoice.count({ where: { recurringInvoiceId: template.id } }), 1);
      const updated = await prisma.recurringInvoice.findUniqueOrThrow({ where: { id: template.id } });
      assert.equal(updated.nextRun.toISOString().slice(0, 10), "2026-02-28");
      await prisma.softwareItem.update({ where: { id: software.id }, data: { unitPrice: 150 } });
      const next = await generateInvoiceFromTemplate(template.id, user.id);
      assert.equal(Number(next.invoice.netTotal), 150);
    });
    await t.test("fehlgeschlagene Finalisierung hinterlässt weder Entwurf noch Terminfortschritt", async () => {
      const template = await prisma.recurringInvoice.create({ data: { name: "Ungültig", customerId: customer.id, taxTreatment: "REVERSE_CHARGE", nextRun: new Date("2026-09-01"), autoSend: false, lines: { create: { position: 1, description: "Wartung", quantity: 1, unitPrice: 100 } } } });
      for (let i = 0; i < 2; i++) await assert.rejects(generateInvoiceFromTemplate(template.id, user.id));
      assert.equal(await prisma.invoice.count({ where: { recurringInvoiceId: template.id } }), 0);
      assert.equal((await prisma.recurringInvoice.findUniqueOrThrow({ where: { id: template.id } })).nextRun.toISOString(), template.nextRun.toISOString());
    });
    await t.test("automatischer Versand wird auch bei parallelem Aufruf nur einmal ausgeführt", async () => {
      await prisma.customer.update({ where: { id: customer.id }, data: { email: `${tag}@example.invalid` } });
      process.env.SMTP_JSON = "1";
      const template = await prisma.recurringInvoice.create({ data: { name: "Versandtest", customerId: customer.id, nextRun: new Date("2026-08-01"), autoSend: true, lines: { create: { position: 1, description: "Abo", quantity: 1, unitPrice: 50 } } } });
      const generated = await generateInvoiceFromTemplate(template.id, user.id);
      assert.equal(generated.emailSent, true, generated.emailError ?? "");
      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: generated.invoice.id } });
      assert.equal(invoice.recurringDeliveryState, "SENT");
      assert.equal(invoice.status, "SENT");
      assert.equal(invoice.recurringDeliveryAttempts, 1);
      assert.ok(invoice.sentAt);
      assert.equal(await prisma.mailEvent.count({ where: { invoiceId: invoice.id, status: "SIMULATED" } }), 1);
      await Promise.all([retryPendingRecurringDeliveries(), retryPendingRecurringDeliveries()]);
      assert.equal(await prisma.mailEvent.count({ where: { invoiceId: invoice.id } }), 1);
      const repeats = await Promise.allSettled([sendInvoiceEmail(invoice.id), sendInvoiceEmail(invoice.id)]);
      assert.equal(repeats.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(await prisma.mailEvent.count({ where: { invoiceId: invoice.id } }), 2);
      delete process.env.SMTP_JSON;
      process.env.SMTP_HOST = "";
      await assert.rejects(sendInvoiceEmail(invoice.id), /SMTP ist nicht konfiguriert/);
      assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).recurringDeliveryState, "FAILED");
      process.env.SMTP_JSON = "1";
    });
    await t.test("fehlgeschlagener Versand bleibt erhalten und wird nach Konfiguration nachgeholt", async () => {
      delete process.env.SMTP_JSON;
      process.env.SMTP_HOST = "";
      const template = await prisma.recurringInvoice.create({ data: { name: "Retrytest", customerId: customer.id, nextRun: new Date("2026-08-01"), autoSend: true, lines: { create: { position: 1, description: "Abo", quantity: 1, unitPrice: 50 } } } });
      const generated = await generateInvoiceFromTemplate(template.id, user.id);
      assert.equal(generated.emailSent, false);
      assert.ok(generated.emailError);
      let invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: generated.invoice.id } });
      assert.equal(invoice.recurringDeliveryState, "FAILED");
      assert.equal(invoice.status, "OPEN");
      assert.equal(await prisma.mailEvent.count({ where: { invoiceId: invoice.id, status: "FAILED" } }), 1);
      process.env.SMTP_JSON = "1";
      await prisma.invoice.update({ where: { id: invoice.id }, data: { recurringDeliveryRetryAt: new Date("2020-01-01") } });
      const retry = await retryPendingRecurringDeliveries();
      assert.equal(retry.sent, 1);
      invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      assert.equal(invoice.recurringDeliveryState, "SENT");
      assert.equal(invoice.recurringDeliveryAttempts, 2);
      assert.equal(await prisma.invoice.count({ where: { recurringInvoiceId: template.id } }), 1);
      assert.equal(await prisma.mailEvent.count({ where: { invoiceId: invoice.id, status: "SIMULATED" } }), 1);
    });
    await t.test("unklar unterbrochener Versand wird nicht automatisch doppelt gesendet", async () => {
      const invoice = await newInvoice();
      await prisma.invoice.update({ where: { id: invoice.id }, data: { recurringDeliveryState: "SENDING", recurringDeliveryStartedAt: new Date("2020-01-01") } });
      const before = await prisma.mailEvent.count({ where: { invoiceId: invoice.id } });
      const retry = await retryPendingRecurringDeliveries();
      assert.equal(retry.review, 1);
      assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).recurringDeliveryState, "REVIEW");
      assert.equal(await prisma.mailEvent.count({ where: { invoiceId: invoice.id } }), before);
    });
    await t.test("nach SMTP-Annahme unterbrochene Zustandsaktualisierung wird abgeglichen", async () => {
      const invoice = await newInvoice();
      await prisma.invoice.update({ where: { id: invoice.id }, data: { recurringDeliveryState: "SENDING", recurringDeliveryStartedAt: new Date("2020-01-01") } });
      await prisma.mailEvent.create({ data: { kind: "INVOICE", invoiceId: invoice.id, recipient: `${tag}@example.invalid`, subject: "Test", status: "ACCEPTED" } });
      const retry = await retryPendingRecurringDeliveries();
      assert.equal(retry.review, 0);
      assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).recurringDeliveryState, "SENT");
      assert.equal(await prisma.mailEvent.count({ where: { invoiceId: invoice.id } }), 1);
    });
    await t.test("Rechnung und Auto-Versand laufen vom 31. Juli über den Februar jeden Monat", async () => {
      process.env.SMTP_JSON = "1";
      await prisma.customer.update({ where: { id: customer.id }, data: { email: `${tag}@example.invalid` } });
      const template = await prisma.recurringInvoice.create({ data: {
        name: "Monatsende", customerId: customer.id, nextRun: new Date("2026-07-31T00:00:00.000Z"), autoSend: true,
        lines: { create: { position: 1, description: "Monatsabo", quantity: 1, unitPrice: 10 } },
      } });
      const periods: string[] = [];
      for (let month = 0; month < 9; month++) {
        const result = await generateInvoiceFromTemplate(template.id, user.id);
        assert.equal(result.emailSent, true, result.emailError ?? "");
        const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: result.invoice.id } });
        assert.equal(invoice.recurringDeliveryState, "SENT");
        periods.push(invoice.recurringPeriod!.toISOString().slice(0, 10));
      }
      assert.deepEqual(periods, ["2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]);
      const invoices = await prisma.invoice.findMany({ where: { recurringInvoiceId: template.id }, select: { id: true } });
      assert.equal(invoices.length, 9);
      assert.equal(await prisma.mailEvent.count({ where: { invoiceId: { in: invoices.map(({ id }) => id) }, status: "SIMULATED" } }), 9);
    });
  } finally { await prisma.$disconnect(); }
});
