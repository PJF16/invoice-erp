import { ZipArchive } from "archiver";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import type { CompanySettings, Prisma } from "@/lib/generated/prisma/client";
import type { ExportPeriod, InvoiceStatus, InvoiceType } from "@/lib/generated/prisma/enums";

const monthLabelFmt = new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric" });

/**
 * Berechnet den Zeitraum für einen relativen Export-Zeitraum (z.B. "Vormonat"),
 * bezogen auf `ref` (Standard: jetzt). `to` ist exklusiv.
 */
export function computePeriodRange(
  period: ExportPeriod,
  ref: Date = new Date(),
): { from?: Date; to?: Date; label: string } {
  const year = ref.getFullYear();
  const month = ref.getMonth();

  switch (period) {
    case "PREVIOUS_MONTH": {
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 1);
      return { from, to, label: monthLabelFmt.format(from) };
    }
    case "PREVIOUS_QUARTER": {
      const prevQuarterIndex = Math.floor(month / 3) - 1;
      const qYear = prevQuarterIndex < 0 ? year - 1 : year;
      const qIndex = (prevQuarterIndex + 4) % 4;
      const from = new Date(qYear, qIndex * 3, 1);
      const to = new Date(qYear, qIndex * 3 + 3, 1);
      return { from, to, label: `Q${qIndex + 1} ${qYear}` };
    }
    case "PREVIOUS_YEAR": {
      const from = new Date(year - 1, 0, 1);
      const to = new Date(year, 0, 1);
      return { from, to, label: String(year - 1) };
    }
    case "ALL_TIME":
    default:
      return { label: "alle Belege" };
  }
}

export type ExportFilter = {
  dateFrom?: Date | null;
  dateTo?: Date | null;
  types: InvoiceType[];
  status?: InvoiceStatus | null;
  customerId?: string | null;
};

/** Finalisierte Belege (Entwürfe werden nie exportiert) nach Filter. */
export async function queryExportInvoices(filter: ExportFilter) {
  return prisma.invoice.findMany({
    where: {
      number: { not: null },
      type: { in: filter.types },
      status: filter.status ?? undefined,
      customerId: filter.customerId ?? undefined,
      issueDate: {
        gte: filter.dateFrom ?? undefined,
        lt: filter.dateTo ?? undefined,
      },
    },
    include: { lines: { orderBy: { position: "asc" } }, customer: true },
    orderBy: { number: "asc" },
  });
}

type InvoiceForZip = Prisma.InvoiceGetPayload<{ include: { lines: true; customer: true } }>;

/** Rendert alle übergebenen Rechnungen/Gutschriften als PDF und packt sie in ein ZIP. */
export async function buildDocumentsZip(
  invoices: InvoiceForZip[],
  settings: CompanySettings,
): Promise<Buffer> {
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });

  for (const invoice of invoices) {
    const pdf = await renderInvoicePdf(invoice, settings);
    const prefix = invoice.type === "CREDIT_NOTE" ? "Stornorechnung" : "Rechnung";
    archive.append(pdf, { name: `${prefix}_${invoice.number}.pdf` });
  }
  await archive.finalize();
  return done;
}
