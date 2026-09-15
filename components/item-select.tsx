"use client";

import { SearchSelect } from "@/components/search-select";

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
  return (
    <SearchSelect
      options={items}
      value={value}
      onValueChange={onValueChange}
      getValue={(item) => item.id}
      getLabel={itemLabel}
      getSearchText={(item) => `${item.name} ${item.sku ?? ""}`}
      renderOption={(item) => <><span className="font-medium">{item.name}</span>{item.sku && <span className="ml-2 text-xs text-gray-500">SKU {item.sku}</span>}</>}
      required={required}
      placeholder="Artikelname oder SKU suchen…"
      clearLabel="Artikelauswahl löschen"
      noResultsLabel="Keine Artikel gefunden."
      validationMessage="Bitte einen Artikel aus der Trefferliste auswählen"
      className={className}
    />
  );
}
