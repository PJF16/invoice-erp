import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { bookMovementTx } from "@/lib/movements";
import type { TaxTreatment } from "@/lib/generated/prisma/enums";

export const TAX_NOTES: Record<Exclude<TaxTreatment, "STANDARD">, string> = {
  REVERSE_CHARGE:
    "Übergang der Steuerschuld auf den Leistungsempfänger (Reverse Charge, § 19 UStG / Art 196 MwSt-RL).",
  INTRA_EU_SUPPLY: "Steuerfreie innergemeinschaftliche Lieferung (Art 6 Abs 1 UStG).",
  EXPORT: "Steuerfreie Ausfuhrlieferung (§ 7 UStG).",
};

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  STANDARD: "Standard (USt)",
  REVERSE_CHARGE: "Reverse Charge (EU-B2B)",
  INTRA_EU_SUPPLY: "Innergem. Lieferung (0%)",
  EXPORT: "Ausfuhr Drittland (0%)",
};

export type LineInput = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  softwareItemId?: string | null;
  itemId?: string | null;
  warehouseId?: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Berechnet Netto/USt/Brutto. Bei allen Steuerbehandlungen außer STANDARD
 * werden sämtliche Positionen mit 0% gerechnet (Reverse Charge, ig. Lieferung, Ausfuhr).
 */
export function computeTotals(lines: LineInput[], treatment: TaxTreatment) {
  const effective = lines.map((line) => ({
    ...line,
    taxRate: treatment === "STANDARD" ? line.taxRate : 0,
    lineNet: round2(line.quantity * line.unitPrice),
  }));

  const netTotal = round2(effective.reduce((sum, l) => sum + l.lineNet, 0));
  const byRate = new Map<number, number>();
  for (const line of effective) {
    byRate.set(line.taxRate, round2((byRate.get(line.taxRate) ?? 0) + line.lineNet));
  }
  const taxBreakdown = [...byRate.entries()]
    .filter(([rate]) => rate > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([rate, net]) => ({ rate, net, tax: round2((net * rate) / 100) }));
  const taxTotal = round2(taxBreakdown.reduce((sum, t) => sum + t.tax, 0));

  return { lines: effective, netTotal, taxTotal, grossTotal: round2(netTotal + taxTotal), taxBreakdown };
}

type CreateInvoiceInput = {
  customerId: string;
  issueDate: Date;
  dueDate: Date;
  servicePeriodStart?: Date | null;
  servicePeriodEnd?: Date | null;
  taxTreatment: TaxTreatment;
  notes?: string | null;
  lines: LineInput[];
  recurringInvoiceId?: string | null;
};

export async function createDraftInvoice(input: CreateInvoiceInput) {
  if (input.lines.length === 0) throw new ApiError(400, "Mindestens eine Position ist erforderlich");
  const { lines, netTotal, taxTotal, grossTotal } = computeTotals(input.lines, input.taxTreatment);

  return prisma.invoice.create({
    data: {
      customerId: input.customerId,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      servicePeriodStart: input.servicePeriodStart ?? null,
      servicePeriodEnd: input.servicePeriodEnd ?? null,
      taxTreatment: input.taxTreatment,
      notes: input.notes ?? null,
      recurringInvoiceId: input.recurringInvoiceId ?? null,
      netTotal,
      taxTotal,
      grossTotal,
      lines: {
        create: lines.map((line, i) => ({
          position: i + 1,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          lineNet: line.lineNet,
          softwareItemId: line.softwareItemId ?? null,
          itemId: line.itemId ?? null,
          warehouseId: line.warehouseId ?? null,
        })),
      },
    },
    include: { lines: true },
  });
}

/**
 * Finalisiert einen Entwurf: vergibt die fortlaufende Rechnungsnummer
 * ({Präfix}{Jahr}-{lfd. Nr}), friert die Kundendaten ein und bucht
 * Hardware-Positionen aus dem Lager aus. Alles in einer Transaktion.
 */
export async function finalizeInvoice(invoiceId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true, customer: true },
    });
    if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
    if (invoice.status !== "DRAFT") throw new ApiError(400, "Nur Entwürfe können finalisiert werden");

    const settings = await tx.companySettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    const year = invoice.issueDate.getFullYear();
    const seq = settings.lastInvoiceYear === year ? settings.lastInvoiceSeq + 1 : 1;
    await tx.companySettings.update({
      where: { id: "singleton" },
      data: { lastInvoiceYear: year, lastInvoiceSeq: seq },
    });
    const number = `${settings.invoicePrefix}${year}-${String(seq).padStart(3, "0")}`;

    for (const line of invoice.lines) {
      if (line.itemId && line.warehouseId) {
        await bookMovementTx(tx, {
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          type: "OUT",
          quantity: Math.round(Number(line.quantity)),
          userId,
          note: `Rechnung ${number}`,
        });
      }
    }

    const c = invoice.customer;
    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        number,
        status: "OPEN",
        customerName: c.name,
        customerAddress: [c.street, `${c.zip} ${c.city}`.trim(), c.country]
          .filter(Boolean)
          .join("\n"),
        customerUid: c.uid,
      },
      include: { lines: true, customer: true },
    });
  });
}

/** Storniert eine Rechnung und bucht ausgebuchte Hardware zurück ins Lager. */
export async function cancelInvoice(invoiceId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true },
    });
    if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
    if (invoice.status === "CANCELED") throw new ApiError(400, "Rechnung ist bereits storniert");
    if (invoice.status === "DRAFT") throw new ApiError(400, "Entwürfe können gelöscht statt storniert werden");

    for (const line of invoice.lines) {
      if (line.itemId && line.warehouseId) {
        await bookMovementTx(tx, {
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          type: "IN",
          quantity: Math.round(Number(line.quantity)),
          userId,
          note: `Storno Rechnung ${invoice.number}`,
        });
      }
    }

    return tx.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELED" } });
  });
}
