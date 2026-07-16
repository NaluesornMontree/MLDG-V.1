import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { toWholeNumber } from '../utils/numberUtils';

function getInitials(name = '', fallback = 'US') {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return initials || fallback;
}

const formatPoints = (value) => toWholeNumber(value).toLocaleString();

function AccountProfileCard({
  user,
  profileForm,
  setProfileForm,
  updatingProfile,
  onSubmit,
  fallbackName = 'ผู้ใช้งานระบบ',
  fallbackInitials = 'US',
  pointsBalance = null,
  onPasswordResetEmailSent = null
}) {
  const fullName = profileForm.FullName || fallbackName;
  const [sendingPasswordEmail, setSendingPasswordEmail] = useState(false);
  const [passwordEmailSent, setPasswordEmailSent] = useState(false);
  const [passwordEmailError, setPasswordEmailError] = useState('');

  const handleSendPasswordResetEmail = async () => {
    const email = user?.email || '';

    if (!email) {
      setPasswordEmailError('ไม่พบอีเมลของบัญชีนี้ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่อีกครั้ง');
      return;
    }

    setSendingPasswordEmail(true);
    setPasswordEmailError('');

    try {
      await sendPasswordResetEmail(auth, email);
      setPasswordEmailSent(true);
      setPasswordEmailError('');
      onPasswordResetEmailSent?.(email);
    } catch (error) {
      setPasswordEmailSent(false);
      if (error.code === 'auth/too-many-requests') {
        setPasswordEmailError('มีการส่งอีเมลหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง');
      } else if (error.code === 'auth/invalid-email') {
        setPasswordEmailError('รูปแบบอีเมลของบัญชีนี้ไม่ถูกต้อง');
      } else if (error.code === 'auth/network-request-failed') {
        setPasswordEmailError('ไม่สามารถส่งอีเมลได้เนื่องจากปัญหาเครือข่าย ระบบจะยังไม่ออกจากระบบ กรุณาตรวจสอบอินเทอร์เน็ตแล้วกดส่งใหม่อีกครั้ง');
      } else {
        setPasswordEmailError('ไม่สามารถส่งอีเมลเปลี่ยนรหัสผ่านได้ ระบบจะยังไม่ออกจากระบบ กรุณาลองส่งใหม่อีกครั้ง');
      }
    } finally {
      setSendingPasswordEmail(false);
    }
  };

  const handlePasswordEmailReceived = () => {
    onPasswordResetEmailSent?.();
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col md:flex-row text-left animate-fadeIn">
      <div className="md:w-1/3 bg-slate-50 p-5 sm:p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200/60">
        <div className="w-24 h-24 bg-emerald-50 text-emerald-800 rounded-full flex items-center justify-center text-2xl font-black mb-4 border border-emerald-100/70 shadow-inner">
          {getInitials(profileForm.FullName, fallbackInitials)}
        </div>
        <h3 className="text-lg font-black text-slate-800 truncate max-w-full">
          {fullName}
        </h3>
        <p className="text-xs text-slate-400 font-medium font-mono truncate max-w-full mt-0.5">
          {user?.email}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {pointsBalance !== null && (
            <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              {formatPoints(pointsBalance)} PTS
            </span>
          )}
        </div>
      </div>

      <div className="md:w-2/3 p-5 sm:p-8 flex flex-col justify-between">
        <form id="account-profile-form" onSubmit={onSubmit} className="space-y-5">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-base font-black text-slate-800">ข้อมูลรายละเอียดบัญชี</h3>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              อีเมลประจำบัญชี (ไม่สามารถแก้ไขได้)
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full bg-slate-100 border border-slate-200 p-3 rounded-xl text-sm font-semibold text-slate-400 font-mono cursor-not-allowed focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                ชื่อจริง - นามสกุล
              </label>
              <input
                type="text"
                value={profileForm.FullName}
                onChange={(e) => setProfileForm({ ...profileForm, FullName: e.target.value })}
                placeholder="กรอกชื่อและนามสกุลจริง"
                className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500 transition-all shadow-2xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                เบอร์โทรศัพท์ติดต่อ (10 หลัก)
              </label>
              <input
                type="text"
                value={profileForm.PhoneNumber}
                maxLength={10}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    PhoneNumber: e.target.value.replace(/\D/g, '')
                  })
                }
                placeholder="กรอกเบอร์โทรศัพท์"
                className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 font-mono focus:outline-none focus:border-emerald-500 transition-all shadow-2xs"
                required
              />
            </div>
          </div>

        </form>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Password Security
              </p>
              <h4 className="mt-1 text-sm font-black text-slate-800">
                เปลี่ยนรหัสผ่านบัญชี
              </h4>
              <p className="mt-1.5 text-xs font-bold leading-relaxed text-slate-500">
                ระบบจะส่งอีเมลยืนยันตัวตนไปที่อีเมลบัญชีนี้
              </p>
            </div>
            <div className="shrink-0 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleSendPasswordResetEmail}
                disabled={sendingPasswordEmail || !user?.email}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all hover:bg-slate-900 active:scale-95 disabled:bg-slate-300"
              >
                {sendingPasswordEmail
                  ? 'กำลังส่งอีเมล...'
                  : passwordEmailSent
                    ? 'ส่งอีเมลอีกครั้ง'
                    : 'ส่งอีเมลเปลี่ยนรหัสผ่าน'}
              </button>
              {passwordEmailSent && !onPasswordResetEmailSent && (
                <button
                  type="button"
                  onClick={handlePasswordEmailReceived}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 active:scale-95"
                >
                  ได้รับอีเมลแล้ว
                </button>
              )}
            </div>
          </div>

          {passwordEmailSent && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold leading-relaxed text-emerald-700">
              ส่งอีเมลสำหรับเปลี่ยนรหัสผ่านแล้ว กรุณาตรวจสอบกล่องข้อความหรืออีเมลขยะ (Spam) หากยังไม่ได้รับให้กดส่งอีเมลอีกครั้ง และเมื่อได้รับแล้วให้กดปุ่มได้รับอีเมลแล้วเพื่อออกจากระบบ
            </div>
          )}

          {passwordEmailError && (
            <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold leading-relaxed text-rose-600">
              {passwordEmailError}
            </div>
          )}
        </section>

        <div className="mt-6 border-t border-slate-100 pt-4 flex justify-end">
          <button
            type="submit"
            form="account-profile-form"
            disabled={updatingProfile}
            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-8 rounded-xl text-sm shadow transition-all active:scale-95 disabled:bg-slate-300"
          >
            {updatingProfile ? 'กำลังบันทึกข้อมูล...' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccountProfileCard;
