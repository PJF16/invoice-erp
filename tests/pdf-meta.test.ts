import assert from "node:assert/strict";
import test from "node:test";
import PDFDocument from "pdfkit";
import { renderPdfMetaRows } from "../lib/pdf-meta";

test("mehrzeilige Metadatenwerte schaffen Platz für die nächste Zeile", () => {
  const doc = new PDFDocument({ size: "A4" });
  const placements: Array<{ text: string; y: number }> = [];
  const originalText = doc.text.bind(doc);

  doc.text = ((text: string, x?: number, y?: number, options?: PDFKit.Mixins.TextOptions) => {
    if (typeof y === "number") placements.push({ text, y });
    return originalText(text, x, y, options);
  }) as typeof doc.text;

  doc.fontSize(10).font("Helvetica-Bold");
  const firstValue = "Distributor-Direktversand";
  const firstValueHeight = doc.heightOfString(firstValue, { width: 115, align: "right" });

  renderPdfMetaRows(doc, [
    ["Lieferweg:", firstValue],
    ["Distributor:", "TD Synnex"],
  ], {
    y: 100,
    labelWidth: 115,
    valueX: 435,
    valueWidth: 115,
  });

  const distributorLabel = placements.find((placement) => placement.text === "Distributor:");
  assert.ok(distributorLabel);
  assert.ok(distributorLabel.y >= 100 + firstValueHeight + 3);
  doc.end();
});
