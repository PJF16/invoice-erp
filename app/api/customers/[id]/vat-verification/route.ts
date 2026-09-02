import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handleApiError, requireModule } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { checkVatId } from "@/lib/vat-id";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModule("INVOICES");
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, uid: true, countryCode: true },
    });
    if (!customer) throw new ApiError(404, "Kunde nicht gefunden");
    if (!customer.uid) throw new ApiError(400, "Beim Kunden ist keine UID hinterlegt");

    const result = await checkVatId(customer.uid, customer.countryCode);
    const verification = await prisma.vatVerification.create({
      data: {
        customerId: customer.id,
        countryCode: result.countryCode,
        vatNumber: result.vatNumber,
        status: result.status,
        requestDate: result.requestDate,
        name: result.name,
        address: result.address,
        requestId: result.requestId,
        errorMessage: result.errorMessage,
      },
    });
    return NextResponse.json(verification);
  } catch (error) {
    return handleApiError(error);
  }
}

