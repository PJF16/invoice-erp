"use client";

import { useId, useMemo, useState } from "react";

export type CustomerSelectOption = {
  id: string;
  name: string;
  customerNumber?: string | null;
};

type Props = {
  customers: CustomerSelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (customerId: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  className?: string;
};

function customerLabel(customer: CustomerSelectOption) {
  return customer.customerNumber ? `${customer.customerNumber} · ${customer.name}` : customer.name;
}

export function CustomerSelect({
  customers,
  value,
  defaultValue = "",
  onValueChange,
  name,
  required = false,
  disabled = false,
  emptyLabel = "– Kunde wählen –",
  placeholder = "Name oder Kundennummer suchen…",
  className = "",
}: Props) {
  const listId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedId = value ?? internalValue;
  const selectedCustomer = customers.find((customer) => customer.id === selectedId);
  const [query, setQuery] = useState(() => selectedCustomer ? customerLabel(selectedCustomer) : "");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de");
    if (selectedCustomer && query === customerLabel(selectedCustomer)) return customers.slice(0, 25);
    return customers
      .filter((customer) => {
        if (!normalized) return true;
        return (
          customer.name.toLocaleLowerCase("de").includes(normalized) ||
          customer.customerNumber?.toLocaleLowerCase("de").includes(normalized)
        );
      })
      .slice(0, 25);
  }, [customers, query, selectedCustomer]);

  function select(customerId: string) {
    const customer = customers.find((entry) => entry.id === customerId);
    if (value === undefined) setInternalValue(customerId);
    onValueChange?.(customerId);
    setQuery(customer ? customerLabel(customer) : "");
    setOpen(false);
  }

  return (
    <div
      className={`relative ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery(selectedCustomer ? customerLabel(selectedCustomer) : "");
        }
      }}
    >
      {name && <input type="hidden" name={name} value={selectedId} />}
      <div className="relative">
        <input
          type="search"
          value={query}
          disabled={disabled}
          required={required}
          pattern={required && !selectedId ? "(?!)" : undefined}
          title={required && !selectedId ? "Bitte einen Kunden aus der Trefferliste auswählen" : undefined}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (selectedId) {
              if (value === undefined) setInternalValue("");
              onValueChange?.("");
            }
            setOpen(true);
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm disabled:bg-gray-100 disabled:text-gray-500"
        />
        {query && !disabled && (
          <button
            type="button"
            aria-label="Kundenauswahl löschen"
            onClick={() => select("")}
            className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        )}
      </div>
      {open && !disabled && (
        <div
          id={listId}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {!required && (
            <button
              type="button"
              onClick={() => select("")}
              className="block w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-blue-50"
            >
              {emptyLabel}
            </button>
          )}
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">Keine Kunden gefunden.</p>
          ) : (
            matches.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => select(customer.id)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                  customer.id === selectedId ? "bg-blue-50 text-blue-700" : ""
                }`}
              >
                <span className="font-medium">{customer.name}</span>
                {customer.customerNumber && (
                  <span className="ml-2 text-xs text-gray-500">Nr. {customer.customerNumber}</span>
                )}
              </button>
            ))
          )}
          {matches.length === 25 && (
            <p className="border-t border-gray-100 px-3 py-1.5 text-xs text-gray-400">
              Suche eingrenzen, um weitere Treffer zu sehen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
