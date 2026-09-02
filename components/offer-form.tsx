"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerSelect } from "@/components/customer-select";
import type { InvoiceFormData } from "@/components/invoice-form";
import { eur, TAX_TREATMENT_OPTIONS } from "@/lib/format";
import { assessTaxTreatment, SUPPLY_KIND_OPTIONS } from "@/lib/tax-rules";
import type { SupplyKind } from "@/lib/generated/prisma/enums";

type LineType = "FREE" | "SOFTWARE" | "HARDWARE";

type OfferLine = {
  key: number;
  type: LineType;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  supplyKind: SupplyKind;
  softwareItemId: string;
  itemId: string;
  warehouseId: string;
};

export type OfferInitial = {
  id?: string;
  customerId: string;
  issueDate: string;
  validUntil: string;
  deliveryDate: string | null;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  taxTreatment: string;
  notes: string | null;
  lines: Omit<OfferLine, "key" | "type">[];
};

let keyCounter = 1;

function newLine(): OfferLine {
  return {
    key: keyCounter++,
    type: "FREE",
    description: "",
    quantity: 1,
    unit: "Stk",
    unitPrice: 0,
    taxRate: 20,
    supplyKind: "SERVICE",
    softwareItemId: "",
    itemId: "",
    warehouseId: "",
  };
}

export function OfferForm({ data, initial }: { data: InvoiceFormData; initial: OfferInitial }) {
  const router = useRouter();
  const isEditing = Boolean(initial.id);
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [issueDate, setIssueDate] = useState(initial.issueDate);
  const [validUntil, setValidUntil] = useState(initial.validUntil);
  const [deliveryDate, setDeliveryDate] = useState(initial.deliveryDate ?? "");
  const [periodStart, setPeriodStart] = useState(initial.servicePeriodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(initial.servicePeriodEnd ?? "");
  const [taxTreatment, setTaxTreatment] = useState(initial.taxTreatment);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [lines, setLines] = useState<OfferLine[]>(
    initial.lines.length > 0
      ? initial.lines.map((line) => ({
          ...line,
          key: keyCounter++,
          type: line.itemId ? "HARDWARE" : line.softwareItemId ? "SOFTWARE" : "FREE",
        }))
      : [newLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isStandard = taxTreatment === "STANDARD";
  const selectedCustomer = data.customers.find((customer) => customer.id === customerId);
  const taxAssessment = selectedCustomer
    ? assessTaxTreatment({
        customerType: selectedCustomer.customerType,
        countryCode: selectedCustomer.countryCode,
        uid: selectedCustomer.uid,
        supplyKinds: lines.map((line) => line.supplyKind),
      })
    : null;

  const totals = useMemo(() => {
    const net = lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice * 100) / 100, 0);
    const tax = isStandard
      ? lines.reduce(
          (sum, line) => sum + (Math.round(line.quantity * line.unitPrice * 100) / 100) * (line.taxRate / 100),
          0,
        )
      : 0;
    return {
      net: Math.round(net * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      gross: Math.round((net + tax) * 100) / 100,
    };
  }, [isStandard, lines]);

  function updateLine(key: number, patch: Partial<OfferLine>) {
    const nextLines = lines.map((line) => line.key === key ? { ...line, ...patch } : line);
    setLines(nextLines);
    if (selectedCustomer) {
      const assessment = assessTaxTreatment({
        customerType: selectedCustomer.customerType,
        countryCode: selectedCustomer.countryCode,
        uid: selectedCustomer.uid,
        supplyKinds: nextLines.map((line) => line.supplyKind),
      });
      if (assessment.expectedTreatment) setTaxTreatment(assessment.expectedTreatment);
    }
  }

  function selectCustomer(id: string) {
    setCustomerId(id);
    const customer = data.customers.find((entry) => entry.id === id);
    if (customer) {
      const assessment = assessTaxTreatment({
        customerType: customer.customerType,
        countryCode: customer.countryCode,
        uid: customer.uid,
        supplyKinds: lines.map((line) => line.supplyKind),
      });
      setTaxTreatment(assessment.expectedTreatment ?? customer.defaultTaxTreatment);
    }
  }

  function selectSoftware(key: number, id: string) {
    const item = data.softwareItems.find((entry) => entry.id === id);
    updateLine(key, {
      softwareItemId: id,
      description: [item?.name, item?.description].filter(Boolean).join("\n"),
      unitPrice: item?.unitPrice ?? 0,
      unit: item?.unit ?? "Stk",
      supplyKind: item?.supplyKind ?? "ELECTRONIC_SERVICE",
      itemId: "",
      warehouseId: "",
    });
  }

  function selectHardware(key: number, id: string) {
    const item = data.hardwareItems.find((entry) => entry.id === id);
    updateLine(key, {
      itemId: id,
      description: [item?.name, item?.description].filter(Boolean).join("\n"),
      softwareItemId: "",
      warehouseId: item?.stocks.find((stock) => stock.quantity > 0)?.warehouseId ?? "",
      unit: "Stk",
      supplyKind: item?.supplyKind ?? "GOODS",
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const response = await fetch(isEditing ? `/api/offers/${initial.id}` : "/api/offers", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        issueDate,
        validUntil,
        deliveryDate: deliveryDate || null,
        servicePeriodStart: periodStart || null,
        servicePeriodEnd: periodEnd || null,
        taxTreatment,
        notes: notes || null,
        lines: lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          supplyKind: line.supplyKind,
          softwareItemId: line.type === "SOFTWARE" ? line.softwareItemId || null : null,
          itemId: line.type === "HARDWARE" ? line.itemId || null : null,
          warehouseId: line.type === "HARDWARE" ? line.warehouseId || null : null,
        })),
      }),
    });
    setLoading(false);
    if (response.ok) {
      const offer = await response.json();
      router.push(`/offers/${offer.id}`);
      router.refresh();
      return;
    }
    const body = await response.json().catch(() => null);
    setError(body?.error ?? "Speichern fehlgeschlagen");
  }

  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={label}>Kunde *</label>
            <CustomerSelect
              customers={data.customers}
              value={customerId}
              onValueChange={selectCustomer}
              required
              className="mt-1"
            />
          </div>
          {taxAssessment && (
            <div className="sm:col-span-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
              <span className="font-semibold">Steuerprüfung:</span> {taxAssessment.reason}
              {taxAssessment.warnings.map((warning) => <div key={warning} className="mt-1 text-amber-800">⚠ {warning}</div>)}
            </div>
          )}
          <div>
            <label className={label}>Voraussichtliches Lieferdatum</label>
            <input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className={`${input} mt-1`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Leistung von</label>
              <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className={`${input} mt-1`} />
            </div>
            <div>
              <label className={label}>bis</label>
              <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className={`${input} mt-1`} />
            </div>
          </div>
          <div>
            <label className={label}>Angebotsdatum *</label>
            <input type="date" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className={`${input} mt-1`} />
          </div>
          <div>
            <label className={label}>Gültig bis *</label>
            <input type="date" required min={issueDate} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className={`${input} mt-1`} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Steuerbehandlung</label>
            <select value={taxTreatment} onChange={(event) => setTaxTreatment(event.target.value)} className={`${input} mt-1`}>
              {TAX_TREATMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Positionen</h2>
          <p className="text-xs text-gray-500">Hardware wird erst beim Finalisieren der späteren Rechnung ausgebucht.</p>
        </div>
        <div className="space-y-4">
          {lines.map((line, index) => {
            const hardwareItem = data.hardwareItems.find((item) => item.id === line.itemId);
            const stock = hardwareItem?.stocks.find((entry) => entry.warehouseId === line.warehouseId);
            return (
              <div key={line.key} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-gray-400">Position {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={line.type}
                      onChange={(event) => updateLine(line.key, {
                        type: event.target.value as LineType,
                        softwareItemId: "",
                        itemId: "",
                        warehouseId: "",
                        supplyKind: event.target.value === "HARDWARE" ? "GOODS" : event.target.value === "SOFTWARE" ? "ELECTRONIC_SERVICE" : "SERVICE",
                      })}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="FREE">Freitext</option>
                      <option value="SOFTWARE">Softwareartikel</option>
                      <option value="HARDWARE">Hardware</option>
                    </select>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                        Entfernen
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-12">
                  {line.type === "SOFTWARE" && (
                    <div className="lg:col-span-4">
                      <label className={label}>Softwareartikel</label>
                      <select required value={line.softwareItemId} onChange={(event) => selectSoftware(line.key, event.target.value)} className={`${input} mt-1`}>
                        <option value="">– wählen –</option>
                        {data.softwareItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({eur.format(item.unitPrice)}/{item.unit})</option>)}
                      </select>
                    </div>
                  )}
                  {line.type === "HARDWARE" && (
                    <>
                      <div className="lg:col-span-4">
                        <label className={label}>Hardware-Artikel</label>
                        <select required value={line.itemId} onChange={(event) => selectHardware(line.key, event.target.value)} className={`${input} mt-1`}>
                          <option value="">– wählen –</option>
                          {data.hardwareItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </div>
                      <div className="lg:col-span-3">
                        <label className={label}>Lager für spätere Ausbuchung</label>
                        <select required value={line.warehouseId} onChange={(event) => updateLine(line.key, { warehouseId: event.target.value })} className={`${input} mt-1`}>
                          <option value="">– wählen –</option>
                          {data.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                        </select>
                        {stock && <p className={`mt-1 text-xs ${stock.quantity < line.quantity ? "text-amber-700" : "text-gray-500"}`}>Aktueller Bestand: {stock.quantity}</p>}
                      </div>
                    </>
                  )}
                  <div className={line.type === "FREE" ? "lg:col-span-5" : line.type === "SOFTWARE" ? "lg:col-span-3" : "lg:col-span-5 lg:row-start-2"}>
                    <label className={label}>Bezeichnung *</label>
                    <textarea required rows={2} value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} className={`${input} mt-1`} />
                  </div>
                  <div className="lg:col-span-2">
                    <label className={label}>Menge *</label>
                    <input type="number" min={line.type === "HARDWARE" ? 1 : 0.01} step={line.type === "HARDWARE" ? 1 : 0.01} required value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })} className={`${input} mt-1`} />
                  </div>
                  <div className="lg:col-span-1">
                    <label className={label}>Einheit</label>
                    <input required value={line.unit} onChange={(event) => updateLine(line.key, { unit: event.target.value })} className={`${input} mt-1`} />
                  </div>
                  <div className="lg:col-span-2">
                    <label className={label}>Einzelpreis € *</label>
                    <input type="number" min={0} step="0.01" required value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: Number(event.target.value) })} className={`${input} mt-1`} />
                  </div>
                  <div className="lg:col-span-2">
                    <label className={label}>Leistungsart</label>
                    {line.type === "FREE" ? (
                      <select value={line.supplyKind} onChange={(event) => updateLine(line.key, { supplyKind: event.target.value as SupplyKind })} className={`${input} mt-1`}>
                        {SUPPLY_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                      <div className={`${input} mt-1 bg-gray-100 text-gray-600`}>{SUPPLY_KIND_OPTIONS.find((option) => option.value === line.supplyKind)?.label}</div>
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    <label className={label}>USt</label>
                    {isStandard ? (
                      <select value={line.taxRate} onChange={(event) => updateLine(line.key, { taxRate: Number(event.target.value) })} className={`${input} mt-1`}>
                        <option value={20}>20%</option><option value={13}>13%</option><option value={10}>10%</option><option value={0}>0%</option>
                      </select>
                    ) : (
                      <div className={`${input} mt-1 bg-gray-100 text-gray-500`}>–</div>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-right text-sm text-gray-500">Netto: <span className="font-semibold text-gray-900">{eur.format(Math.round(line.quantity * line.unitPrice * 100) / 100)}</span></p>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setLines((current) => [...current, newLine()])} className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">+ Position hinzufügen</button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Hinweise und Bedingungen</label>
            <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${input} mt-1`} />
          </div>
          <div className="flex flex-col items-end justify-end gap-1 text-sm">
            <p>Netto: <span className="font-semibold tabular-nums">{eur.format(totals.net)}</span></p>
            <p>USt: <span className="font-semibold tabular-nums">{eur.format(totals.tax)}</span></p>
            <p className="text-lg">Brutto: <span className="font-bold tabular-nums">{eur.format(totals.gross)}</span></p>
          </div>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Abbrechen</button>
        <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{loading ? "Speichere…" : "Als Entwurf speichern"}</button>
      </div>
    </form>
  );
}
