"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function OfferActions({ offer }: { offer: { id: string; status: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function action(name: string, url: string, body?: unknown, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setLoading(name);
    setError(null);
    const response = await fetch(url, {
      method: body === "DELETE" ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body && body !== "DELETE" ? JSON.stringify(body) : undefined,
    });
    setLoading(null);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Aktion fehlgeschlagen");
      return;
    }
    if (body === "DELETE") {
      router.push("/offers");
      return;
    }
    if (name === "convert") {
      const invoice = await response.json();
      router.push(`/invoices/${invoice.id}`);
      return;
    }
    router.refresh();
  }

  const button = "rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50";
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <a href={`/api/offers/${offer.id}/pdf`} target="_blank" className={`${button} border border-gray-300 hover:bg-gray-50`}>
          PDF {offer.status === "DRAFT" ? "(Vorschau)" : ""}
        </a>
        {offer.status === "DRAFT" && (
          <>
            <Link href={`/offers/${offer.id}/edit`} className={`${button} border border-gray-300 hover:bg-gray-50`}>Bearbeiten</Link>
            <button disabled={loading !== null} onClick={() => action("finalize", `/api/offers/${offer.id}/finalize`, {}, "Angebot finalisieren? Dabei wird die Angebotsnummer verbindlich vergeben.")} className={`${button} bg-blue-600 text-white hover:bg-blue-700`}>
              {loading === "finalize" ? "Finalisiere…" : "Finalisieren"}
            </button>
            <button disabled={loading !== null} onClick={() => action("delete", `/api/offers/${offer.id}`, "DELETE", "Angebotsentwurf wirklich löschen?")} className={`${button} border border-red-200 text-red-600 hover:bg-red-50`}>Löschen</button>
          </>
        )}
        {offer.status === "OPEN" && (
          <>
            <button disabled={loading !== null} onClick={() => action("accept", `/api/offers/${offer.id}/status`, { status: "ACCEPTED" })} className={`${button} bg-green-600 text-white hover:bg-green-700`}>{loading === "accept" ? "…" : "Als angenommen markieren"}</button>
            <button disabled={loading !== null} onClick={() => action("reject", `/api/offers/${offer.id}/status`, { status: "REJECTED" })} className={`${button} border border-red-200 text-red-600 hover:bg-red-50`}>{loading === "reject" ? "…" : "Als abgelehnt markieren"}</button>
          </>
        )}
        {(offer.status === "ACCEPTED" || offer.status === "REJECTED") && (
          <button disabled={loading !== null} onClick={() => action("reopen", `/api/offers/${offer.id}/status`, { status: "OPEN" })} className={`${button} border border-gray-300 hover:bg-gray-50`}>Status zurück auf offen</button>
        )}
        {offer.status === "ACCEPTED" && (
          <button disabled={loading !== null} onClick={() => action("convert", `/api/offers/${offer.id}/convert`, {}, "Aus diesem Angebot einen Rechnungsentwurf erstellen? Hardware wird erst beim Finalisieren der Rechnung ausgebucht.")} className={`${button} bg-violet-600 text-white hover:bg-violet-700`}>
            {loading === "convert" ? "Erstelle Rechnung…" : "Rechnung erstellen"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
