import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliveryNoteMail } from "../lib/delivery-note-mailer";

test("erstellt Betreff, Text und sicheren Dateinamen für Lieferscheine", () => {
  const mail = buildDeliveryNoteMail("LS/2026 014", "Beispiel GmbH");

  assert.equal(mail.subject, "Lieferschein LS/2026 014");
  assert.match(mail.text, /anbei erhalten Sie den Lieferschein LS\/2026 014\./);
  assert.match(mail.text, /Mit freundlichen Grüßen\nBeispiel GmbH$/);
  assert.equal(mail.filename, "Lieferschein_LS_2026_014.pdf");
});
