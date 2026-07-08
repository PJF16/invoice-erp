import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireAdmin, handleApiError } from "@/lib/api-helpers";
import { settingsSchema } from "@/lib/validation";
import { getSettings, isSmtpConfigured } from "@/lib/settings";

export async function GET() {
  try {
    await requireSession();
    const settings = await getSettings();
    return NextResponse.json({ ...settings, smtpConfigured: isSmtpConfigured() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = settingsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const settings = await prisma.companySettings.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", ...parsed.data },
    });
    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
