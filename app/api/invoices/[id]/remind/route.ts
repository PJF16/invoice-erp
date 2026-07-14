import { NextResponse, type NextRequest } from "next/server";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { sendReminderEmail } from "@/lib/reminders";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const invoice = await sendReminderEmail(id);
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
