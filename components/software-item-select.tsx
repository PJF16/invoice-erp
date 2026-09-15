"use client";

import { SearchSelect } from "@/components/search-select";
import { eur } from "@/lib/format";

export type SoftwareItemSelectOption = {
  id: string;
  name: string;
  unitPrice: number;
  unit: string;
};

type Props = {
  items: SoftwareItemSelectOption[];
  value: string;
  onValueChange: (itemId: string) => void;
  required?: boolean;
  allowFreeText?: boolean;
  className?: string;
};

function softwareLabel(item: SoftwareItemSelectOption) {
  return `${item.name} (${eur.format(item.unitPrice)}/${item.unit})`;
}

export function SoftwareItemSelect({ items, value, onValueChange, required = false, allowFreeText = false, className = "" }: Props) {
  return (
    <SearchSelect
      options={items}
      value={value}
      onValueChange={onValueChange}
      getValue={(item) => item.id}
      getLabel={softwareLabel}
      getSearchText={(item) => item.name}
      renderOption={(item) => <><span className="font-medium">{item.name}</span><span className="ml-2 text-xs text-gray-500">{eur.format(item.unitPrice)}/{item.unit}</span></>}
      required={required}
      emptyLabel={allowFreeText ? "– Freitext-Position –" : undefined}
      placeholder="Softwareartikel suchen…"
      clearLabel="Softwareartikelauswahl löschen"
      noResultsLabel="Keine Softwareartikel gefunden."
      validationMessage="Bitte einen Softwareartikel aus der Trefferliste auswählen"
      className={className}
    />
  );
}
