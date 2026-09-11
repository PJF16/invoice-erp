import { NextResponse } from "next/server";
import { handleApiError, requireSession } from "@/lib/api-helpers";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({ user: session.user });
  } catch (error) {
    return handleApiError(error);
  }
}
