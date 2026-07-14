import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { runExportSchedule } from "@/lib/export-schedule";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const result = await runExportSchedule(id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
