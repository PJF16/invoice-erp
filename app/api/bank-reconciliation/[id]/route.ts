import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireModule, handleApiError } from "@/lib/api-helpers";
import { ignoreBankTransaction, reconcileBankTransaction, reopenBankTransaction } from "@/lib/bank-reconciliation";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("MATCH"), invoiceId: z.string().min(1), grantSkonto: z.boolean().default(false) }),
  z.object({ action: z.literal("IGNORE") }),
  z.object({ action: z.literal("REOPEN") }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireModule("INVOICES");
    const { id } = await params;
    const parsed = actionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    if (parsed.data.action === "MATCH") {
      await reconcileBankTransaction(id, parsed.data.invoiceId, session.user.id, parsed.data.grantSkonto);
    } else if (parsed.data.action === "IGNORE") {
      await ignoreBankTransaction(id);
    } else {
      await reopenBankTransaction(id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
