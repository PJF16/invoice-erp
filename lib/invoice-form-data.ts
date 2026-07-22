import { prisma } from "@/lib/prisma";
import type { InvoiceFormData } from "@/components/invoice-form";

export async function loadInvoiceFormData(): Promise<InvoiceFormData> {
  const [customers, softwareItems, hardwareItems, warehouses] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.softwareItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.item.findMany({ orderBy: { name: "asc" }, include: { stocks: { include: { warehouse: true } } } }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      customerNumber: c.customerNumber,
      defaultTaxTreatment: c.defaultTaxTreatment,
    })),
    softwareItems: softwareItems.map((s) => ({
      id: s.id,
      name: s.name,
      unitPrice: Number(s.unitPrice),
      unit: s.unit,
    })),
    hardwareItems: hardwareItems.map((i) => ({
      id: i.id,
      name: i.name,
      stocks: i.stocks.map((s) => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        quantity: s.quantity,
      })),
    })),
    warehouses: warehouses.map((w) => ({ id: w.id, name: w.name })),
  };
}
