"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eur, formatDate, toDateInput, PAYMENT_METHOD_LABELS } from "@/lib/format";

type Payment = {
  id: string;
  amount: number;
  date: string;
  method: string;
  reference: string | null;
  note: string | null;
};

type Props = {
  invoiceId: string;
  grossTotal: number;
  paidTotal: number;
  skontoGranted: number;
  skontoPercent: number;
  skontoDeadline: string | null;
  status: string;
  payments: Payment[];
};

const METHODS = Object.entries(PAYMENT_METHOD_LABELS);

export function InvoicePayments({
  invoiceId,
  grossTotal,
  paidTotal,
  skontoGranted,
  skontoPercent,
  skontoDeadline,
  status,
  payments,
}: Props) {
  const router = useRouter();
  const open = Math.round((grossTotal - paidTotal - skontoGranted) * 100) / 100;
  const skontoActive = skontoPercent > 0;
  const skontoAmount = Math.round(grossTotal * skontoPercent) / 100;
  const withinSkonto =
    skontoActive && skontoGranted === 0 && skontoDeadline !== null && new Date(skontoDeadline) >= new Date();

  const [amount, setAmount] = useState(open > 0 ? open.toFixed(2) : "");
  const [date, setDate] = useState(toDateInput(new Date()));
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [grantSkonto, setGrantSkonto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRecord = status !== "PAID" || open > 0;

  async function record(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(amount.replace(",", "."));
    if (!(value > 0)) {
      setError("Betrag muss größer als 0 sein");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: value,
        date,
        method,
        reference: reference || null,
        note: note || null,
        grantSkonto,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setReference("");
      setNote("");
      setGrantSkonto(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Zahlung konnte nicht erfasst werden");
    }
  }

  async function remove(id: string) {
    if (!confirm("Zahlung wirklich löschen?")) return;
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/invoices/${invoiceId}/payments/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Zahlung konnte nicht gelöscht werden");
    }
  }

  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "block text-xs font-medium text-gray-600";

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold">Zahlungen</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Bereits bezahlt</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{eur.format(paidTotal)}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Gewährtes Skonto</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{eur.format(skontoGranted)}</p>
        </div>
        <div className={`rounded-lg border p-3 ${open > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
          <p className="text-xs text-gray-500">Offener Restbetrag</p>
          <p className={`mt-0.5 text-lg font-semibold tabular-nums ${open > 0 ? "text-amber-700" : "text-green-700"}`}>
            {eur.format(open)}
          </p>
        </div>
      </div>

      {skontoActive && open > 0 && (
        <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
          Skonto: {skontoPercent}% ({eur.format(skontoAmount)})
          {skontoDeadline && <> bei Zahlung bis {formatDate(skontoDeadline)}</>} — Zahlbetrag mit Skonto{" "}
          <span className="font-semibold">{eur.format(Math.round((grossTotal - skontoAmount) * 100) / 100)}</span>
          {!withinSkonto && skontoGranted === 0 && <> (Skontofrist abgelaufen)</>}
        </p>
      )}

      {payments.length > 0 && (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2">Datum</th>
              <th className="py-2">Art</th>
              <th className="py-2">Referenz</th>
              <th className="py-2 text-right">Betrag</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 text-gray-500">{formatDate(p.date)}</td>
                <td className="py-2">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</td>
                <td className="py-2 text-gray-500">
                  {p.reference}
                  {p.note && <span className="block text-xs text-gray-400">{p.note}</span>}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">{eur.format(p.amount)}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => remove(p.id)}
                    disabled={busyId === p.id}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    {busyId === p.id ? "…" : "Löschen"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canRecord ? (
        <form onSubmit={record} className="mt-5 border-t border-gray-100 pt-4">
          <p className="mb-3 text-xs font-semibold text-gray-600">Zahlung erfassen</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className={label}>Betrag (€)</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder={open > 0 ? open.toFixed(2) : "0,00"}
                className={`${input} tabular-nums`}
              />
            </div>
            <div>
              <label className={label}>Datum</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Zahlungsart</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
                {METHODS.map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Referenz</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="z.B. Buchungstext"
                className={input}
              />
            </div>
            <div className="sm:col-span-4">
              <label className={label}>Notiz</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={input} />
            </div>
          </div>

          {withinSkonto && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={grantSkonto}
                onChange={(e) => {
                  const on = e.target.checked;
                  setGrantSkonto(on);
                  const rest = Math.round((grossTotal - paidTotal - (on ? skontoAmount : 0)) * 100) / 100;
                  setAmount(rest > 0 ? rest.toFixed(2) : "0.00");
                }}
              />
              Skonto gewähren ({skontoPercent}% = {eur.format(skontoAmount)})
            </label>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Speichere…" : "Zahlung erfassen"}
            </button>
          </div>
        </form>
      ) : (
        error && <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </section>
  );
}
