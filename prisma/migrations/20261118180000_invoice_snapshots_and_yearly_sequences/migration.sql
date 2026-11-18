CREATE TABLE "InvoiceYearlySequence" (
    "year" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceYearlySequence_pkey" PRIMARY KEY ("year")
);

WITH historical AS (
    SELECT parts[1]::INTEGER AS year, parts[2]::NUMERIC AS seq
    FROM "Invoice"
    CROSS JOIN LATERAL regexp_match(number, '([0-9]{4})-([0-9]{3,})$') AS matched(parts)
    -- Ein Beleg kann um den lokalen Jahreswechsel im UTC-Zeitstempel noch das Nachbarjahr tragen.
    WHERE abs(parts[1]::INTEGER - EXTRACT(YEAR FROM "issueDate")::INTEGER) <= 1
    UNION ALL
    SELECT "lastInvoiceYear", "lastInvoiceSeq"
    FROM "CompanySettings"
    WHERE "lastInvoiceYear" > 0
)
INSERT INTO "InvoiceYearlySequence" ("year", "lastSeq")
SELECT year, MAX(seq)::INTEGER
FROM historical
WHERE seq BETWEEN 1 AND 2147483647
GROUP BY year;

ALTER TABLE "Invoice" ADD COLUMN "issuerSnapshot" JSONB, ADD COLUMN "taxBreakdown" JSONB;

-- Altdaten enthalten keinen historischen Aussteller. Den derzeit verfügbaren Stand festhalten.
UPDATE "Invoice"
SET "issuerSnapshot" = jsonb_build_object(
    'name', settings.name, 'street', settings.street, 'zip', settings.zip,
    'city', settings.city, 'country', settings.country, 'uid', settings.uid,
    'email', settings.email, 'phone', settings.phone, 'bankName', settings."bankName",
    'iban', settings.iban, 'bic', settings.bic
)
FROM "CompanySettings" AS settings
WHERE "Invoice".number IS NOT NULL AND settings.id = 'singleton';
