import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, requireModule } from "@/lib/api-helpers";
import { deliveryNoteCancellationSchema } from "@/lib/validation";
import { cancelDeliveryNote } from "@/lib/delivery-notes";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireModule("STOCK");
    const parsed = deliveryNoteCancellationSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { id } = await params;
    return NextResponse.json(await cancelDeliveryNote(id, session.user.id, parsed.data.reason, parsed.data.lines));
  } catch (error) {
    return handleApiError(error);
  }
}
