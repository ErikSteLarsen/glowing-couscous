'use client';

import { useState } from 'react';

export function ValidatedNumberInput({ value, onChange, min, max, step = '1' }: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max?: number;
  step?: string;
}) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  function valid(raw: string) {
    if (!raw.trim()) return null;
    const number = Number(raw);
    if (!Number.isFinite(number) || number < min || (max !== undefined && number > max)) return null;
    if (step === '1' && !Number.isInteger(number)) return null;
    return number;
  }

  return <input type="number" min={min} max={max} step={step} value={editing ? text : String(value)}
    onFocus={() => { setText(String(value)); setEditing(true); }}
    onChange={(event) => {
      const next = event.target.value;
      setText(next);
      const number = valid(next);
      if (number !== null) onChange(number);
    }}
    onBlur={() => {
      setEditing(false);
      if (valid(text) === null) setText(String(value));
    }} />;
}
