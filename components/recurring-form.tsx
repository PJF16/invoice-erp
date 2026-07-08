"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eur, toDateInput, TAX_TREATMENT_OPTIONS } from "@/lib/format";

type FormData = {
  customers: { id: string; name: string; defaultTaxTreatment: string; email: string | null }[];
  softwareItems: { id: string; name: string; unitPrice: number; unit: string }[];
};

type Line = {
  key: number;
  softwareItemId: string;
  description: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  taxRate: number;
};

export type RecurringInitial = {
  id: string;
  name: string;
  customerId: string;
  interval: string;
  nextRun: string;
  active: boolean;
  autoSend: boolean;
  taxTreatment: string;
  notes: string | null;
  lines: Omit<Line, "key">[];
};

let keyCounter = 1;

const newLine = (): Line => ({
  key: keyCounter++,
  softwareItemId: "",
  description: "",
  unitPrice: 0,
  quantity: 1,
  unit: "Stk",
  taxRate: 20,
});

export function RecurringForm({ data, initial }: { data: FormData; initial?: RecurringInitial }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [interval, setInterval] = useState(initial?.interval ?? "MONTHLY");
  const [nextRun, setNextRun] = useState(initial?.nextRun ?? toDateInput(new Date()));
  const [active, setActive] = useState(initial?.active ?? true);
  const [autoSend, setAutoSend] = useState(initial?.autoSend ?? true);
  const [taxTreatment, setTaxTreatment] = useState(initial?.taxTreatment ?? "STANDARD");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial ? initial.lines.map((l) => ({ ...l, key: keyCounter++ })) : [newLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedCustomer = data.customers.find((c) => c.id === customerId);
  const isStandard = taxTreatment === "STANDARD";

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const body = {
      name,
      customerId,
      interval,
      nextRun,
      active,
      autoSend,
      taxTreatment,
      notes: notes || null,
      lines: lines.map((l) => ({
        softwareItemId: l.softwareItemId || null,
        description: l.softwareItemId ? l.description || null : l.description,
        unitPrice: l.softwareItemId ? null : l.unitPrice,
        quantity: l.quantity,
        unit: l.unit,
        taxRate: l.taxRate,
      })),
    };
    const res = await fetch(
      initial ? `/api/recurring-invoices/${initial.id}` : "/api/recurring-invoices",
      {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setLoading(false);
    if (res.ok) {
      router.push("/recurring");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Speichern fehlgeschlagen");
    }
  }

  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={label}>Name der Vorlage *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Wartungsvertrag Müller GmbH" className={`${input} mt-1`} />
          </div>
          <div>
            <label className={label}>Kunde *</label>
            <select
              required
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                const c = data.customers.find((x) => x.id === e.target.value);
                if (c) setTaxTreatment(c.defaultTaxTreatment);
              }}
              className={`${input} mt-1`}
            >
              <option value="">– Kunde wählen –</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Steuerbehandlung</label>
            <select value={taxTreatment} onChange={(e) => setTaxTreatment(e.target.value)} className={`${input} mt-1`}>
              {TAX_TREATMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Intervall</label>
            <select value={interval} onChange={(e) => setInterval(e.target.value)} className={`${input} mt-1`}>
              <option value="MONTHLY">Monatlich</option>
              <option value="QUARTERLY">Quartalsweise</option>
              <option value="YEARLY">Jährlich</option>
            </select>
          </div>
          <div>
            <label className={label}>Nächste Ausführung *</label>
            <input type="date" required value={nextRun} onChange={(e) => setNextRun(e.target.value)} className={`${input} mt-1`} />
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Aktiv
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
              Automatisch per E-Mail versenden
            </label>
            {autoSend && selectedCustomer && !selectedCustomer.email && (
              <p className="text-xs text-red-600">Dieser Kunde hat keine E-Mail-Adresse!</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold">Positionen</h2>
        <p className="mb-4 text-xs text-gray-500">
          Softwareartikel-Positionen übernehmen Preis und Bezeichnung bei jeder Erzeugung automatisch vom
          Artikel — Preisänderungen wirken so auf alle künftigen Rechnungen.
        </p>
        <div className="space-y-4">
          {lines.map((line, idx) => {
            const software = data.softwareItems.find((s) => s.id === line.softwareItemId);
            return (
              <div key={line.key} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">Position {idx + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Entfernen
                    </button>
                  )}
                </div>
                <div className="grid gap-3 lg:grid-cols-12">
                  <div className="lg:col-span-4">
                    <label className={label}>Softwareartikel (optional)</label>
                    <select
                      value={line.softwareItemId}
                      onChange={(e) => {
                        const s = data.softwareItems.find((x) => x.id === e.target.value);
                        updateLine(line.key, {
                          softwareItemId: e.target.value,
                          unit: s?.unit ?? line.unit,
                        });
                      }}
                      className={`${input} mt-1`}
                    >
                      <option value="">– Freitext-Position –</option>
                      {data.softwareItems.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (aktuell {eur.format(s.unitPrice)}/{s.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-4">
                    <label className={label}>
                      Bezeichnung {line.softwareItemId ? "(leer = Artikelname)" : "*"}
                    </label>
                    <input
                      required={!line.softwareItemId}
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                      className={`${input} mt-1`}
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className={label}>Menge *</label>
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      required
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                      className={`${input} mt-1`}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className={label}>Preis € {line.softwareItemId ? "" : "*"}</label>
                    {line.softwareItemId ? (
                      <p className="mt-2.5 text-sm text-gray-500">
                        {software ? `${eur.format(software.unitPrice)} (vom Artikel)` : "–"}
                      </p>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) })}
                        className={`${input} mt-1`}
                      />
                    )}
                  </div>
                  <div className="lg:col-span-1">
                    <label className={label}>USt</label>
                    <select
                      value={line.taxRate}
                      disabled={!isStandard}
                      onChange={(e) => updateLine(line.key, { taxRate: Number(e.target.value) })}
                      className={`${input} mt-1 disabled:bg-gray-100 disabled:text-gray-400`}
                    >
                      <option value={20}>20%</option>
                      <option value={13}>13%</option>
                      <option value={10}>10%</option>
                      <option value={0}>0%</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, newLine()])}
          className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          + Position hinzufügen
        </button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className={label}>Notizen (erscheinen auf jeder erzeugten Rechnung)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${input} mt-1`} />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Speichere…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}
