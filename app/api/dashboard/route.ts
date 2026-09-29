import { hasModule } from "@/lib/permissions";
import { openAmount } from "@/lib/payments";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireSession } from "@/lib/api-helpers";
import { overdueWhere } from "@/lib/reminders";

export async function GET() {
  try {
    const session = await requireSession();
    const canStock = hasModule(session.user, "STOCK");
    if (!hasModule(session.user, "INVOICES")) {
      const [itemCount, movementsToday] = canStock ? await Promise.all([
        prisma.item.count(), prisma.movement.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      ]) : [0, 0];
      return NextResponse.json({ monthRevenue: { netTotal: 0, invoiceCount: 0 }, openReceivables: { total: 0, invoiceCount: 0 }, overdue: { total: 0, invoiceCount: 0, invoices: [] }, revenueByMonth: [], topCustomers: [], latestInvoices: [], stock: { itemCount, movementsToday } });
    }
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

    const [month, open, overdue, revenue, yearRevenue, latestInvoices, itemCount, movementsToday, overdueAggregate] = await Promise.all([
      prisma.invoice.aggregate({ where: { ...revenueWhere, issueDate: { gte: startOfMonth } }, _sum: { netTotal: true }, _count: { _all: true } }),
      prisma.invoice.findMany({ where: { type: "INVOICE", status: { in: ["OPEN", "SENT"] } }, select: { grossTotal: true, paidTotal: true, skontoGranted: true } }),
      prisma.invoice.findMany({ where: overdueWhere(), orderBy: { dueDate: "asc" }, take: 20, include: { customer: { select: { id: true, name: true } } } }),
      prisma.invoice.findMany({ where: { ...revenueWhere, issueDate: { gte: sixMonthsAgo } }, select: { issueDate: true, netTotal: true } }),
      prisma.invoice.findMany({ where: { ...revenueWhere, issueDate: { gte: startOfYear } }, select: { customerId: true, customerName: true, netTotal: true, customer: { select: { name: true } } } }),
      prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { customer: { select: { id: true, name: true } } } }),
      canStock ? prisma.item.count() : Promise.resolve(0),
      canStock ? prisma.movement.count({ where: { createdAt: { gte: startOfToday } } }) : Promise.resolve(0),
      prisma.invoice.aggregate({ where: overdueWhere(), _count: { _all: true }, _sum: { grossTotal: true, paidTotal: true, skontoGranted: true } }),
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
      overdue: { total: openAmount({ grossTotal: overdueAggregate._sum.grossTotal ?? 0, paidTotal: overdueAggregate._sum.paidTotal ?? 0, skontoGranted: overdueAggregate._sum.skontoGranted ?? 0 }), invoiceCount: overdueAggregate._count._all, invoices: overdue },
      revenueByMonth: months,
      topCustomers: [...topCustomers.values()].sort((a, b) => b.netTotal - a.netTotal).slice(0, 10),
      latestInvoices,
      stock: { itemCount, movementsToday },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
