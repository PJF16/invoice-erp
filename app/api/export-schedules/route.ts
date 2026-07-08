import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { exportScheduleSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireSession();
    const schedules = await prisma.exportSchedule.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(schedules);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = exportScheduleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const schedule = await prisma.exportSchedule.create({ data: parsed.data });
    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
