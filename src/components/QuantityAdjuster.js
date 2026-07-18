import React from 'react';
import { MinusIcon, PlusIcon } from './AppIcons';
import { toWholeNumber } from '../utils/numberUtils';

function QuantityAdjuster({
  value,
  onChange,
  min = 0,
  max = null,
  disabled = false,
  ariaLabel = 'จำนวน',
  className = ''
}) {
  const safeMin = Math.max(0, toWholeNumber(min));
  const parsedMax = max === null || max === undefined || max === ''
    ? null
    : Math.max(safeMin, toWholeNumber(max));
  const currentValue = Math.max(safeMin, toWholeNumber(value));
  const decrementDisabled = disabled || currentValue <= safeMin;
  const incrementDisabled = disabled || (parsedMax !== null && currentValue >= parsedMax);

  const setNextValue = (nextValue) => {
    let normalized = Math.max(safeMin, nextValue);
    if (parsedMax !== null) normalized = Math.min(parsedMax, normalized);
    onChange(normalized);
  };

  return (
    <div
      className={`inline-grid h-10 min-w-[7.5rem] grid-cols-[2.25rem_minmax(2.5rem,1fr)_2.25rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => setNextValue(currentValue - 1)}
        disabled={decrementDisabled}
        aria-label={`ลด${ariaLabel}`}
        title={`ลด${ariaLabel}`}
        className="flex items-center justify-center border-r border-slate-200 text-slate-600 transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <output className="flex items-center justify-center px-2 text-sm font-extrabold tabular-nums text-slate-800">
        {currentValue}
      </output>
      <button
        type="button"
        onClick={() => setNextValue(currentValue + 1)}
        disabled={incrementDisabled}
        aria-label={`เพิ่ม${ariaLabel}`}
        title={`เพิ่ม${ariaLabel}`}
        className="flex items-center justify-center border-l border-emerald-100 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 focus:bg-emerald-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-300"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export default QuantityAdjuster;
