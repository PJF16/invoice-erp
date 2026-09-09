"use client";

import { useId, useMemo, useState } from "react";

export type ItemSelectOption = {
  id: string;
  name: string;
  sku?: string | null;
};

type Props = {
  items: ItemSelectOption[];
  value: string;
  onValueChange: (itemId: string) => void;
  required?: boolean;
  className?: string;
};

function itemLabel(item: ItemSelectOption) {
  return item.sku ? `${item.sku} · ${item.name}` : item.name;
}

export function ItemSelect({ items, value, onValueChange, required = false, className = "" }: Props) {
  const listId = useId();
  const selectedItem = items.find((item) => item.id === value);
  const [query, setQuery] = useState(() => selectedItem ? itemLabel(selectedItem) : "");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de");
    if (selectedItem && query === itemLabel(selectedItem)) return items.slice(0, 25);
    return items
      .filter((item) => {
        if (!normalized) return true;
        return (
          item.name.toLocaleLowerCase("de").includes(normalized) ||
          item.sku?.toLocaleLowerCase("de").includes(normalized)
        );
      })
      .slice(0, 25);
  }, [items, query, selectedItem]);

  function select(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    onValueChange(itemId);
    setQuery(item ? itemLabel(item) : "");
    setOpen(false);
  }

  return (
    <div
      className={`relative ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery(selectedItem ? itemLabel(selectedItem) : "");
        }
      }}
    >
      <div className="relative">
        <input
          type="search"
          value={query}
          required={required}
          pattern={required && !value ? "(?!)" : undefined}
          title={required && !value ? "Bitte einen Artikel aus der Trefferliste auswählen" : undefined}
          placeholder="Artikelname oder SKU suchen…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (value) onValueChange("");
            setOpen(true);
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm"
        />
        {query && (
          <button
            type="button"
            aria-label="Artikelauswahl löschen"
            onClick={() => select("")}
            className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div
          id={listId}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">Keine Artikel gefunden.</p>
          ) : (
            matches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item.id)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                  item.id === value ? "bg-blue-50 text-blue-700" : ""
                }`}
              >
                <span className="font-medium">{item.name}</span>
                {item.sku && <span className="ml-2 text-xs text-gray-500">SKU {item.sku}</span>}
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
