"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function RecurringRowActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function runNow() {
    if (!confirm(`Jetzt eine Rechnung aus „${name}" erzeugen?`)) return;
    setLoading(true);
    const res = await fetch(`/api/recurring-invoices/${id}/run`, { method: "POST" });
    setLoading(false);
    const data = await res.json().catch(() => null);
    if (res.ok) {
      const emailInfo = data.emailSent
        ? " und per E-Mail versendet"
        : data.emailError
          ? ` (E-Mail nicht versendet: ${data.emailError})`
          : "";
      alert(`Rechnung ${data.number} wurde erzeugt${emailInfo}.`);
      router.push(`/invoices/${data.invoiceId}`);
    } else {
      alert(data?.error ?? "Ausführung fehlgeschlagen");
    }
  }

  async function handleDelete() {
    if (!confirm(`Vorlage „${name}" löschen? Bereits erzeugte Rechnungen bleiben erhalten.`)) return;
    const res = await fetch(`/api/recurring-invoices/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("Löschen fehlgeschlagen");
  }

  return (
    <div className="inline-flex gap-1">
      <button
        onClick={runNow}
        disabled={loading}
        className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        {loading ? "Läuft…" : "Jetzt ausführen"}
      </button>
      <Link href={`/recurring/${id}/edit`} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100">
        Bearbeiten
      </Link>
      <button onClick={handleDelete} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
        Löschen
      </button>
    </div>
  );
}
