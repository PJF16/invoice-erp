import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handleApiError, requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { encryptSmtpSecret, getSettings, publicSmtpSettings } from "@/lib/settings";
import { smtpSettingsSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(publicSmtpSettings(await getSettings()));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = smtpSettingsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const current = await getSettings();
    const { host, port, security, user, password, from } = parsed.data;
    if (host && user && !password && !current.smtpPasswordEncrypted) {
      throw new ApiError(400, "Passwort ist für die erstmalige SMTP-Konfiguration erforderlich");
    }

    const settings = await prisma.companySettings.update({
      where: { id: "singleton" },
      data: {
        smtpHost: host,
        smtpPort: port,
        smtpSecurity: security,
        smtpUser: user,
        smtpFrom: from,
        ...(password ? { smtpPasswordEncrypted: encryptSmtpSecret(password) } : {}),
        ...(!host || !user ? { smtpPasswordEncrypted: "" } : {}),
      },
    });
    return NextResponse.json(publicSmtpSettings(settings));
  } catch (error) {
    return handleApiError(error);
  }
}
