import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  signOut,
  verifyPasswordResetCode
} from 'firebase/auth';
import { auth } from '../firebase';
import { AlertIcon, CheckCircleIcon } from './AppIcons';
import {
  getEmailActionReturnUrl,
  storeEmailActionResult
} from '../utils/emailActionUtils';

const actionTasks = new Map();

function runActionOnce(key, task) {
  if (!actionTasks.has(key)) {
    actionTasks.set(key, task());
  }
  return actionTasks.get(key);
}

function getActionErrorMessage(error) {
  if (error?.code === 'auth/expired-action-code') {
    return 'ลิงก์นี้หมดอายุแล้ว กรุณากลับไปขอให้ระบบส่งอีเมลฉบับใหม่';
  }
  if (error?.code === 'auth/invalid-action-code') {
    return 'ลิงก์นี้ไม่ถูกต้องหรือถูกใช้งานไปแล้ว กรุณากลับไปตรวจสอบสถานะอีเมลอีกครั้ง';
  }
  if (error?.code === 'auth/network-request-failed') {
    return 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง';
  }
  return 'ไม่สามารถดำเนินการจากลิงก์นี้ได้ กรุณาลองขออีเมลฉบับใหม่อีกครั้ง';
}

function EmailActionHandler({ action }) {
  const [status, setStatus] = useState('processing');
  const [resultTitle, setResultTitle] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const returnUrl = useMemo(
    () => getEmailActionReturnUrl(action.continueUrl),
    [action.continueUrl]
  );

  const finishAndRedirect = useCallback(({
    title,
    message,
    requiresLogin,
    notice
  }) => {
    setResultTitle(title);
    setResultMessage(message);
    setStatus('success');
    storeEmailActionResult({ requiresLogin, message: notice });

    window.setTimeout(() => {
      window.location.replace(returnUrl);
    }, 1300);
  }, [returnUrl]);

  useEffect(() => {
    let active = true;

    const processAction = async () => {
      try {
        if (action.mode === 'resetPassword') {
          const email = await runActionOnce(
            `inspect-reset:${action.actionCode}`,
            () => verifyPasswordResetCode(auth, action.actionCode)
          );
          if (!active) return;
          setAccountEmail(email);
          setStatus('reset-ready');
          return;
        }

        if (action.mode === 'recoverEmail') {
          await runActionOnce(`recover-email:${action.actionCode}`, async () => {
            await checkActionCode(auth, action.actionCode);
            await applyActionCode(auth, action.actionCode);
          });
          await signOut(auth).catch(() => {});
          if (!active) return;
          finishAndRedirect({
            title: 'กู้คืนอีเมลสำเร็จ',
            message: 'ระบบกำลังพาคุณกลับไปยังหน้าเข้าสู่ระบบ',
            requiresLogin: true,
            notice: 'กู้คืนอีเมลสำเร็จแล้ว กรุณาเข้าสู่ระบบอีกครั้ง'
          });
          return;
        }

        const verifiedEmail = await runActionOnce(
          `verify-email:${action.actionCode}`,
          async () => {
            const actionInfo = await checkActionCode(auth, action.actionCode);
            await applyActionCode(auth, action.actionCode);
            return actionInfo?.data?.email || '';
          }
        );

        if (typeof auth.authStateReady === 'function') {
          await auth.authStateReady();
        }

        const currentUser = auth.currentUser;
        const isSameAccount = currentUser && (
          !verifiedEmail ||
          currentUser.email?.trim().toLowerCase() === verifiedEmail.trim().toLowerCase()
        );

        let canEnterAutomatically = false;
        if (isSameAccount) {
          try {
            await currentUser.reload();
            canEnterAutomatically = Boolean(currentUser.emailVerified);
          } catch (error) {
            await signOut(auth).catch(() => {});
          }
        } else if (currentUser) {
          await signOut(auth).catch(() => {});
        }

        if (!active) return;

        finishAndRedirect({
          title: 'ยืนยันอีเมลสำเร็จ',
          message: canEnterAutomatically
            ? 'กำลังนำคุณเข้าสู่ระบบโดยอัตโนมัติ'
            : 'กำลังนำคุณไปยังหน้าเข้าสู่ระบบ',
          requiresLogin: !canEnterAutomatically,
          notice: canEnterAutomatically
            ? 'ยืนยันอีเมลสำเร็จแล้ว ระบบนำคุณเข้าสู่ระบบอัตโนมัติ'
            : 'ยืนยันอีเมลสำเร็จแล้ว กรุณาเข้าสู่ระบบอีกครั้งเพื่อความปลอดภัย'
        });
      } catch (error) {
        if (!active) return;
        setResultTitle('ไม่สามารถดำเนินการได้');
        setResultMessage(getActionErrorMessage(error));
        setStatus('error');
      }
    };

    processAction();
    return () => {
      active = false;
    };
  }, [action.actionCode, action.mode, finishAndRedirect]);

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setFormError('');

    if (newPassword.length < 6) {
      setFormError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, action.actionCode, newPassword);
      await signOut(auth).catch(() => {});
      finishAndRedirect({
        title: 'เปลี่ยนรหัสผ่านสำเร็จ',
        message: 'กำลังนำคุณไปยังหน้าเข้าสู่ระบบ',
        requiresLogin: true,
        notice: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่'
      });
    } catch (error) {
      setFormError(getActionErrorMessage(error));
      setSubmitting(false);
    }
  };

  const handleReturnToApp = () => {
    storeEmailActionResult({ requiresLogin: true });
    window.location.replace(returnUrl);
  };

  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-emerald-950 p-4 font-sans"
      style={{
        backgroundImage: "linear-gradient(135deg, rgba(2, 44, 34, 0.94), rgba(6, 78, 59, 0.72), rgba(15, 23, 42, 0.78)), url('/shop-hero.jpg')",
        backgroundPosition: 'center',
        backgroundSize: 'cover'
      }}
    >
      <div className="absolute inset-0 bg-slate-950/15 backdrop-blur-[2px]" />
      <section className="relative w-full max-w-md animate-[screenEnter_0.4s_cubic-bezier(.22,1,.36,1)] rounded-[2rem] border border-white/20 bg-white p-6 text-center shadow-2xl shadow-emerald-950/30 sm:p-9">
        {status === 'processing' && (
          <div className="py-7">
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
            <h1 className="mt-6 text-xl font-black text-slate-900">กำลังตรวจสอบลิงก์</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              กรุณารอสักครู่ ระบบกำลังยืนยันข้อมูลของคุณ
            </p>
          </div>
        )}

        {status === 'reset-ready' && (
          <form onSubmit={handleResetPassword} className="text-left">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircleIcon className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-center text-xl font-black text-slate-900">ตั้งรหัสผ่านใหม่</h1>
            <p className="mt-2 text-center text-sm font-semibold text-slate-500">{accountEmail}</p>

            <label className="mt-6 block text-sm font-black text-slate-700">
              รหัสผ่านใหม่
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <label className="mt-4 block text-sm font-black text-slate-700">
              ยืนยันรหัสผ่านใหม่
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            {formError && (
              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? 'กำลังบันทึกรหัสผ่าน...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>
        )}

        {(isSuccess || isError) && (
          <div className="py-5">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
              isSuccess
                ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border border-rose-100 bg-rose-50 text-rose-600'
            }`}>
              {isSuccess
                ? <CheckCircleIcon className="h-8 w-8" />
                : <AlertIcon className="h-8 w-8" />}
            </div>
            <h1 className="mt-5 text-xl font-black text-slate-900">{resultTitle}</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{resultMessage}</p>

            {isSuccess ? (
              <div className="mx-auto mt-6 h-1.5 w-32 overflow-hidden rounded-full bg-emerald-100">
                <div className="h-full animate-[emailActionProgress_1.3s_linear_forwards] rounded-full bg-emerald-600" />
              </div>
            ) : (
              <button
                type="button"
                onClick={handleReturnToApp}
                className="mt-6 w-full rounded-2xl bg-slate-800 px-5 py-3.5 text-sm font-black text-white transition hover:bg-slate-900 active:scale-[0.98]"
              >
                กลับไปยังระบบ
              </button>
            )}
          </div>
        )}
      </section>

      <style>
        {`@keyframes emailActionProgress { from { width: 0; } to { width: 100%; } }`}
      </style>
    </main>
  );
}

export default EmailActionHandler;
