import type { RecurringDeliveryState } from "@/lib/generated/prisma/client";

export const RECURRING_DELIVERY_LABELS: Record<RecurringDeliveryState, { label: string; className: string }> = {
  PENDING: { label: "Versand ausstehend", className: "border-blue-200 bg-blue-50 text-blue-700" },
  SENDING: { label: "Wird versendet", className: "border-blue-200 bg-blue-50 text-blue-700" },
  SENT: { label: "Versendet", className: "border-green-200 bg-green-50 text-green-700" },
  FAILED: { label: "Versand fehlgeschlagen", className: "border-red-200 bg-red-50 text-red-700" },
  REVIEW: { label: "Versand prüfen", className: "border-amber-200 bg-amber-50 text-amber-800" },
};
