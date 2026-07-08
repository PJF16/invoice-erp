import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich"),
  sku: optionalTrimmed,
  barcode: optionalTrimmed,
  description: optionalTrimmed,
});

export const warehouseSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich"),
  location: optionalTrimmed,
});

export const movementSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUST"]),
  quantity: z.number().int("Menge muss ganzzahlig sein").min(0),
  supplier: optionalTrimmed,
  note: optionalTrimmed,
});

const taxTreatment = z.enum(["STANDARD", "REVERSE_CHARGE", "INTRA_EU_SUPPLY", "EXPORT"]);
const taxRate = z.union([z.literal(0), z.literal(10), z.literal(13), z.literal(20)]);
const money = z.number().min(0).max(99_999_999);
const dateString = z.iso.date().or(z.iso.datetime()).transform((s) => new Date(s));

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich"),
  contactPerson: optionalTrimmed,
  email: z.email("Ungültige E-Mail-Adresse").nullable().optional().or(z.literal("").transform(() => null)),
  street: z.string().trim().default(""),
  zip: z.string().trim().default(""),
  city: z.string().trim().default(""),
  country: z.string().trim().default("Österreich"),
  uid: optionalTrimmed,
  defaultTaxTreatment: taxTreatment.default("STANDARD"),
  notes: optionalTrimmed,
});

export const softwareItemSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich"),
  description: optionalTrimmed,
  unitPrice: money,
  unit: z.string().trim().min(1).default("Monat"),
  active: z.boolean().default(true),
});

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Bezeichnung ist erforderlich"),
  quantity: z.number().positive("Menge muss größer als 0 sein"),
  unit: z.string().trim().min(1).default("Stk"),
  unitPrice: money,
  taxRate: taxRate.default(20),
  softwareItemId: optionalTrimmed,
  itemId: optionalTrimmed,
  warehouseId: optionalTrimmed,
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1, "Kunde ist erforderlich"),
  issueDate: dateString,
  dueDate: dateString,
  servicePeriodStart: dateString.nullable().optional(),
  servicePeriodEnd: dateString.nullable().optional(),
  taxTreatment: taxTreatment.default("STANDARD"),
  notes: optionalTrimmed,
  lines: z.array(invoiceLineSchema).min(1, "Mindestens eine Position ist erforderlich"),
});

export const recurringLineSchema = z
  .object({
    softwareItemId: optionalTrimmed,
    description: optionalTrimmed,
    unitPrice: money.nullable().optional(),
    quantity: z.number().positive("Menge muss größer als 0 sein"),
    unit: z.string().trim().default("Stk"),
    taxRate: taxRate.default(20),
  })
  .refine((l) => l.softwareItemId || (l.description && l.unitPrice != null), {
    message: "Position braucht entweder einen Softwareartikel oder Bezeichnung + Preis",
  });

export const recurringInvoiceSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich"),
  customerId: z.string().min(1, "Kunde ist erforderlich"),
  interval: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).default("MONTHLY"),
  nextRun: dateString,
  active: z.boolean().default(true),
  autoSend: z.boolean().default(true),
  taxTreatment: taxTreatment.default("STANDARD"),
  notes: optionalTrimmed,
  lines: z.array(recurringLineSchema).min(1, "Mindestens eine Position ist erforderlich"),
});

export const settingsSchema = z.object({
  name: z.string().trim().default(""),
  street: z.string().trim().default(""),
  zip: z.string().trim().default(""),
  city: z.string().trim().default(""),
  country: z.string().trim().default("Österreich"),
  uid: z.string().trim().default(""),
  iban: z.string().trim().default(""),
  bic: z.string().trim().default(""),
  bankName: z.string().trim().default(""),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  invoicePrefix: z.string().trim().max(20).default(""),
  paymentDays: z.number().int().min(0).max(365).default(14),
  emailSubject: z.string().trim().min(1).default("Rechnung {nummer}"),
  emailBody: z.string().min(1),
  autoReminders: z.boolean().default(false),
  reminderDays: z.number().int().min(1).max(90).default(7),
  maxReminders: z.number().int().min(1).max(10).default(3),
  reminderSubject: z.string().trim().min(1).default("Zahlungserinnerung zu Rechnung {nummer}"),
  reminderBody: z.string().min(1),
});

const invoiceTypeArray = z
  .array(z.enum(["INVOICE", "CREDIT_NOTE"]))
  .min(1, "Mindestens ein Dokumenttyp ist erforderlich");

export const exportFilterSchema = z.object({
  dateFrom: dateString.nullable().optional(),
  dateTo: dateString.nullable().optional(),
  types: invoiceTypeArray,
  status: z.enum(["OPEN", "SENT", "PAID", "CANCELED"]).nullable().optional(),
  customerId: optionalTrimmed,
});

const emailListSchema = z
  .string()
  .trim()
  .min(1, "E-Mail-Adresse ist erforderlich")
  .refine(
    (v) =>
      v
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .every((s) => z.email().safeParse(s).success),
    "Eine oder mehrere E-Mail-Adressen sind ungültig",
  );

export const exportScheduleSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich"),
  active: z.boolean().default(true),
  interval: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).default("MONTHLY"),
  nextRun: dateString,
  period: z.enum(["PREVIOUS_MONTH", "PREVIOUS_QUARTER", "PREVIOUS_YEAR", "ALL_TIME"]).default("PREVIOUS_MONTH"),
  types: invoiceTypeArray,
  recipientEmail: emailListSchema,
  emailSubject: z.string().trim().min(1).default("Belegexport {zeitraum}"),
  emailBody: z.string().min(1),
});

export const userSchema = z.object({
  email: z.email("Ungültige E-Mail-Adresse"),
  name: z.string().trim().min(1, "Name ist erforderlich"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});
