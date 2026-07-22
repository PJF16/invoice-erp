import type { Tx } from "@/lib/movements";

type NumberSettings = {
  invoicePrefix: string;
  lastInvoiceYear: number;
  lastInvoiceSeq: number;
  offerPrefix: string;
  lastOfferYear: number;
  lastOfferSeq: number;
};

async function lockNumberSettings(tx: Tx): Promise<NumberSettings> {
  await tx.companySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const [settings] = await tx.$queryRaw<NumberSettings[]>`
    SELECT
      "invoicePrefix", "lastInvoiceYear", "lastInvoiceSeq",
      "offerPrefix", "lastOfferYear", "lastOfferSeq"
    FROM "CompanySettings"
    WHERE "id" = 'singleton'
    FOR UPDATE
  `;
  return settings;
}

export async function assignInvoiceNumberTx(tx: Tx, issueDate: Date) {
  const settings = await lockNumberSettings(tx);
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
