import type { Tx } from "@/lib/movements";

type NumberSettings = {
  invoicePrefix: string;
  invoiceNumberCycle: "YEARLY" | "DAILY";
  lastInvoiceYear: number;
  lastInvoiceSeq: number;
  offerPrefix: string;
  lastOfferYear: number;
  lastOfferSeq: number;
  deliveryNotePrefix: string;
  lastDeliveryNoteYear: number;
  lastDeliveryNoteSeq: number;
};

async function lockNumberSettings(tx: Tx): Promise<NumberSettings> {
  await tx.companySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const [settings] = await tx.$queryRaw<NumberSettings[]>`
    SELECT
      "invoicePrefix", "invoiceNumberCycle", "lastInvoiceYear", "lastInvoiceSeq",
      "offerPrefix", "lastOfferYear", "lastOfferSeq",
      "deliveryNotePrefix", "lastDeliveryNoteYear", "lastDeliveryNoteSeq"
    FROM "CompanySettings"
    WHERE "id" = 'singleton'
    FOR UPDATE
  `;
  return settings;
}

export function invoiceDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return Number(`${year}${month}${day}`);
}

export async function assignInvoiceNumberTx(tx: Tx, issueDate: Date) {
  const settings = await lockNumberSettings(tx);

  if (settings.invoiceNumberCycle === "DAILY") {
    const day = invoiceDayKey(issueDate);
    const sequence = await tx.invoiceDailySequence.upsert({
      where: { day },
      create: { day, lastSeq: 1 },
      update: { lastSeq: { increment: 1 } },
    });
    return `${settings.invoicePrefix}${day}-${String(sequence.lastSeq).padStart(3, "0")}`;
  }

  const year = issueDate.getFullYear();
  const seq = settings.lastInvoiceYear === year ? settings.lastInvoiceSeq + 1 : 1;
  await tx.companySettings.update({
    where: { id: "singleton" },
    data: { lastInvoiceYear: year, lastInvoiceSeq: seq },
  });
  return `${settings.invoicePrefix}${year}-${String(seq).padStart(3, "0")}`;
}

export async function assignOfferNumberTx(tx: Tx, issueDate: Date) {
  const settings = await lockNumberSettings(tx);
  const year = issueDate.getFullYear();
  const seq = settings.lastOfferYear === year ? settings.lastOfferSeq + 1 : 1;
  await tx.companySettings.update({
    where: { id: "singleton" },
    data: { lastOfferYear: year, lastOfferSeq: seq },
  });
  return `${settings.offerPrefix}${year}-${String(seq).padStart(3, "0")}`;
}

export async function assignDeliveryNoteNumberTx(tx: Tx, issueDate: Date) {
  const settings = await lockNumberSettings(tx);
  const year = issueDate.getFullYear();
  const seq = settings.lastDeliveryNoteYear === year ? settings.lastDeliveryNoteSeq + 1 : 1;
  await tx.companySettings.update({
    where: { id: "singleton" },
    data: { lastDeliveryNoteYear: year, lastDeliveryNoteSeq: seq },
  });
  return `${settings.deliveryNotePrefix}${year}-${String(seq).padStart(3, "0")}`;
}
