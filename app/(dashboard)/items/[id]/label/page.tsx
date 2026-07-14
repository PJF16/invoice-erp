import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { LabelSheet } from "@/components/label-sheet";

export const dynamic = "force-dynamic";

export default async function ItemLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    select: { name: true, sku: true, barcode: true },
  });
  if (!item) notFound();

  if (!item.barcode) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-gray-600">Für diesen Artikel wurde noch kein Barcode generiert.</p>
        <Link href={`/items/${id}`} className="mt-4 inline-block text-sm text-blue-700 hover:underline">
          ← Zurück zum Artikel
        </Link>
      </div>
    );
  }

  const qrSvg = await QRCode.toString(item.barcode, { type: "svg", margin: 0 });

  return (
    <LabelSheet
      name={item.name}
      sku={item.sku}
      barcode={item.barcode}
      qrSvg={qrSvg}
      backHref={`/items/${id}`}
    />
  );
}
