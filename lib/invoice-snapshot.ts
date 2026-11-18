import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import { calculateTaxBreakdown, matchesTaxTotal } from "@/lib/document-totals";

const issuerSchema = z.object({
  name: z.string(),
  street: z.string(),
  zip: z.string(),
  city: z.string(),
  country: z.string(),
  uid: z.string(),
  email: z.string(),
  phone: z.string(),
  bankName: z.string(),
  iban: z.string(),
  bic: z.string(),
});

export type InvoiceIssuer = z.infer<typeof issuerSchema>;

export function invoiceIssuer(settings: InvoiceIssuer, snapshot?: Prisma.JsonValue | null): InvoiceIssuer {
  const stored = issuerSchema.safeParse(snapshot);
  return stored.success ? stored.data : issuerSchema.parse(settings);
}

const taxBreakdownSchema = z.array(z.object({ rate: z.number(), net: z.number(), tax: z.number() }));

export function invoiceTaxBreakdown(invoice: {
  taxTreatment: string;
  taxTotal: Prisma.Decimal | number;
  taxBreakdown?: Prisma.JsonValue | null;
  lines: { taxRate: number; lineNet: Prisma.Decimal | number }[];
}) {
  if (invoice.taxTreatment !== "STANDARD") return [];
  const stored = taxBreakdownSchema.safeParse(invoice.taxBreakdown);
  const breakdown = stored.success ? stored.data : calculateTaxBreakdown(
    invoice.lines.map(({ taxRate, lineNet }) => ({ taxRate, lineNet: Number(lineNet) })),
  );
  // Historische Rundungsdifferenzen dürfen die gespeicherte Belegsumme nicht ändern.
  return matchesTaxTotal(breakdown, Number(invoice.taxTotal)) ? breakdown : null;
}
