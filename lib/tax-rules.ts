import type { CustomerType, SupplyKind, TaxTreatment } from "@/lib/generated/prisma/enums";

export const SUPPLY_KIND_LABELS: Record<SupplyKind, string> = {
  GOODS: "Ware",
  SERVICE: "Dienstleistung",
  ELECTRONIC_SERVICE: "Elektronisch erbrachte Dienstleistung",
};

export const SUPPLY_KIND_OPTIONS = Object.entries(SUPPLY_KIND_LABELS).map(([value, label]) => ({
  value: value as SupplyKind,
  label,
}));

export const EU_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

type TaxAssessmentInput = {
  customerType: CustomerType;
  countryCode: string;
  uid?: string | null;
  supplyKinds: SupplyKind[];
};

export type TaxAssessment = {
  expectedTreatment: TaxTreatment | null;
  reason: string;
  warnings: string[];
  requiresValidUid: boolean;
  requiresManualReview: boolean;
};

/**
 * Bewusst eng gefasste B2B-Regeln. B2C-Ausland (OSS) wird weiterhin nicht
 * automatisch entschieden. Für Drittlandsdienstleistungen gilt nur die
 * B2B-Grundregel; Sondertatbestände müssen weiterhin fachlich geprüft werden.
 */
export function assessTaxTreatment(input: TaxAssessmentInput): TaxAssessment {
  const countryCode = input.countryCode.trim().toUpperCase();
  const kinds = new Set(input.supplyKinds);
  const warnings: string[] = [];

  if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
    return {
      expectedTreatment: null,
      reason: "Das Kundenland ist nicht als ISO-Ländercode hinterlegt.",
      warnings: ["Steuerbehandlung manuell prüfen."],
      requiresValidUid: false,
      requiresManualReview: true,
    };
  }

  if (countryCode === "AT") {
    return {
      expectedTreatment: "STANDARD",
      reason: "Inländischer Umsatz in Österreich.",
      warnings,
      requiresValidUid: false,
      requiresManualReview: false,
    };
  }

  if (input.customerType === "CONSUMER") {
    return {
      expectedTreatment: null,
      reason: "Ausländischer Privatkunde: Die OSS-/B2C-Regel ist noch nicht konfiguriert.",
      warnings: ["Steuerbehandlung vor Finalisierung manuell prüfen."],
      requiresValidUid: false,
      requiresManualReview: true,
    };
  }

  if (EU_COUNTRY_CODES.has(countryCode)) {
    const hasGoods = kinds.has("GOODS");
    const hasServices = kinds.has("SERVICE") || kinds.has("ELECTRONIC_SERVICE");
    if (hasGoods && hasServices) {
      return {
        expectedTreatment: null,
        reason: "Waren und Dienstleistungen an einen EU-Unternehmer benötigen unterschiedliche Steuerbehandlungen.",
        warnings: ["Positionen auf getrennte Rechnungen aufteilen."],
        requiresValidUid: true,
        requiresManualReview: true,
      };
    }
    const expectedTreatment: TaxTreatment = hasGoods ? "INTRA_EU_SUPPLY" : "REVERSE_CHARGE";
    if (!input.uid?.trim()) warnings.push("Für den EU-B2B-Fall ist keine UID hinterlegt.");
    return {
      expectedTreatment,
      reason: hasGoods
        ? "Innergemeinschaftliche Warenlieferung an einen Unternehmer."
        : "Grenzüberschreitende B2B-Dienstleistung innerhalb der EU (Empfängerort).",
      warnings,
      requiresValidUid: true,
      requiresManualReview: false,
    };
  }

  const hasGoods = kinds.has("GOODS");
  const hasServices = kinds.has("SERVICE") || kinds.has("ELECTRONIC_SERVICE");
  if (hasGoods && hasServices) {
    return {
      expectedTreatment: null,
      reason: "Waren und Dienstleistungen an einen Drittlandsunternehmer benötigen unterschiedliche Steuerbehandlungen.",
      warnings: ["Positionen auf getrennte Rechnungen aufteilen."],
      requiresValidUid: false,
      requiresManualReview: true,
    };
  }

  if (hasGoods) {
    return {
      expectedTreatment: "EXPORT",
      reason: "Warenlieferung an einen Unternehmer im Drittland.",
      warnings: ["Ausfuhrnachweis zum Beleg aufbewahren."],
      requiresValidUid: false,
      requiresManualReview: false,
    };
  }

  return {
    expectedTreatment: "THIRD_COUNTRY_SERVICE",
    reason: "B2B-Dienstleistung nach der Empfängerort-Grundregel an einen Unternehmer im Drittland.",
    warnings: ["Unternehmernachweis und die lokale Reverse-Charge-Behandlung im Drittland prüfen."],
    requiresValidUid: false,
    requiresManualReview: false,
  };
}
