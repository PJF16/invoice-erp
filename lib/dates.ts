import type { RecurringInterval } from "@/lib/generated/prisma/enums";

export function addInterval(date: Date, interval: RecurringInterval): Date {
  const d = new Date(date);
  switch (interval) {
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}
