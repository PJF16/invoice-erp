import { NextResponse, type NextRequest } from "next/server";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { exportFilterSchema } from "@/lib/validation";
import { queryExportInvoices, buildDocumentsZip } from "@/lib/export";
import { getSettings } from "@/lib/settings";

const toFilenameDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = exportFilterSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { dateFrom, dateTo, types, status, customerId } = parsed.data;

    const invoices = await queryExportInvoices({
      dateFrom: dateFrom ?? undefined,
      // "bis" ist im Formular inklusiv gemeint -> exklusiver Tagesanfang danach
      dateTo: dateTo ? new Date(dateTo.getTime() + 86_400_000) : undefined,
      types,
      status: status ?? undefined,
      customerId: customerId ?? undefined,
    });

    if (invoices.length === 0) {
      return NextResponse.json({ error: "Keine Belege im gewählten Zeitraum gefunden" }, { status: 400 });
    }

    const settings = await getSettings();
    const zip = await buildDocumentsZip(invoices, settings);
    const rangeLabel = dateFrom || dateTo
      ? `${dateFrom ? toFilenameDate(dateFrom) : "Anfang"}_bis_${dateTo ? toFilenameDate(dateTo) : "heute"}`
      : "Alle";

    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Belege_${rangeLabel}.zip"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
