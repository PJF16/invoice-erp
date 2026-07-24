import { NextResponse } from "next/server";
import { requireAdmin, handleApiError } from "@/lib/api-helpers";
import { runBackup } from "@/lib/backup";

export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json(await runBackup());
  } catch (error) {
    return handleApiError(error);
  }
}
