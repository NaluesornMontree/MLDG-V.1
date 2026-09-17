import React from 'react';

export function getPasswordStrength(password = '') {
  const checks = [
    {
      id: 'length',
      passed: password.length >= 8,
      label: 'อย่างน้อย 8 ตัวอักษร'
    },
    {
      id: 'uppercase',
      passed: /[A-Z]/.test(password),
      label: 'มีตัวอักษรพิมพ์ใหญ่'
    },
    {
      id: 'lowercase',
      passed: /[a-z]/.test(password),
      label: 'มีตัวอักษรพิมพ์เล็ก'
    },
    {
      id: 'number',
      passed: /\d/.test(password),
      label: 'มีตัวเลข'
    },
    {
      id: 'symbol',
      passed: /[^A-Za-z0-9]/.test(password),
      label: 'มีอักขระพิเศษ เช่น ! @ #'
    }
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  const hasRepeatedPattern = /(.)\1{2,}/.test(password);
  const hasSequentialPattern = /(1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|password)/i.test(password);
  const penalty = hasRepeatedPattern || hasSequentialPattern ? 1 : 0;
  const score = password ? Math.max(0, Math.min(4, passedCount - penalty - 1)) : 0;

  const levels = [
    { label: 'ง่ายเกินไป', color: 'bg-rose-500', textColor: 'text-rose-700', width: 'w-1/4' },
    { label: 'ยังอ่อนอยู่', color: 'bg-orange-500', textColor: 'text-orange-700', width: 'w-2/5' },
    { label: 'พอใช้', color: 'bg-amber-500', textColor: 'text-amber-700', width: 'w-3/5' },
    { label: 'ปลอดภัยดี', color: 'bg-emerald-500', textColor: 'text-emerald-700', width: 'w-4/5' },
    { label: 'แข็งแรงมาก', color: 'bg-teal-600', textColor: 'text-teal-700', width: 'w-full' }
  ];

  return {
    score,
    checks,
    level: levels[score],
    isAcceptable: password.length >= 8 && score >= 2
  };
}

function PasswordStrengthMeter({ password, className = '' }) {
  const strength = getPasswordStrength(password);
  const adviceText = 'คำแนะนำ: ควรมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ';

  if (!password) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] font-bold text-slate-500 ${className}`}>
        {adviceText}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-black text-slate-500">ความปลอดภัยรหัสผ่าน</span>
        <span className={`text-[11px] font-black ${strength.level.textColor}`}>{strength.level.label}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full transition-all duration-300 ${strength.level.color} ${strength.level.width}`} />
      </div>
      <p className="mt-2 text-[11px] font-bold leading-4 text-slate-500">{adviceText}</p>
    </div>
  );
}

export default PasswordStrengthMeter;
