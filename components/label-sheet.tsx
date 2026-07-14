"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  name: string;
  sku: string | null;
  barcode: string;
  qrSvg: string;
  backHref: string;
};

export function LabelSheet({ name, sku, barcode, qrSvg, backHref }: Props) {
  const [count, setCount] = useState(1);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-900">
            ← Zurück zum Artikel
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Etikett drucken</h1>
          <p className="text-sm text-gray-500">{name}</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-sm">
            Anzahl
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="mt-1 block w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Drucken
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 print:gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex w-[45mm] flex-col items-center gap-1 rounded-lg border border-gray-200 p-3 text-center print:break-inside-avoid print:rounded-none print:border-black"
          >
            <div
              className="h-[28mm] w-[28mm] [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="w-full truncate text-xs font-semibold">{name}</p>
            {sku && <p className="text-[10px] text-gray-500">SKU: {sku}</p>}
            <p className="font-mono text-[10px]">{barcode}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
