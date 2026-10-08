import type { Prisma } from "@/lib/generated/prisma/client";

export function invoiceSearchWhere(query?: string): Prisma.InvoiceWhereInput {
  const q = query?.trim();
  if (!q) return {};
  const text = { contains: q, mode: "insensitive" as const };
  return {
    OR: [
      { number: text },
      { customerName: text },
      { customer: { name: text } },
      { customer: { customerNumber: text } },
      { notes: text },
      { lines: { some: { OR: [
        { description: text },
        { item: { name: text } },
        { item: { sku: text } },
        { softwareItem: { name: text } },
      ] } } },
    ],
  };
}

export function recurringInvoiceSearchWhere(query?: string): Prisma.RecurringInvoiceWhereInput {
  const q = query?.trim();
  if (!q) return {};
  const text = { contains: q, mode: "insensitive" as const };
  return {
    OR: [
      { name: text },
      { customer: { name: text } },
      { customer: { customerNumber: text } },
      { notes: text },
      { lines: { some: { OR: [
        { description: text },
        { softwareItem: { name: text } },
      ] } } },
    ],
  };
}
