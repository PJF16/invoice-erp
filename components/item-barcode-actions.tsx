"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateInternalBarcode } from "@/lib/barcode";

export function ItemBarcodeActions({ itemId, barcode }: { itemId: string; barcode: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: generateInternalBarcode() }),
    });
    setLoading(false);
    if (res.ok) router.refresh();
    else alert("Barcode konnte nicht generiert werden");
  }

  if (!barcode) {
    return (
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? "Generiere…" : "Barcode generieren"}
      </button>
    );
  }

  return (
    <Link
      href={`/items/${itemId}/label`}
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
    >
      Etikett drucken
    </Link>
  );
}
