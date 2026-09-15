import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError, ApiError } from "@/lib/api-helpers";
import { importElbaCsv } from "@/lib/bank-reconciliation";
import { getSettings } from "@/lib/settings";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await requireModule("INVOICES");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Bitte eine CSV-Datei auswählen");
    if (file.size === 0) throw new ApiError(400, "Die CSV-Datei ist leer");
    if (file.size > MAX_FILE_SIZE) throw new ApiError(400, "Die CSV-Datei darf höchstens 5 MB groß sein");
    if (!file.name.toLowerCase().endsWith(".csv")) throw new ApiError(400, "Bitte eine CSV-Datei hochladen");
    const settings = await getSettings();
    const result = await importElbaCsv(await file.text(), file.name, session.user.id, settings.iban);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
