import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, handleApiError } from "@/lib/api-helpers";
import { backupSettingsSchema } from "@/lib/validation";
import {
  encryptBackupSecret,
  getBackupSettings,
  publicBackupSettings,
} from "@/lib/backup";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(publicBackupSettings(await getBackupSettings()));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = backupSettingsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const existing = await getBackupSettings();
    const { smbPassword, ...data } = parsed.data;
    if (
      data.enabled &&
      data.target === "SMB" &&
      !smbPassword &&
      !existing.smbPasswordEncrypted
    ) {
      return NextResponse.json({ error: "SMB-Passwort ist erforderlich" }, { status: 400 });
    }

    const settings = await prisma.backupSettings.update({
      where: { id: "singleton" },
      data: {
        ...data,
        ...(smbPassword ? { smbPasswordEncrypted: encryptBackupSecret(smbPassword) } : {}),
      },
    });
    return NextResponse.json(publicBackupSettings(settings));
  } catch (error) {
    return handleApiError(error);
  }
}
