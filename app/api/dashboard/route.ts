import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireSession } from "@/lib/api-helpers";
import { overdueWhere } from "@/lib/reminders";

export async function GET() {
  try {
    await requireSession();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const revenueWhere = {
      type: "INVOICE" as const,
      status: { in: ["OPEN", "SENT", "PAID"] as ("OPEN" | "SENT" | "PAID")[] },
      number: { not: null },
    };

    const [month, open, overdue, revenue, yearRevenue, latestInvoices, itemCount, movementsToday] = await Promise.all([
      prisma.invoice.aggregate({ where: { ...revenueWhere, issueDate: { gte: startOfMonth } }, _sum: { netTotal: true }, _count: { _all: true } }),
      prisma.invoice.findMany({ where: { type: "INVOICE", status: { in: ["OPEN", "SENT"] } }, select: { grossTotal: true, paidTotal: true, skontoGranted: true } }),
      prisma.invoice.findMany({ where: overdueWhere(), orderBy: { dueDate: "asc" }, take: 20, include: { customer: { select: { id: true, name: true } } } }),
      prisma.invoice.findMany({ where: { ...revenueWhere, issueDate: { gte: sixMonthsAgo } }, select: { issueDate: true, netTotal: true } }),
      prisma.invoice.findMany({ where: { ...revenueWhere, issueDate: { gte: startOfYear } }, select: { customerId: true, customerName: true, netTotal: true, customer: { select: { name: true } } } }),
      prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { customer: { select: { id: true, name: true } } } }),
      prisma.item.count(),
      prisma.movement.count({ where: { createdAt: { gte: startOfToday } } }),
    ]);

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1, netTotal: 0 };
    });
    for (const invoice of revenue) {
      const entry = months.find((value) => value.year === invoice.issueDate.getFullYear() && value.month === invoice.issueDate.getMonth() + 1);
      if (entry) entry.netTotal += Number(invoice.netTotal);
    }
    const topCustomers = new Map<string, { customerId: string; name: string; netTotal: number }>();
    for (const invoice of yearRevenue) {
      const current = topCustomers.get(invoice.customerId) ?? { customerId: invoice.customerId, name: invoice.customerName || invoice.customer.name, netTotal: 0 };
      current.netTotal += Number(invoice.netTotal);
      topCustomers.set(invoice.customerId, current);
    }

    return NextResponse.json({
      monthRevenue: { netTotal: Number(month._sum.netTotal ?? 0), invoiceCount: month._count._all },
      openReceivables: {
        total: open.reduce((sum, invoice) => sum + Number(invoice.grossTotal) - Number(invoice.paidTotal) - Number(invoice.skontoGranted), 0),
        invoiceCount: open.length,
      },
      overdue: { total: overdue.reduce((sum, invoice) => sum + Number(invoice.grossTotal) - Number(invoice.paidTotal) - Number(invoice.skontoGranted), 0), invoices: overdue },
      revenueByMonth: months,
      topCustomers: [...topCustomers.values()].sort((a, b) => b.netTotal - a.netTotal).slice(0, 10),
      latestInvoices,
      stock: { itemCount, movementsToday },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
