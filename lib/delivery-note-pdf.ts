import PDFDocument from "pdfkit";
import type { Prisma, CompanySettings } from "@/lib/generated/prisma/client";

type DeliveryNoteWithLines = Prisma.DeliveryNoteGetPayload<{ include: { lines: true; customer: true; createdBy: true } }>;
const dateFmt = new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" });

export async function renderDeliveryNotePdf(note: DeliveryNoteWithLines, settings: CompanySettings): Promise<Buffer> {
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
    doc.font("Helvetica-Bold").text(note.customerName);
    doc.font("Helvetica").text(note.customerAddress);
    if (note.customerUid) doc.text(`UID: ${note.customerUid}`);

    const metaY = doc.y - 55;
    const meta: [string, string][] = [
      ["Lieferscheinnummer:", note.number],
      ["Lieferdatum:", dateFmt.format(note.issueDate)],
    ];
    let y = metaY;
    doc.fontSize(10);
    for (const [label, value] of meta) {
      doc.text(label, 320, y, { width: 115 });
      doc.font("Helvetica-Bold").text(value, 435, y, { width: 115, align: "right" });
      doc.font("Helvetica");
      y += 15;
    }

    doc.text("", 55, Math.max(doc.y, y) + 30);
    doc.fontSize(14).font("Helvetica-Bold").text(`Lieferschein ${note.number}`);
    doc.moveDown(0.8);

    const columns = { position: 55, sku: 85, description: 180, warehouse: 400, quantity: 495 };
    const tableTop = doc.y;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#666666");
    doc.text("Pos", columns.position, tableTop);
    doc.text("SKU", columns.sku, tableTop);
    doc.text("Artikel", columns.description, tableTop);
    doc.text("Lager", columns.warehouse, tableTop);
    doc.text("Menge", columns.quantity, tableTop, { width: 60, align: "right" });
    doc.fillColor("#000000").font("Helvetica");
    doc.moveTo(55, doc.y + 3).lineTo(55 + pageWidth, doc.y + 3).strokeColor("#cccccc").stroke();
    doc.moveDown(0.6);
    for (const line of note.lines) {
      const rowY = doc.y;
      doc.text(String(line.position), columns.position, rowY);
      doc.text(line.itemSku ?? "–", columns.sku, rowY, { width: 85 });
      doc.text(line.itemName, columns.description, rowY, { width: 205 });
      const rowBottom = doc.y;
      doc.text(line.warehouseName, columns.warehouse, rowY, { width: 90 });
      doc.text(`${line.quantity} Stk`, columns.quantity, rowY, { width: 60, align: "right" });
      doc.y = Math.max(doc.y, rowBottom) + 6;
    }
    doc.moveTo(55, doc.y + 2).lineTo(55 + pageWidth, doc.y + 2).strokeColor("#cccccc").stroke();

    if (note.notes) {
      doc.moveDown(1.5);
      doc.fontSize(9).text(note.notes, 55, doc.y, { width: pageWidth });
    }
    doc.moveDown(4);
    const signatureY = doc.y;
    doc.moveTo(55, signatureY).lineTo(245, signatureY).strokeColor("#999999").stroke();
    doc.moveTo(360, signatureY).lineTo(550, signatureY).strokeColor("#999999").stroke();
    doc.fontSize(8).fillColor("#666666");
    doc.text("Ort, Datum", 55, signatureY + 5, { width: 190 });
    doc.text("Unterschrift Empfänger", 360, signatureY + 5, { width: 190 });
    doc.fillColor("#000000");
    doc.end();
  });
}
