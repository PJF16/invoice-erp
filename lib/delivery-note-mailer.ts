import { ApiError } from "@/lib/api-helpers";
import { renderDeliveryNotePdf } from "@/lib/delivery-note-pdf";
import { sendMonitoredMail } from "@/lib/mail-transport";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export function buildDeliveryNoteMail(number: string, companyName: string) {
  return {
    subject: `Lieferschein ${number}`,
    text: [
      "Sehr geehrte Damen und Herren,",
      "",
      `anbei erhalten Sie den Lieferschein ${number}.`,
      "",
      "Mit freundlichen Grüßen",
      companyName,
    ].join("\n"),
    filename: `Lieferschein_${number.replace(/[^\w-]/g, "_")}.pdf`,
  };
}

/** Versendet einen aktiven Lieferschein als PDF-Anhang an die Kunden-E-Mail. */
export async function sendDeliveryNoteEmail(deliveryNoteId: string) {
  const note = await prisma.deliveryNote.findUnique({
    where: { id: deliveryNoteId },
    include: {
      customer: true,
      createdBy: true,
      lines: { orderBy: { position: "asc" } },
      cancellations: {
        orderBy: { canceledAt: "asc" },
        include: { lines: { include: { deliveryNoteLine: { select: { position: true } } } } },
      },
    },
  });

  if (!note) throw new ApiError(404, "Lieferschein nicht gefunden");
  if (note.status === "CANCELED") {
    throw new ApiError(400, "Stornierte Lieferscheine können nicht versendet werden");
  }
  if (!note.customer.email) {
    throw new ApiError(400, `Kunde „${note.customer.name}" hat keine E-Mail-Adresse`);
  }

  const settings = await getSettings();
  const pdf = await renderDeliveryNotePdf(note, settings);
  const mail = buildDeliveryNoteMail(note.number, settings.name);

  await sendMonitoredMail({
    kind: "DELIVERY_NOTE",
    recipient: note.customer.email,
    subject: mail.subject,
    deliveryNoteId: note.id,
  }, {
    to: note.customer.email,
    subject: mail.subject,
    text: mail.text,
    attachments: [{
      filename: mail.filename,
      content: pdf,
      contentType: "application/pdf",
    }],
  });

  return prisma.deliveryNote.update({
    where: { id: deliveryNoteId },
    data: { sentAt: new Date() },
  });
}
