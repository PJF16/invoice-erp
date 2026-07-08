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
  note: optionalTrimmed,
});

export const userSchema = z.object({
  email: z.email("Ungültige E-Mail-Adresse"),
  name: z.string().trim().min(1, "Name ist erforderlich"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});
