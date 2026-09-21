"use client";

import { useEffect, useRef, useState } from "react";
import { formatLocalizedNumber, parseLocalizedNumber } from "@/lib/localized-input";

type DecimalInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
  integer?: boolean;
};

export function DecimalInput({ value, onValueChange, integer = false, onBlur, ...props }: DecimalInputProps) {
  const [text, setText] = useState(() => formatLocalizedNumber(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatLocalizedNumber(value));
  }, [value]);

  return (
    <input
      {...props}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      pattern={integer ? "[0-9]+" : "[0-9]+([.,][0-9]+)?"}
      value={text}
      onFocus={() => { focused.current = true; }}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const parsed = parseLocalizedNumber(next);
        if (parsed !== null && (!integer || Number.isInteger(parsed))) onValueChange(parsed);
      }}
      onBlur={(event) => {
        focused.current = false;
        const parsed = parseLocalizedNumber(event.currentTarget.value);
        if (parsed !== null && (!integer || Number.isInteger(parsed))) {
          setText(formatLocalizedNumber(parsed));
          onValueChange(parsed);
        }
        onBlur?.(event);
      }}
    />
  );
}
