import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-helpers";
import { assertSameOrigin, requestPortalLogin } from "@/lib/portal-auth";

const schema = z.object({ email: z.email("Bitte geben Sie eine gültige E-Mail-Adresse ein.") });

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const input = schema.safeParse(await req.json());
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0].message }, { status: 400 });
    }
    await requestPortalLogin(input.data.email, req);
    return NextResponse.json({
      message: "Falls die Adresse bei uns hinterlegt ist, wurde ein Zugangscode versendet.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
