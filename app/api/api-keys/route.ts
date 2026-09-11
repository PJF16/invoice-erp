import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireSession } from "@/lib/api-helpers";
import { apiKeySchema } from "@/lib/validation";
import { createApiKeySecret, hashApiKey, visibleApiKeyPrefix } from "@/lib/api-keys";

const publicSelect = {
  id: true,
  name: true,
  prefix: true,
  lastUsedAt: true,
  expiresAt: true,
  createdAt: true,
} as const;

export async function GET() {
  try {
    const session = await requireSession();
    const keys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      select: publicSelect,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(keys, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const parsed = apiKeySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    if (parsed.data.expiresAt && parsed.data.expiresAt <= new Date()) {
      return NextResponse.json({ error: "Das Ablaufdatum muss in der Zukunft liegen" }, { status: 400 });
    }

    const token = createApiKeySecret();
    const apiKey = await prisma.apiKey.create({
      data: {
        name: parsed.data.name,
        expiresAt: parsed.data.expiresAt,
        prefix: visibleApiKeyPrefix(token),
        tokenHash: hashApiKey(token),
        userId: session.user.id,
      },
      select: publicSelect,
    });
    return NextResponse.json({ ...apiKey, token }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
