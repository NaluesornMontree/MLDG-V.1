import React from 'react';
import { ChevronDownIcon, ChevronUpIcon } from './AppIcons';
import { normalizeWholeNumberInput, toWholeNumber } from '../utils/numberUtils';

function IntegerStepperInput({
  value,
  onChange,
  min = 0,
  max = null,
  step = 1,
  ariaLabel = 'จำนวน',
  className = '',
  inputClassName = '',
  compact = false,
  disabled = false,
  onBlur = null,
  ...inputProps
}) {
  const safeMin = Math.max(0, toWholeNumber(min));
  const safeStep = Math.max(1, toWholeNumber(step) || 1);
  const parsedMax = max === null || max === undefined || max === ''
    ? null
    : Math.max(safeMin, toWholeNumber(max));
  const currentValue = toWholeNumber(value);

  const clamp = (nextValue) => {
    const minimumValue = Math.max(safeMin, nextValue);
    return parsedMax === null ? minimumValue : Math.min(parsedMax, minimumValue);
  };

  const updateValue = (nextValue) => {
    onChange(String(clamp(nextValue)));
  };

  const handleInputChange = (event) => {
    const normalized = normalizeWholeNumberInput(event.target.value);
    if (!normalized) {
      onChange('');
      return;
    }
    onChange(String(clamp(toWholeNumber(normalized))));
  };

  const handleIncrement = () => {
    if (String(value ?? '').trim() === '') {
      updateValue(Math.max(safeMin, safeStep));
      return;
    }
    updateValue(currentValue + safeStep);
  };

  const handleDecrement = () => {
    updateValue(currentValue - safeStep);
  };

  const handleBlur = (event) => {
    if (
      String(value ?? '').trim() === '' ||
      currentValue < safeMin ||
      (parsedMax !== null && currentValue > parsedMax)
    ) {
      updateValue(currentValue);
    }
    if (onBlur) onBlur(event);
  };

  const decrementDisabled = disabled || currentValue <= safeMin;
  const incrementDisabled = disabled || (parsedMax !== null && currentValue >= parsedMax);
  const inputPadding = compact
    ? 'min-h-10 py-2 pl-3 pr-11 text-xs'
    : 'min-h-12 py-3 pl-4 pr-14 text-sm';
  const controlPosition = compact
    ? 'bottom-1 right-1 top-1 w-8'
    : 'bottom-1.5 right-1.5 top-1.5 w-10';

  return (
    <div className={`relative ${className}`}>
      <input
        {...inputProps}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        disabled={disabled}
        onChange={handleInputChange}
        onBlur={handleBlur}
        aria-label={ariaLabel}
        className={`w-full rounded-xl border border-slate-200 bg-white text-center font-extrabold tabular-nums text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${inputPadding} ${inputClassName}`}
      />
      <div className={`absolute flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${controlPosition}`}>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={incrementDisabled}
          aria-label={`เพิ่ม${ariaLabel}`}
          title={`เพิ่ม${ariaLabel}`}
          className="flex flex-1 items-center justify-center border-b border-slate-200 text-emerald-700 transition hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
        >
          <ChevronUpIcon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
        <button
          type="button"
          onClick={handleDecrement}
          disabled={decrementDisabled}
          aria-label={`ลด${ariaLabel}`}
          title={`ลด${ariaLabel}`}
          className="flex flex-1 items-center justify-center text-emerald-700 transition hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
        >
          <ChevronDownIcon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      </div>
    </div>
  );
}

export default IntegerStepperInput;
