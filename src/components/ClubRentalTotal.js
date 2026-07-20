import React from 'react';
import { toWholeNumber } from '../utils/numberUtils';

function ClubRentalTotal({ selectedClubs = [], rate = 0, loading = false, className = '' }) {
  const totalQuantity = selectedClubs.reduce(
    (sum, item) => sum + Math.max(0, toWholeNumber(item.qty || 0)),
    0
  );
  const safeRate = Math.max(0, toWholeNumber(rate));
  const totalPrice = totalQuantity * safeRate;

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 ${className}`}>
      <div className="text-xs font-black text-emerald-900">รวมค่าเช่าไม้กอล์ฟ</div>
      <output className="text-xl font-black tabular-nums text-emerald-800" aria-live="polite">
        {loading ? '-' : totalPrice.toLocaleString('th-TH')} บาท
      </output>
    </div>
  );
}

export default ClubRentalTotal;
