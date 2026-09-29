import type { RecurringInterval } from "@/lib/generated/prisma/enums";

/** Kalenderintervalle in UTC; Monatsende bleibt Monatsende, ohne Monatsüberlauf. */
export function addInterval(date: Date, interval: RecurringInterval): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  const sourceLastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const months = interval === "MONTHLY" ? 1 : interval === "QUARTERLY" ? 3 : 12;
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(day === sourceLastDay ? lastDay : Math.min(day, lastDay));
  return d;
}
