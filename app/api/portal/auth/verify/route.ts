import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api-helpers";
import { assertSameOrigin, setPortalSessionCookie, verifyPortalCode } from "@/lib/portal-auth";

const schema = z.object({
  email: z.email("Bitte geben Sie eine gültige E-Mail-Adresse ein."),
  code: z.string().regex(/^\d{6}$/, "Der Code muss aus sechs Ziffern bestehen."),
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const input = schema.safeParse(await req.json());
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues[0].message }, { status: 400 });
    }
    const session = await verifyPortalCode(input.data.email, input.data.code);
    const response = NextResponse.json({ ok: true });
    setPortalSessionCookie(response, session, req);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
