import React, { useState } from 'react';
import { auth, db } from '../firebase'; 
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider, 
  FacebookAuthProvider, // เพิ่มไลบรารีสำหรับ Facebook
  signInWithPopup,
  sendEmailVerification,
  fetchSignInMethodsForEmail
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { theme } from '../styles/theme'; 
import {
  findUserByEmail,
  findUserByPhoneNumber,
  getDuplicateEmailMessage,
  getDuplicatePhoneMessage,
  normalizeEmail,
  normalizePhoneNumber
} from '../utils/userPhoneUtils';
import { getFirebaseAuthErrorMessage } from '../utils/firebaseErrorMessages';
import { getEmailActionCodeSettings } from '../utils/emailActionUtils';
import PasswordStrengthMeter, { getPasswordStrength } from './PasswordStrengthMeter';
import PasswordInput from './PasswordInput';
import Popup from './Popup';

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');      
  const [phoneNumber, setPhoneNumber] = useState('');  
  const [mode, setMode] = useState('login'); 
  const [loading, setLoading] = useState(false);
  const [weakPasswordConfirmOpen, setWeakPasswordConfirmOpen] = useState(false);

  const s = theme.auth; 
  const formSpacingClass = mode === 'register' ? 'space-y-3' : 'space-y-2.5';
  const compactInputClass = `${s.input} !mb-0`;

  const signInExistingAccount = async () => {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const isActive = userData.Is_Active ?? userData.isActive ?? true;
      if (isActive === false) {
        window.appAlert("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าของร้าน");
        await auth.signOut();
        return null;
      }
    }
    return userCred.user;
  };

  const registerWithEmail = async (allowWeakPassword = false) => {
    setLoading(true);
    try {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const normalizedEmail = normalizeEmail(email);
      const missingFields = [];

      if (!fullName.trim()) missingFields.push('ชื่อ-นามสกุล');
      if (!normalizedEmail) missingFields.push('อีเมล');
      if (!password) missingFields.push('รหัสผ่าน');
      if (!confirmPassword) missingFields.push('ยืนยันรหัสผ่าน');
      if (!normalizedPhone) missingFields.push('เบอร์โทรศัพท์');

      if (missingFields.length > 0) {
        window.appAlert(`สมัครสมาชิกไม่สำเร็จ เพราะกรอกข้อมูลไม่ครบ: ${missingFields.join(', ')}`);
        return;
      }

      if (normalizedPhone.length !== 10) {
        window.appAlert("สมัครสมาชิกไม่สำเร็จ เพราะเบอร์โทรศัพท์ต้องมี 10 หลัก");
        return;
      }
      if (password !== confirmPassword) {
        window.appAlert("สมัครสมาชิกไม่สำเร็จ เพราะรหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
        return;
      }
      if (password.length < 8) {
        window.appAlert("สมัครสมาชิกไม่สำเร็จ เพราะรหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
        return;
      }
      const duplicateEmailUser = await findUserByEmail(db, normalizedEmail);
      if (duplicateEmailUser) {
        window.appAlert(getDuplicateEmailMessage(normalizedEmail));
        return;
      }
      const existingSignInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
      if (existingSignInMethods.length > 0) {
        window.appAlert(getDuplicateEmailMessage(normalizedEmail));
        return;
      }
      const duplicatePhoneUser = await findUserByPhoneNumber(db, normalizedPhone);
      if (duplicatePhoneUser) {
        window.appAlert(getDuplicatePhoneMessage(normalizedPhone));
        return;
      }
      if (!allowWeakPassword && !getPasswordStrength(password).isAcceptable) {
        setWeakPasswordConfirmOpen(true);
        return;
      }

      const userCred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

      await sendEmailVerification(userCred.user, getEmailActionCodeSettings());

      await setDoc(doc(db, "users", userCred.user.uid), {
        User_ID: userCred.user.uid,
        Email: normalizedEmail,
        FullName: fullName,
        PhoneNumber: normalizedPhone,
        Role: 'customer',
        Points_Balance: 0,
        Is_Active: true,
        CreatedAt: new Date()
      });

      setMode('login');
    } catch (err) {
      window.appAlert(`สมัครสมาชิกไม่สำเร็จ: ${getFirebaseAuthErrorMessage(err, 'กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง')}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (mode === 'login') {
      setLoading(true);
      try {
        await signInExistingAccount();
      } catch (err) {
        window.appAlert(getFirebaseAuthErrorMessage(err, 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบอีเมลและรหัสผ่านแล้วลองอีกครั้ง'));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      await registerWithEmail(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          User_ID: user.uid,
          Email: user.email,
          FullName: user.displayName || '',
          PhoneNumber: user.phoneNumber || '',
          Role: 'customer',
          Points_Balance: 0,
          Is_Active: true,
          CreatedAt: new Date()
        });
      } else {
        const userData = userDoc.data();
        const isActive = userData.Is_Active ?? userData.isActive ?? true;
        if (isActive === false) {
          window.appAlert("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าของร้าน");
          await auth.signOut();
        }
      }
    } catch (err) {
      window.appAlert(`การเข้าสู่ระบบด้วย Google ไม่สำเร็จ: ${getFirebaseAuthErrorMessage(err, 'กรุณาลองเข้าสู่ระบบด้วย Google อีกครั้ง')}`);
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันรองรับ Social Login ด้วย Facebook
  const handleFacebookLogin = async () => {
    setLoading(true);
    const provider = new FacebookAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          User_ID: user.uid,
          Email: user.email || '', // บางบัญชี Facebook อาจไม่ผูกอีเมลระบบจะส่งค่าว่างป้องกันข้อผิดพลาด
          FullName: user.displayName || '',
          PhoneNumber: user.phoneNumber || '',
          Role: 'customer',
          Points_Balance: 0,
          Is_Active: true,
          CreatedAt: new Date()
        });
      } else {
        const userData = userDoc.data();
        const isActive = userData.Is_Active ?? userData.isActive ?? true;
        if (isActive === false) {
          window.appAlert("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าของร้าน");
          await auth.signOut();
        }
      }
    } catch (err) {
      window.appAlert(`การเข้าสู่ระบบด้วย Facebook ไม่สำเร็จ: ${getFirebaseAuthErrorMessage(err, 'กรุณาลองเข้าสู่ระบบด้วย Facebook อีกครั้ง')}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, email, getEmailActionCodeSettings());
      window.appAlert("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว");
      setMode('login');
    } catch (err) {
      window.appAlert(`ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้: ${getFirebaseAuthErrorMessage(err, 'กรุณาตรวจสอบอีเมลแล้วลองอีกครั้ง')}`);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-emerald-950 p-4 font-sans"
      style={{
        backgroundImage: "linear-gradient(135deg, rgba(2, 44, 34, 0.92), rgba(6, 78, 59, 0.62), rgba(15, 23, 42, 0.72)), url('/shop-hero.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_34%),linear-gradient(to_bottom,rgba(2,44,34,0.15),rgba(2,44,34,0.55))]" />
      <style>
        {`
          @keyframes authModeIn {
            0% { opacity: 0; transform: translateY(14px) scale(0.985); filter: blur(5px); }
            100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
          }
          @keyframes authAccentIn {
            0% { opacity: 0; transform: scaleX(0.55); }
            100% { opacity: 1; transform: scaleX(1); }
          }
          .auth-mode-panel {
            animation: authModeIn 280ms cubic-bezier(.22,1,.36,1);
            transform-origin: center top;
          }
          .auth-mode-accent {
            animation: authAccentIn 320ms cubic-bezier(.22,1,.36,1);
            transform-origin: center;
          }
        `}
      </style>
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white/92 p-6 text-slate-800 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl transition-all duration-300 ease-in-out motion-reduce:transition-none sm:rounded-[2.5rem] sm:p-10">
        <div key={mode} className="auth-mode-panel">
        <div className={`${s.header || ''} mb-7 sm:mb-8`}>
          <h2 className="text-3xl font-black tracking-[0.12em] text-white drop-shadow-[0_2px_10px_rgba(15,23,42,0.35)] sm:text-4xl">
            {mode === 'forgot' ? 'RESET PASSWORD' : mode === 'register' ? 'REGISTER' : 'LOGIN'}
          </h2>
          <div className="auth-mode-accent mx-auto mt-3 h-1 w-20 rounded-full bg-slate-300" />
          <p className="mt-4 text-[10px] font-black tracking-[0.2em] text-slate-400">
            MUANG LOEI GOLF MANAGEMENT
          </p>
        </div>

        <form onSubmit={mode === 'forgot' ? handleForgot : handleAuth} className={formSpacingClass}>
          {mode === 'register' && (
            <>
              <input 
                type="text" 
                value={fullName} 
                onChange={(e)=>setFullName(e.target.value)} 
                className={compactInputClass} 
                placeholder="ชื่อ - นามสกุลจริง" 
                required 
              />
              <input 
                type="text" 
                value={phoneNumber} 
                onChange={(e) => {
                  const onlyNums = e.target.value.replace(/\D/g, '');
                  setPhoneNumber(onlyNums);
                }} 
                className={compactInputClass} 
                placeholder="เบอร์โทรศัพท์ (10 หลัก)" 
                maxLength={10}
                minLength={10}
                pattern="[0-9]{10}"
                title="กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลขให้ครบ 10 หลัก"
                required 
              />
            </>
          )}

          <input 
            type="email" 
            value={email} 
            onChange={(e)=>setEmail(e.target.value)} 
            className={compactInputClass} 
            placeholder="Email Address" 
            required 
          />
          
          {mode !== 'forgot' && (
            <>
              <PasswordInput
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                className={compactInputClass}
                placeholder="Password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
              />
              {mode === 'register' && (
                <>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e)=>setConfirmPassword(e.target.value)}
                    className={compactInputClass}
                    placeholder="Confirm Password"
                    autoComplete="new-password"
                    required
                  />
                  <PasswordStrengthMeter password={password} className="!mt-2" />
                </>
              )}
            </>
          )}

          <button type="submit" disabled={loading} className={s.btnPrimary}>
            {loading ? 'PROCESSING...' : mode.toUpperCase()}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-4 w-full space-y-2">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold">หรือ</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>
            
            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white border border-slate-300 text-slate-700 font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all text-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
              เข้าสู่ระบบด้วย Google
            </button>

            <button 
              type="button"
              onClick={handleFacebookLogin}
              disabled={loading}
              className="w-full bg-[#1877F2] text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-[#166FE5] transition-all text-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/facebook.svg" alt="Facebook" className="w-4 h-4 invert brightness-0" />
              เข้าสู่ระบบด้วย Facebook
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 items-center">
          <button 
            type="button" 
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setConfirmPassword('');
            }}
            className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-2.5 text-sm font-black text-emerald-700 transition-all hover:border-emerald-200 hover:bg-emerald-100"
          >
            {mode === 'login' ? 'สมัครสมาชิกใหม่' : 'กลับไปหน้าเข้าสู่ระบบ'}
          </button>
          
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="rounded-xl px-4 py-2 text-xs font-black text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700"
            >
              ลืมรหัสผ่านใช่หรือไม่?
            </button>
          )}
        </div>
        </div>
      </div>
      <Popup
        isOpen={weakPasswordConfirmOpen}
        type="warning"
        title="รหัสผ่านนี้ยังค่อนข้างง่าย"
        message="รหัสผ่านที่ตั้งยังเดาง่ายกว่าที่แนะนำ คุณมั่นใจกับรหัสผ่านนี้แล้วใช่ไหม?"
        confirmLabel="ใช่ ใช้รหัสนี้"
        cancelLabel="กลับไปแก้ไข"
        onConfirm={() => {
          setWeakPasswordConfirmOpen(false);
          registerWithEmail(true);
        }}
        onCancel={() => setWeakPasswordConfirmOpen(false)}
      />
    </div>
  );
}

export default Auth;
