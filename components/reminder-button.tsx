"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReminderButton({
  invoiceId,
  number,
  customerEmail,
  smtpConfigured,
}: {
  invoiceId: string;
  number: string;
  customerEmail: string | null;
  smtpConfigured: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const disabled = !smtpConfigured || !customerEmail;
  const title = !customerEmail
    ? "Kunde hat keine E-Mail-Adresse"
    : !smtpConfigured
      ? "SMTP nicht konfiguriert"
      : undefined;

  async function remind() {
    if (!confirm(`Zahlungserinnerung zu ${number} an ${customerEmail} senden?`)) return;
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoiceId}/remind`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Versand fehlgeschlagen");
    }
  }

  return (
    <button
      onClick={remind}
      disabled={disabled || loading}
      title={title}
      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Sende…" : "Erinnerung senden"}
    </button>
  );
}
