import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, requireModule } from "@/lib/api-helpers";
import { sendDeliveryNoteEmail } from "@/lib/delivery-note-mailer";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("STOCK");
    const { id } = await params;
    return NextResponse.json(await sendDeliveryNoteEmail(id));
  } catch (error) {
    return handleApiError(error);
  }
}
