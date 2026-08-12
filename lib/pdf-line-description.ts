/** Druckt die Positionsbezeichnung und hebt nachfolgende Beschreibungszeilen dezent ab. */
export function renderPdfLineDescription(
  doc: PDFKit.PDFDocument,
  description: string,
  x: number,
  y: number,
  width: number,
) {
  const [title, ...detailLines] = description.split(/\r?\n/);
  const details = detailLines.join("\n").trim();

  doc.font("Helvetica").fontSize(9).fillColor("#000000");
  doc.text(title, x, y, { width });

  if (details) {
    doc.fontSize(8.5).fillColor("#6b7280");
    doc.text(details, x, doc.y + 1, { width, lineGap: 1 });
  }

  const bottom = doc.y;
  doc.font("Helvetica").fontSize(9).fillColor("#000000");
  return bottom;
}
