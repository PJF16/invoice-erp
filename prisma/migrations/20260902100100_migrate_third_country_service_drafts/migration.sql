-- Nur veränderbare Entwürfe und Vorlagen korrigieren. Bereits finalisierte
-- Belege bleiben aus Gründen der Nachvollziehbarkeit unverändert.
UPDATE "Invoice" AS invoice
SET "taxTreatment" = 'THIRD_COUNTRY_SERVICE'
FROM "Customer" AS customer
WHERE invoice."customerId" = customer."id"
  AND invoice."status" = 'DRAFT'
  AND customer."customerType" = 'BUSINESS'
  AND customer."countryCode" NOT IN (
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HU',
    'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
  )
  AND EXISTS (
    SELECT 1 FROM "InvoiceLine" AS line
    WHERE line."invoiceId" = invoice."id"
      AND line."supplyKind" IN ('SERVICE', 'ELECTRONIC_SERVICE')
  )
  AND NOT EXISTS (
    SELECT 1 FROM "InvoiceLine" AS line
    WHERE line."invoiceId" = invoice."id" AND line."supplyKind" = 'GOODS'
  );

UPDATE "Offer" AS offer
SET "taxTreatment" = 'THIRD_COUNTRY_SERVICE'
FROM "Customer" AS customer
WHERE offer."customerId" = customer."id"
  AND offer."status" = 'DRAFT'
  AND customer."customerType" = 'BUSINESS'
  AND customer."countryCode" NOT IN (
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HU',
    'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
  )
  AND EXISTS (
    SELECT 1 FROM "OfferLine" AS line
    WHERE line."offerId" = offer."id"
      AND line."supplyKind" IN ('SERVICE', 'ELECTRONIC_SERVICE')
  )
  AND NOT EXISTS (
    SELECT 1 FROM "OfferLine" AS line
    WHERE line."offerId" = offer."id" AND line."supplyKind" = 'GOODS'
  );

UPDATE "RecurringInvoice" AS template
SET "taxTreatment" = 'THIRD_COUNTRY_SERVICE'
FROM "Customer" AS customer
WHERE template."customerId" = customer."id"
  AND customer."customerType" = 'BUSINESS'
  AND customer."countryCode" NOT IN (
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HU',
    'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
  )
  AND EXISTS (
    SELECT 1 FROM "RecurringInvoiceLine" AS line
    WHERE line."recurringInvoiceId" = template."id"
      AND line."supplyKind" IN ('SERVICE', 'ELECTRONIC_SERVICE')
  )
  AND NOT EXISTS (
    SELECT 1 FROM "RecurringInvoiceLine" AS line
    WHERE line."recurringInvoiceId" = template."id" AND line."supplyKind" = 'GOODS'
  );
