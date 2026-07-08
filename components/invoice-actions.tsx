"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  invoice: {
    id: string;
    status: string;
    number: string | null;
    customerEmail: string | null;
  };
};

export function InvoiceActions({ invoice }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function action(name: string, url: string, body?: unknown, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setError(null);
    setLoading(name);
    const res = await fetch(url, {
      method: body === "DELETE" ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body && body !== "DELETE" ? JSON.stringify(body) : undefined,
    });
    setLoading(null);
    if (res.ok) {
      if (body === "DELETE") {
        router.push("/invoices");
      }
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Aktion fehlgeschlagen");
    }
  }

  const btn = "rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50";
  const s = invoice.status;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          target="_blank"
          className={`${btn} border border-gray-300 hover:bg-gray-50`}
        >
          PDF {s === "DRAFT" ? "(Vorschau)" : ""}
        </a>

        {s === "DRAFT" && (
          <>
            <Link href={`/invoices/${invoice.id}/edit`} className={`${btn} border border-gray-300 hover:bg-gray-50`}>
              Bearbeiten
            </Link>
            <button
              disabled={loading !== null}
              onClick={() =>
                action(
                  "finalize",
                  `/api/invoices/${invoice.id}/finalize`,
                  {},
                  "Rechnung finalisieren? Die Rechnungsnummer wird vergeben und Hardware-Positionen werden aus dem Lager ausgebucht.",
                )
              }
              className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
            >
              {loading === "finalize" ? "Finalisiere…" : "Finalisieren"}
            </button>
            <button
              disabled={loading !== null}
              onClick={() => action("delete", `/api/invoices/${invoice.id}`, "DELETE", "Entwurf wirklich löschen?")}
              className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}
            >
              Löschen
            </button>
          </>
        )}

        {(s === "OPEN" || s === "SENT") && (
          <>
            <button
              disabled={loading !== null}
              onClick={() =>
                action(
                  "send",
                  `/api/invoices/${invoice.id}/send`,
                  {},
                  invoice.customerEmail
                    ? `Rechnung per E-Mail an ${invoice.customerEmail} senden?`
                    : undefined,
                )
              }
              className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
            >
              {loading === "send" ? "Sende…" : s === "SENT" ? "Erneut senden" : "Per E-Mail senden"}
            </button>
            <button
              disabled={loading !== null}
              onClick={() => action("paid", `/api/invoices/${invoice.id}/status`, { status: "PAID" })}
              className={`${btn} bg-green-600 text-white hover:bg-green-700`}
            >
              {loading === "paid" ? "…" : "Als bezahlt markieren"}
            </button>
          </>
        )}

        {s === "PAID" && (
          <button
            disabled={loading !== null}
            onClick={() => action("unpaid", `/api/invoices/${invoice.id}/status`, { status: "OPEN" })}
            className={`${btn} border border-gray-300 hover:bg-gray-50`}
          >
            Bezahlt-Status zurücksetzen
          </button>
        )}

        {s !== "DRAFT" && s !== "CANCELED" && (
          <button
            disabled={loading !== null}
            onClick={() =>
              action(
                "cancel",
                `/api/invoices/${invoice.id}/status`,
                { status: "CANCELED" },
                "Rechnung stornieren? Ausgebuchte Hardware wird ins Lager zurückgebucht.",
              )
            }
            className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}
          >
            {loading === "cancel" ? "Storniere…" : "Stornieren"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
