export const eur = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export const formatDate = (d: Date | string) =>
  new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" }).format(new Date(d));

export const toDateInput = (d: Date | string) => {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const INVOICE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Entwurf", className: "border-gray-200 bg-gray-50 text-gray-600" },
  OPEN: { label: "Offen", className: "border-blue-200 bg-blue-50 text-blue-700" },
  SENT: { label: "Versendet", className: "border-amber-200 bg-amber-50 text-amber-700" },
  PAID: { label: "Bezahlt", className: "border-green-200 bg-green-50 text-green-700" },
  CANCELED: { label: "Storniert", className: "border-red-200 bg-red-50 text-red-700" },
};

export const OFFER_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Entwurf", className: "border-gray-200 bg-gray-50 text-gray-600" },
  OPEN: { label: "Offen", className: "border-blue-200 bg-blue-50 text-blue-700" },
  ACCEPTED: { label: "Angenommen", className: "border-green-200 bg-green-50 text-green-700" },
  REJECTED: { label: "Abgelehnt", className: "border-red-200 bg-red-50 text-red-700" },
  CONVERTED: { label: "In Rechnung", className: "border-violet-200 bg-violet-50 text-violet-700" },
};

export const TAX_TREATMENT_OPTIONS = [
  { value: "STANDARD", label: "Standard (österreichische USt)" },
  { value: "REVERSE_CHARGE", label: "Reverse Charge — EU-B2B, 0% (z.B. deutsches Unternehmen)" },
  { value: "INTRA_EU_SUPPLY", label: "Innergemeinschaftliche Lieferung — 0%" },
  { value: "EXPORT", label: "Ausfuhr Drittland — 0%" },
] as const;

export const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "Monatlich",
  QUARTERLY: "Quartalsweise",
  YEARLY: "Jährlich",
};

export const EXPORT_PERIOD_LABELS: Record<string, string> = {
  PREVIOUS_MONTH: "Vormonat",
  PREVIOUS_QUARTER: "Vorquartal",
  PREVIOUS_YEAR: "Vorjahr",
  ALL_TIME: "Alle Belege",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Rechnungen",
  CREDIT_NOTE: "Gutschriften",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Überweisung",
  CASH: "Bar",
  CARD: "Karte",
  DIRECT_DEBIT: "Lastschrift",
  PAYPAL: "PayPal",
  OTHER: "Sonstiges",
};
