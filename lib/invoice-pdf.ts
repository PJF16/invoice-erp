import PDFDocument from "pdfkit";
import { computeTotals, TAX_NOTES } from "@/lib/invoices";
import type { Prisma, CompanySettings } from "@/lib/generated/prisma/client";

type InvoiceWithLines = Prisma.InvoiceGetPayload<{ include: { lines: true; customer: true } }>;

const eur = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });
const dateFmt = new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" });
const num = (d: Prisma.Decimal | number) => Number(d);

export function renderInvoicePdf(
  invoice: InvoiceWithLines,
  settings: CompanySettings,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 60, left: 55, right: 55 } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 110;

    // Kopf: Firma
    doc.fontSize(16).font("Helvetica-Bold").text(settings.name || "—");
    doc.fontSize(9).font("Helvetica").fillColor("#444444");
    doc.text(`${settings.street}, ${settings.zip} ${settings.city}, ${settings.country}`);
    const contact = [settings.uid && `UID: ${settings.uid}`, settings.email, settings.phone]
      .filter(Boolean)
      .join("  ·  ");
    if (contact) doc.text(contact);
    doc.fillColor("#000000");

    // Empfänger
    doc.moveDown(2.5);
    doc.fontSize(8).fillColor("#888888")
      .text(`${settings.name} · ${settings.street} · ${settings.zip} ${settings.city}`);
    doc.fillColor("#000000").fontSize(11).moveDown(0.4);
    doc.font("Helvetica-Bold").text(invoice.customerName);
    doc.font("Helvetica").text(invoice.customerAddress);
    if (invoice.customerUid) doc.text(`UID: ${invoice.customerUid}`);

    // Meta rechts
    const metaY = doc.y - 60;
    doc.fontSize(10);
    const meta: [string, string][] = [
      ["Rechnungsnummer:", invoice.number ?? "ENTWURF"],
      ["Rechnungsdatum:", dateFmt.format(invoice.issueDate)],
      ["Fällig am:", dateFmt.format(invoice.dueDate)],
    ];
    if (invoice.servicePeriodStart && invoice.servicePeriodEnd) {
      meta.push([
        "Leistungszeitraum:",
        `${dateFmt.format(invoice.servicePeriodStart)} – ${dateFmt.format(invoice.servicePeriodEnd)}`,
      ]);
    }
    let y = metaY;
    for (const [label, value] of meta) {
      doc.text(label, 320, y, { width: 110 });
      doc.font("Helvetica-Bold").text(value, 430, y, { width: 120, align: "right" });
      doc.font("Helvetica");
      y += 15;
    }

    // Titel
    const docTitle = invoice.type === "CREDIT_NOTE" ? "Stornorechnung" : "Rechnung";
    doc.text("", 55, Math.max(doc.y, y) + 30);
    doc.fontSize(14).font("Helvetica-Bold").text(`${docTitle} ${invoice.number ?? "(Entwurf)"}`);
    doc.moveDown(0.8);

    // Tabelle
    const cols = { pos: 55, desc: 80, qty: 320, price: 385, tax: 455, net: 490 };
    const tableTop = doc.y;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#666666");
    doc.text("Pos", cols.pos, tableTop);
    doc.text("Bezeichnung", cols.desc, tableTop);
    doc.text("Menge", cols.qty, tableTop, { width: 60, align: "right" });
    doc.text("Einzelpreis", cols.price, tableTop, { width: 65, align: "right" });
    doc.text("USt", cols.tax, tableTop, { width: 30, align: "right" });
    doc.text("Netto", cols.net, tableTop, { width: 65, align: "right" });
    doc.fillColor("#000000").font("Helvetica");
    doc.moveTo(55, doc.y + 3).lineTo(55 + pageWidth, doc.y + 3).strokeColor("#cccccc").stroke();
    doc.moveDown(0.6);

    const { taxBreakdown } = computeTotals(
      invoice.lines.map((l) => ({
        description: l.description,
        quantity: num(l.quantity),
        unit: l.unit,
        unitPrice: num(l.unitPrice),
        taxRate: l.taxRate,
      })),
      invoice.taxTreatment,
    );

    for (const line of invoice.lines) {
      const rowY = doc.y;
      const qty = num(line.quantity);
      doc.text(String(line.position), cols.pos, rowY);
      doc.text(line.description, cols.desc, rowY, { width: 230 });
      const rowBottom = doc.y;
      doc.text(`${qty % 1 === 0 ? qty : qty.toFixed(2)} ${line.unit}`, cols.qty, rowY, { width: 60, align: "right" });
      doc.text(eur.format(num(line.unitPrice)), cols.price, rowY, { width: 65, align: "right" });
      doc.text(`${line.taxRate}%`, cols.tax, rowY, { width: 30, align: "right" });
      doc.text(eur.format(num(line.lineNet)), cols.net, rowY, { width: 65, align: "right" });
      doc.y = Math.max(doc.y, rowBottom) + 4;
    }

    doc.moveTo(320, doc.y + 4).lineTo(55 + pageWidth, doc.y + 4).strokeColor("#cccccc").stroke();
    doc.moveDown(0.8);

    // Summen
    const sumRow = (label: string, value: string, bold = false) => {
      const rowY = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica");
      doc.text(label, 320, rowY, { width: 160 });
      doc.text(value, 490, rowY, { width: 65, align: "right" });
      doc.moveDown(0.35);
    };
    sumRow("Nettobetrag", eur.format(num(invoice.netTotal)));
    for (const t of taxBreakdown) {
      sumRow(`zzgl. ${t.rate}% USt auf ${eur.format(t.net)}`, eur.format(t.tax));
    }
    doc.moveDown(0.2);
    sumRow("Rechnungsbetrag", eur.format(num(invoice.grossTotal)), true);
    doc.font("Helvetica");

    // Steuerhinweis
    if (invoice.taxTreatment !== "STANDARD") {
      doc.moveDown(1);
      doc.fontSize(9).fillColor("#444444")
        .text(TAX_NOTES[invoice.taxTreatment], 55, doc.y, { width: pageWidth });
      doc.fillColor("#000000").fontSize(10);
    }

    // Notizen
    if (invoice.notes) {
      doc.moveDown(1);
      doc.fontSize(9).text(invoice.notes, 55, doc.y, { width: pageWidth });
      doc.fontSize(10);
    }

    // Zahlungsinfo
    doc.moveDown(1.5);
    doc.fontSize(10).text(
      invoice.type === "CREDIT_NOTE"
        ? "Der Betrag wird gutgeschrieben bzw. mit offenen Forderungen verrechnet."
        : `Zahlbar ohne Abzug bis ${dateFmt.format(invoice.dueDate)}.`,
      55,
      doc.y,
      { width: pageWidth },
    );
    if (settings.iban) {
      const bank = [
        settings.bankName && `Bank: ${settings.bankName}`,
        `IBAN: ${settings.iban}`,
        settings.bic && `BIC: ${settings.bic}`,
      ]
        .filter(Boolean)
        .join("  ·  ");
      doc.fontSize(9).fillColor("#444444").text(bank, { width: pageWidth });
      if (invoice.number) {
        doc.text(`Verwendungszweck: ${invoice.number}`, { width: pageWidth });
      }
      doc.fillColor("#000000");
    }

    doc.end();
  });
}
