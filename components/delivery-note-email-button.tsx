"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  deliveryNoteId: string;
  customerEmail: string | null;
  previouslySent: boolean;
};

export function DeliveryNoteEmailButton({ deliveryNoteId, customerEmail, previouslySent }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!customerEmail || !confirm(`Lieferschein per E-Mail an ${customerEmail} senden?`)) return;
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/delivery-notes/${deliveryNoteId}/send`, { method: "POST" });
    setLoading(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Lieferschein konnte nicht versendet werden");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading || !customerEmail}
        title={customerEmail ? undefined : "Kunde hat keine E-Mail-Adresse"}
        onClick={send}
        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Sende…" : previouslySent ? "Erneut senden" : "Per E-Mail senden"}
      </button>
      {error && <p className="max-w-72 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
