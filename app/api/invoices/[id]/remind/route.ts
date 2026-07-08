import { NextResponse, type NextRequest } from "next/server";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { sendReminderEmail } from "@/lib/reminders";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const invoice = await sendReminderEmail(id);
    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
