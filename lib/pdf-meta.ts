type PdfMetaRow = readonly [label: string, value: string];

type PdfMetaOptions = {
  y: number;
  labelX?: number;
  labelWidth?: number;
  valueX?: number;
  valueWidth?: number;
  rowGap?: number;
};

/**
 * Rendert den Metadatenblock rechts neben der Empfängeradresse.
 *
 * Beide Spalten dürfen umbrechen. Die nächste Zeile beginnt erst unterhalb
 * der tatsächlich höheren Spalte, damit lange Belegnummern oder Werte keine
 * nachfolgenden Angaben überlagern.
 */
export function renderPdfMetaRows(
  doc: PDFKit.PDFDocument,
  rows: readonly PdfMetaRow[],
  {
    y,
    labelX = 320,
    labelWidth = 110,
    valueX = 430,
    valueWidth = 120,
    rowGap = 3,
  }: PdfMetaOptions,
) {
  doc.fontSize(10);

  for (const [label, value] of rows) {
    doc.font("Helvetica");
    const labelHeight = doc.heightOfString(label, { width: labelWidth });
    doc.font("Helvetica-Bold");
    const valueHeight = doc.heightOfString(value, { width: valueWidth, align: "right" });

    doc.font("Helvetica").text(label, labelX, y, { width: labelWidth });
    doc.font("Helvetica-Bold").text(value, valueX, y, { width: valueWidth, align: "right" });

    y += Math.max(15, labelHeight + rowGap, valueHeight + rowGap);
  }

  doc.font("Helvetica");
  return y;
}
