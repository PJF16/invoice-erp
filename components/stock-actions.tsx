"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  itemId: string;
  itemName: string;
  warehouses: { id: string; name: string }[];
  customers: { id: string; name: string; customerNumber: string | null }[];
  defaultWarehouseId?: string;
};

export function StockActions({ itemId, itemName, warehouses, customers, defaultWarehouseId }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"IN" | "OUT" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);

  const matchingCustomers = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase("de");
    return customers
      .filter(
        (customer) =>
          !query ||
          customer.name.toLocaleLowerCase("de").includes(query) ||
          customer.customerNumber?.toLocaleLowerCase("de").includes(query),
      )
      .slice(0, 10);
  }, [customerQuery, customers]);

  useEffect(() => {
    if (mode !== "IN") return;
    fetch("/api/suppliers")
      .then((r) => (r.ok ? r.json() : []))
      .then(setSuppliers)
      .catch(() => {});
  }, [mode]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (mode === "OUT" && customerQuery.trim() && !selectedCustomerId) {
      setError("Bitte einen Kunden aus der Trefferliste auswählen oder das Suchfeld leeren");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        warehouseId: form.get("warehouseId"),
        type: mode,
        quantity: Number(form.get("quantity")),
        customerId: mode === "OUT" ? selectedCustomerId || null : null,
        supplier: (form.get("supplier") as string) || null,
        note: (form.get("note") as string) || null,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setMode(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Buchung fehlgeschlagen");
    }
  }

  return (
    <>
      <div className="inline-flex gap-1">
        <button
          onClick={() => setMode("IN")}
          className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
          title="Einbuchen"
        >
          + Ein
        </button>
        <button
          onClick={() => {
            setCustomerQuery("");
            setSelectedCustomerId("");
            setCustomerSearchOpen(false);
            setMode("OUT");
          }}
          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
          title="Ausbuchen"
        >
          – Aus
        </button>
      </div>

      {mode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setMode(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">
              {mode === "IN" ? "Einbuchen" : "Ausbuchen"}: {itemName}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Lager</label>
                <select
                  name="warehouseId"
                  defaultValue={defaultWarehouseId ?? warehouses[0]?.id}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Menge</label>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={1}
                  required
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {mode === "IN" && (
                <div>
                  <label className="block text-sm font-medium">Lieferant (optional)</label>
                  <input
                    name="supplier"
                    type="text"
                    list="supplier-suggestions"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <datalist id="supplier-suggestions">
                    {suppliers.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              )}
              {mode === "OUT" && (
                <div
                  className="relative"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setCustomerSearchOpen(false);
                    }
                  }}
                >
                  <label className="block text-sm font-medium">Kunde (optional)</label>
                  <div className="relative mt-1">
                    <input
                      type="search"
                      value={customerQuery}
                      placeholder="Name oder Kundennummer suchen…"
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={customerSearchOpen}
                      aria-controls={`customer-results-${itemId}`}
                      onFocus={() => setCustomerSearchOpen(true)}
                      onChange={(event) => {
                        setCustomerQuery(event.target.value);
                        setSelectedCustomerId("");
                        setCustomerSearchOpen(true);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm"
                    />
                    {customerQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerQuery("");
                          setSelectedCustomerId("");
                          setCustomerSearchOpen(true);
                        }}
                        aria-label="Kundenauswahl löschen"
                        className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <input type="hidden" name="customerId" value={selectedCustomerId} />
                  {customerSearchOpen && (
                    <div
                      id={`customer-results-${itemId}`}
                      className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                    >
                      {matchingCustomers.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-gray-500">Keine Kunden gefunden.</p>
                      ) : (
                        matchingCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(customer.id);
                              setCustomerQuery(
                                `${customer.customerNumber ? `${customer.customerNumber} · ` : ""}${customer.name}`,
                              );
                              setCustomerSearchOpen(false);
                            }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                          >
                            <span className="font-medium">{customer.name}</span>
                            {customer.customerNumber && (
                              <span className="ml-2 text-xs text-gray-500">
                                Nr. {customer.customerNumber}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                      {matchingCustomers.length === 10 && (
                        <p className="border-t border-gray-100 px-3 py-1.5 text-xs text-gray-400">
                          Suche eingrenzen, um weitere Treffer zu sehen.
                        </p>
                      )}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Mit Kunde erscheint der Ausgang als ausstehende Übergabe.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium">Notiz (optional)</label>
                <input
                  name="note"
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                    mode === "IN" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {loading ? "Buche…" : mode === "IN" ? "Einbuchen" : "Ausbuchen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
