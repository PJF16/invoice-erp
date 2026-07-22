"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { eur, toDateInput, TAX_TREATMENT_OPTIONS } from "@/lib/format";

export type InvoiceFormData = {
  customers: { id: string; name: string; defaultTaxTreatment: string }[];
  softwareItems: { id: string; name: string; unitPrice: number; unit: string }[];
  hardwareItems: {
    id: string;
    name: string;
    stocks: { warehouseId: string; warehouseName: string; quantity: number }[];
  }[];
  warehouses: { id: string; name: string }[];
};

type LineType = "FREE" | "SOFTWARE" | "HARDWARE";

type Line = {
  key: number;
  type: LineType;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  softwareItemId: string;
  itemId: string;
  warehouseId: string;
  sourceMovementId: string;
};

export type InvoiceInitial = {
  id?: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  taxTreatment: string;
  notes: string | null;
  lines: Omit<Line, "key" | "type">[];
};

let keyCounter = 1;

function newLine(): Line {
  return {
    key: keyCounter++,
    type: "FREE",
    description: "",
    quantity: 1,
    unit: "Stk",
    unitPrice: 0,
    taxRate: 20,
    softwareItemId: "",
    itemId: "",
    warehouseId: "",
    sourceMovementId: "",
  };
}

export function InvoiceForm({ data, initial }: { data: InvoiceFormData; initial?: InvoiceInitial }) {
  const router = useRouter();
  const isEditing = Boolean(initial?.id);
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [taxTreatment, setTaxTreatment] = useState(initial?.taxTreatment ?? "STANDARD");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? toDateInput(new Date()));
  const [dueDate, setDueDate] = useState(
    initial?.dueDate ?? toDateInput(new Date(Date.now() + 14 * 86_400_000)),
  );
  const [periodStart, setPeriodStart] = useState(initial?.servicePeriodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(initial?.servicePeriodEnd ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial
      ? initial.lines.map((l) => ({
          ...l,
          key: keyCounter++,
          type: l.itemId ? "HARDWARE" : l.softwareItemId ? "SOFTWARE" : ("FREE" as LineType),
        }))
      : [newLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isStandard = taxTreatment === "STANDARD";
  const hasSourceMovements = lines.some((line) => Boolean(line.sourceMovementId));

  const totals = useMemo(() => {
    const net = lines.reduce((sum, l) => sum + Math.round(l.quantity * l.unitPrice * 100) / 100, 0);
    const tax = isStandard
      ? lines.reduce(
          (sum, l) => sum + (Math.round(l.quantity * l.unitPrice * 100) / 100) * (l.taxRate / 100),
          0,
        )
      : 0;
    return { net, tax: Math.round(tax * 100) / 100, gross: Math.round((net + tax) * 100) / 100 };
  }, [lines, isStandard]);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function selectCustomer(id: string) {
    setCustomerId(id);
    const customer = data.customers.find((c) => c.id === id);
    if (customer) setTaxTreatment(customer.defaultTaxTreatment);
  }

  function selectSoftware(key: number, softwareItemId: string) {
    const item = data.softwareItems.find((s) => s.id === softwareItemId);
    updateLine(key, {
      softwareItemId,
      description: item?.name ?? "",
      unitPrice: item?.unitPrice ?? 0,
      unit: item?.unit ?? "Stk",
    });
  }

  function selectHardware(key: number, itemId: string) {
    const item = data.hardwareItems.find((i) => i.id === itemId);
    updateLine(key, {
      itemId,
      description: item?.name ?? "",
      warehouseId: item?.stocks.find((s) => s.quantity > 0)?.warehouseId ?? data.warehouses[0]?.id ?? "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const body = {
      customerId,
      issueDate,
      dueDate,
      servicePeriodStart: periodStart || null,
      servicePeriodEnd: periodEnd || null,
      taxTreatment,
      notes: notes || null,
      lines: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        softwareItemId: l.type === "SOFTWARE" ? l.softwareItemId || null : null,
        itemId: l.type === "HARDWARE" ? l.itemId || null : null,
        warehouseId: l.type === "HARDWARE" ? l.warehouseId || null : null,
        sourceMovementId: l.sourceMovementId || null,
      })),
    };
    const res = await fetch(isEditing ? `/api/invoices/${initial!.id}` : "/api/invoices", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) {
      const invoice = await res.json();
      router.push(`/invoices/${invoice.id}`);
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
          <div className="lg:col-span-2">
            <label className={label}>Kunde *</label>
            <select required disabled={hasSourceMovements} value={customerId} onChange={(e) => selectCustomer(e.target.value)} className={`${input} mt-1 disabled:bg-gray-100 disabled:text-gray-500`}>
              <option value="">– Kunde wählen –</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {hasSourceMovements && <p className="mt-1 text-xs text-blue-700">Kunde ist durch die ausgewählten Lagerübergaben vorgegeben.</p>}
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
            {!isStandard && (
              <p className="mt-1 text-xs text-amber-700">
                Alle Positionen werden mit 0% USt gerechnet, die Rechnung erhält den gesetzlichen Hinweis.
              </p>
            )}
          </div>
          <div>
            <label className={label}>Rechnungsdatum *</label>
            <input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={`${input} mt-1`} />
          </div>
          <div>
            <label className={label}>Fällig am *</label>
            <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${input} mt-1`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Leistung von</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={`${input} mt-1`} />
            </div>
            <div>
              <label className={label}>bis</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={`${input} mt-1`} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Positionen</h2>
        <div className="space-y-4">
          {lines.map((line, idx) => {
            const hardwareItem = data.hardwareItems.find((i) => i.id === line.itemId);
            const stock = hardwareItem?.stocks.find((s) => s.warehouseId === line.warehouseId);
            return (
              <div key={line.key} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">Position {idx + 1}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={line.type}
                      disabled={Boolean(line.sourceMovementId)}
                      onChange={(e) =>
                        updateLine(line.key, {
                          type: e.target.value as LineType,
                          softwareItemId: "",
                          itemId: "",
                          warehouseId: "",
                        })
                      }
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="FREE">Freitext</option>
                      <option value="SOFTWARE">Softwareartikel</option>
                      <option value="HARDWARE">Hardware (Lager)</option>
                    </select>
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
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                  {line.type === "SOFTWARE" && (
                    <div className="lg:col-span-4">
                      <label className={label}>Softwareartikel</label>
                      <select
                        required
                        value={line.softwareItemId}
                        onChange={(e) => selectSoftware(line.key, e.target.value)}
                        className={`${input} mt-1`}
                      >
                        <option value="">– wählen –</option>
                        {data.softwareItems.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({eur.format(s.unitPrice)}/{s.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {line.type === "HARDWARE" && (
                    <>
                      <div className="lg:col-span-4">
                        <label className={label}>Hardware-Artikel</label>
                        <select
                          required
                          disabled={Boolean(line.sourceMovementId)}
                          value={line.itemId}
                          onChange={(e) => selectHardware(line.key, e.target.value)}
                          className={`${input} mt-1 disabled:bg-gray-100 disabled:text-gray-500`}
                        >
                          <option value="">– wählen –</option>
                          {data.hardwareItems.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="lg:col-span-3">
                        <label className={label}>Lager (Ausbuchung)</label>
                        <select
                          required
                          disabled={Boolean(line.sourceMovementId)}
                          value={line.warehouseId}
                          onChange={(e) => updateLine(line.key, { warehouseId: e.target.value })}
                          className={`${input} mt-1 disabled:bg-gray-100 disabled:text-gray-500`}
                        >
                          <option value="">– wählen –</option>
                          {data.warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                        {stock && (
                          <p className={`mt-1 text-xs ${stock.quantity < line.quantity ? "text-red-600" : "text-gray-500"}`}>
                            Bestand: {stock.quantity}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  <div className={line.type === "FREE" ? "lg:col-span-5" : line.type === "SOFTWARE" ? "lg:col-span-3" : "lg:col-span-5 lg:row-start-2"}>
                    <label className={label}>Bezeichnung *</label>
                    <input
                      required
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                      className={`${input} mt-1`}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className={label}>Menge *</label>
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      required
                      disabled={Boolean(line.sourceMovementId)}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                      className={`${input} mt-1 disabled:bg-gray-100 disabled:text-gray-500`}
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className={label}>Einheit</label>
                    <input
                      value={line.unit}
                      onChange={(e) => updateLine(line.key, { unit: e.target.value })}
                      className={`${input} mt-1`}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className={label}>Einzelpreis € *</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) })}
                      className={`${input} mt-1`}
                    />
                  </div>
                  <div className="lg:col-span-2">
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
                {line.sourceMovementId && (
                  <p className="mt-2 text-xs text-blue-700">
                    Bereits aus dem Lager gebucht – beim Finalisieren erfolgt keine zweite Ausbuchung.
                  </p>
                )}
                <p className="mt-2 text-right text-sm text-gray-500">
                  Netto: <span className="font-semibold text-gray-900">{eur.format(Math.round(line.quantity * line.unitPrice * 100) / 100)}</span>
                </p>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Notizen (erscheinen auf der Rechnung)</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${input} mt-1`} />
          </div>
          <div className="flex flex-col items-end justify-end gap-1 text-sm">
            <p>
              Netto: <span className="font-semibold tabular-nums">{eur.format(totals.net)}</span>
            </p>
            <p>
              USt: <span className="font-semibold tabular-nums">{eur.format(totals.tax)}</span>
            </p>
            <p className="text-lg">
              Brutto: <span className="font-bold tabular-nums">{eur.format(totals.gross)}</span>
            </p>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Speichere…" : "Als Entwurf speichern"}
        </button>
      </div>
    </form>
  );
}
