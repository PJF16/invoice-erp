"use client";

import { type ReactNode, useId, useMemo, useRef, useState } from "react";

type Props<T> = {
  options: T[];
  value: string;
  onValueChange: (value: string) => void;
  getValue: (option: T) => string;
  getLabel: (option: T) => string;
  getSearchText: (option: T) => string;
  renderOption: (option: T) => ReactNode;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  emptyLabel?: string;
  placeholder: string;
  clearLabel: string;
  noResultsLabel: string;
  validationMessage: string;
  className?: string;
};

export function SearchSelect<T>({
  options,
  value,
  onValueChange,
  getValue,
  getLabel,
  getSearchText,
  renderOption,
  required = false,
  disabled = false,
  name,
  emptyLabel,
  placeholder,
  clearLabel,
  noResultsLabel,
  validationMessage,
  className = "",
}: Props<T>) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find((option) => getValue(option) === value);
  const selectedLabel = selectedOption ? getLabel(selectedOption) : "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de");
    if (selectedOption && query === selectedLabel) return options.slice(0, 25);
    return options
      .filter((option) => !normalized || getSearchText(option).toLocaleLowerCase("de").includes(normalized))
      .slice(0, 25);
  }, [getSearchText, options, query, selectedLabel, selectedOption]);

  function select(nextValue: string) {
    const option = options.find((entry) => getValue(entry) === nextValue);
    onValueChange(nextValue);
    setQuery(option ? getLabel(option) : "");
    setOpen(false);
  }

  return (
    <div
      className={`relative ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery(selectedLabel);
        }
      }}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          disabled={disabled}
          required={required}
          pattern={required && !value ? "(?!)" : undefined}
          title={required && !value ? validationMessage : undefined}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onFocus={(event) => {
            setOpen(true);
            const input = event.currentTarget;
            requestAnimationFrame(() => input.select());
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            if (value) onValueChange("");
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery(selectedLabel);
              event.currentTarget.blur();
            } else if (event.key === "Enter" && open && matches.length === 1) {
              event.preventDefault();
              select(getValue(matches[0]));
            }
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm disabled:bg-gray-100 disabled:text-gray-500"
        />
        {query && !disabled && (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => {
              select("");
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        )}
      </div>
      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {!required && emptyLabel && (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onPointerDown={(event) => {
                event.preventDefault();
                select("");
              }}
              onClick={(event) => {
                if (event.detail === 0) select("");
              }}
              className="block w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-blue-50"
            >
              {emptyLabel}
            </button>
          )}
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">{noResultsLabel}</p>
          ) : (
            matches.map((option) => {
              const optionValue = getValue(option);
              return (
                <button
                  key={optionValue}
                  type="button"
                  role="option"
                  aria-selected={optionValue === value}
                  onPointerDown={(event) => {
                    // Safari may blur the input and remove this list before click fires.
                    event.preventDefault();
                    select(optionValue);
                  }}
                  onClick={(event) => {
                    if (event.detail === 0) select(optionValue);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                    optionValue === value ? "bg-blue-50 text-blue-700" : ""
                  }`}
                >
                  {renderOption(option)}
                </button>
              );
            })
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
