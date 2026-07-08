import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { getSettings, isSmtpConfigured } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { getMailTransport, fillMailTemplate } from "@/lib/mail-transport";

/** Versendet eine finalisierte Rechnung als PDF-Anhang an die Kunden-E-Mail. */
export async function sendInvoiceEmail(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true, customer: true },
  });
  if (!invoice) throw new ApiError(404, "Rechnung nicht gefunden");
  if (invoice.status === "DRAFT" || !invoice.number) {
    throw new ApiError(400, "Rechnung muss zuerst finalisiert werden");
  }
  if (invoice.status === "CANCELED") throw new ApiError(400, "Stornierte Rechnungen können nicht versendet werden");
  if (!invoice.customer.email) {
    throw new ApiError(400, `Kunde „${invoice.customer.name}" hat keine E-Mail-Adresse`);
  }

  const settings = await getSettings();
  const pdf = await renderInvoicePdf(invoice, settings);
  const vars = { nummer: invoice.number, kunde: invoice.customerName || invoice.customer.name };

  const transport = getMailTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: invoice.customer.email,
    subject: fillMailTemplate(settings.emailSubject, vars),
    text: fillMailTemplate(settings.emailBody, vars),
    attachments: [
      {
        filename: `Rechnung_${invoice.number.replace(/[^\w-]/g, "_")}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      sentAt: new Date(),
      status: invoice.status === "OPEN" ? "SENT" : invoice.status,
    },
  });
}

export { isSmtpConfigured };
