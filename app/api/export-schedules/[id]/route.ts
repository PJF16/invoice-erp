import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireModule, handleApiError } from "@/lib/api-helpers";
import { exportScheduleSchema } from "@/lib/validation";
import { clearedExportRun } from "@/lib/export-schedule";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const schedule = await prisma.exportSchedule.findUnique({ where: { id } });
    if (!schedule) return NextResponse.json({ error: "Exportplan nicht gefunden" }, { status: 404 });
    return NextResponse.json(schedule);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const parsed = exportScheduleSchema.partial().safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const schedule = await prisma.exportSchedule.findUniqueOrThrow({ where: { id } });
    if (schedule.exportRunPhase === "PREPARING" || schedule.exportRunPhase === "SENDING") {
      throw new ApiError(409, "Der Export läuft gerade.");
    }
    const rescheduled = parsed.data.nextRun && parsed.data.nextRun.getTime() !== schedule.nextRun.getTime();
    const [updated] = await prisma.exportSchedule.updateManyAndReturn({
      where: { id, nextRun: schedule.nextRun, exportRunId: schedule.exportRunId, exportRunPhase: schedule.exportRunPhase },
      data: { ...parsed.data, ...(rescheduled && schedule.exportRunPhase === "REVIEW" ? clearedExportRun : {}) },
    });
    if (!updated) throw new ApiError(409, "Der Exportplan wurde zwischenzeitlich geändert.");
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const schedule = await prisma.exportSchedule.findUniqueOrThrow({ where: { id } });
    if (schedule.exportRunPhase === "PREPARING" || schedule.exportRunPhase === "SENDING") {
      throw new ApiError(409, "Der Export läuft gerade.");
    }
    const deleted = await prisma.exportSchedule.deleteMany({
      where: { id, exportRunId: schedule.exportRunId, exportRunPhase: schedule.exportRunPhase },
    });
    if (deleted.count !== 1) throw new ApiError(409, "Der Exportplan wurde zwischenzeitlich geändert.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
