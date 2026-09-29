import type { Prisma } from "@/lib/generated/prisma/client";

/** Alle Änderungen an einer Rechnung verwenden dieselbe Transaktionssperre. */
export async function lockInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
}
