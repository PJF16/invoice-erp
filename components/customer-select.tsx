"use client";

import { useState } from "react";
import { SearchSelect } from "@/components/search-select";

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
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedId = value ?? internalValue;

  return (
    <SearchSelect
      options={customers}
      value={selectedId}
      onValueChange={(customerId) => {
        if (value === undefined) setInternalValue(customerId);
        onValueChange?.(customerId);
      }}
      getValue={(customer) => customer.id}
      getLabel={customerLabel}
      getSearchText={(customer) => `${customer.name} ${customer.customerNumber ?? ""}`}
      renderOption={(customer) => <><span className="font-medium">{customer.name}</span>{customer.customerNumber && <span className="ml-2 text-xs text-gray-500">Nr. {customer.customerNumber}</span>}</>}
      required={required}
      disabled={disabled}
      name={name}
      emptyLabel={emptyLabel}
      placeholder={placeholder}
      clearLabel="Kundenauswahl löschen"
      noResultsLabel="Keine Kunden gefunden."
      validationMessage="Bitte einen Kunden aus der Trefferliste auswählen"
      className={className}
    />
  );
}
