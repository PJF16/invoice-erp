-- Separate Namensfelder fuer Privatkunden; "name" bleibt als kompatibler Anzeigename erhalten.
ALTER TABLE "Customer"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT;
