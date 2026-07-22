import PDFDocument from "pdfkit";
import { computeTotals, TAX_NOTES } from "@/lib/invoices";
import type { Prisma, CompanySettings } from "@/lib/generated/prisma/client";

type OfferWithLines = Prisma.OfferGetPayload<{ include: { lines: true; customer: true } }>;

const eur = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });
const dateFmt = new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" });
const num = (value: Prisma.Decimal | number) => Number(value);

export async function renderOfferPdf(offer: OfferWithLines, settings: CompanySettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 60, left: 55, right: 55 } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 110;
    doc.fontSize(16).font("Helvetica-Bold").text(settings.name || "—");
    doc.fontSize(9).font("Helvetica").fillColor("#444444");
    doc.text(`${settings.street}, ${settings.zip} ${settings.city}, ${settings.country}`);
    const contact = [settings.uid && `UID: ${settings.uid}`, settings.email, settings.phone].filter(Boolean).join("  ·  ");
    if (contact) doc.text(contact);
    doc.fillColor("#000000");

    doc.moveDown(2.5);
    doc.fontSize(8).fillColor("#888888").text(`${settings.name} · ${settings.street} · ${settings.zip} ${settings.city}`);
    doc.fillColor("#000000").fontSize(11).moveDown(0.4);
    doc.font("Helvetica-Bold").text(offer.customerName);
    doc.font("Helvetica").text(offer.customerAddress);
    if (offer.customerUid) doc.text(`UID: ${offer.customerUid}`);

    const metaY = doc.y - 60;
    doc.fontSize(10);
    const meta: [string, string][] = [
      ["Angebotsnummer:", offer.number ?? "ENTWURF"],
      ["Angebotsdatum:", dateFmt.format(offer.issueDate)],
      ["Gültig bis:", dateFmt.format(offer.validUntil)],
    ];
    let y = metaY;
    for (const [label, value] of meta) {
      doc.text(label, 320, y, { width: 110 });
      doc.font("Helvetica-Bold").text(value, 430, y, { width: 120, align: "right" });
      doc.font("Helvetica");
      y += 15;
    }

    doc.text("", 55, Math.max(doc.y, y) + 30);
    doc.fontSize(14).font("Helvetica-Bold").text(`Angebot ${offer.number ?? "(Entwurf)"}`);
    doc.moveDown(0.8);

    const columns = { position: 55, description: 80, quantity: 320, price: 385, tax: 455, net: 490 };
    const tableTop = doc.y;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#666666");
    doc.text("Pos", columns.position, tableTop);
    doc.text("Bezeichnung", columns.description, tableTop);
    doc.text("Menge", columns.quantity, tableTop, { width: 60, align: "right" });
    doc.text("Einzelpreis", columns.price, tableTop, { width: 65, align: "right" });
    doc.text("USt", columns.tax, tableTop, { width: 30, align: "right" });
    doc.text("Netto", columns.net, tableTop, { width: 65, align: "right" });
    doc.fillColor("#000000").font("Helvetica");
    doc.moveTo(55, doc.y + 3).lineTo(55 + pageWidth, doc.y + 3).strokeColor("#cccccc").stroke();
    doc.moveDown(0.6);

    const { taxBreakdown } = computeTotals(
      offer.lines.map((line) => ({
        description: line.description,
        quantity: num(line.quantity),
        unit: line.unit,
        unitPrice: num(line.unitPrice),
        taxRate: line.taxRate,
      })),
      offer.taxTreatment,
    );

    for (const line of offer.lines) {
      const rowY = doc.y;
      const quantity = num(line.quantity);
      doc.text(String(line.position), columns.position, rowY);
      doc.text(line.description, columns.description, rowY, { width: 230 });
      const rowBottom = doc.y;
      doc.text(`${quantity % 1 === 0 ? quantity : quantity.toFixed(2)} ${line.unit}`, columns.quantity, rowY, { width: 60, align: "right" });
      doc.text(eur.format(num(line.unitPrice)), columns.price, rowY, { width: 65, align: "right" });
      doc.text(`${line.taxRate}%`, columns.tax, rowY, { width: 30, align: "right" });
      doc.text(eur.format(num(line.lineNet)), columns.net, rowY, { width: 65, align: "right" });
      doc.y = Math.max(doc.y, rowBottom) + 4;
    }

    doc.moveTo(320, doc.y + 4).lineTo(55 + pageWidth, doc.y + 4).strokeColor("#cccccc").stroke();
    doc.moveDown(0.8);
    const sumRow = (label: string, value: string, bold = false) => {
      const rowY = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica");
      doc.text(label, 320, rowY, { width: 160 });
      doc.text(value, 490, rowY, { width: 65, align: "right" });
      doc.moveDown(0.35);
    };
    sumRow("Nettobetrag", eur.format(num(offer.netTotal)));
    for (const tax of taxBreakdown) {
      sumRow(`zzgl. ${tax.rate}% USt auf ${eur.format(tax.net)}`, eur.format(tax.tax));
    }
    doc.moveDown(0.2);
    sumRow("Angebotssumme", eur.format(num(offer.grossTotal)), true);
    doc.font("Helvetica");

    if (offer.taxTreatment !== "STANDARD") {
      doc.moveDown(1);
      doc.fontSize(9).fillColor("#444444").text(TAX_NOTES[offer.taxTreatment], 55, doc.y, { width: pageWidth });
      doc.fillColor("#000000").fontSize(10);
    }
    if (offer.notes) {
      doc.moveDown(1);
      doc.fontSize(9).text(offer.notes, 55, doc.y, { width: pageWidth });
      doc.fontSize(10);
    }
    doc.moveDown(1.5);
    doc.text(`Dieses Angebot ist gültig bis ${dateFmt.format(offer.validUntil)}.`, 55, doc.y, { width: pageWidth });
    doc.end();
  });
}
