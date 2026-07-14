import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, handleApiError } from "@/lib/api-helpers";
import { updateUserSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = updateUserSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, role, modules, password } = parsed.data;
    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        role,
        modules,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
      select: { id: true, email: true, name: true, role: true, modules: true },
    });
    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}
