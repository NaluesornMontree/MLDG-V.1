import React, { useState } from 'react';
import { auth, db } from '../firebase'; 
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider, 
  FacebookAuthProvider, // เพิ่มไลบรารีสำหรับ Facebook
  signInWithPopup,
  sendEmailVerification
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { theme } from '../styles/theme'; 

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');      
  const [phoneNumber, setPhoneNumber] = useState('');  
  const [mode, setMode] = useState('login'); 
  const [loading, setLoading] = useState(false);

  const s = theme.auth; 
  const formSpacingClass = mode === 'register' ? 'space-y-3' : 'space-y-2.5';
  const compactInputClass = `${s.input} !mb-0`;

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const isActive = userData.Is_Active ?? userData.isActive ?? true;
          if (isActive === false) {
            alert("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าของร้าน");
            await auth.signOut();
            setLoading(false);
            return;
          }
        }
      } else if (mode === 'register') {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        
        await sendEmailVerification(userCred.user);

        await setDoc(doc(db, "users", userCred.user.uid), {
          User_ID: userCred.user.uid,
          Email: email,
          FullName: fullName,
          PhoneNumber: phoneNumber,
          Role: 'customer', 
          Points_Balance: 0, 
          Is_Active: true,
          CreatedAt: new Date()
        });
        
        alert("ลงทะเบียนสำเร็จ ระบบได้ส่งลิงก์ยืนยันตัวตนไปที่อีเมลของท่านแล้ว กรุณาตรวจสอบในกล่องข้อความและกดยืนยันก่อนเข้าสู่ระบบ");
        setMode('login');
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setLoading(false);
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
          alert("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าของร้าน");
          await auth.signOut();
        }
      }
    } catch (err) {
      alert("การเข้าสู่ระบบด้วย Google เกิดข้อผิดพลาด: " + err.message);
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
          alert("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าของร้าน");
          await auth.signOut();
        }
      }
    } catch (err) {
      alert("การเข้าสู่ระบบด้วย Facebook เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, email);
      alert("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว");
      setMode('login');
    } catch (err) { alert(err.message); }
  };

  return (
    <div className={s.wrapper}>
      <div className={s.card}>
        <div className={s.header}>
          <h2 className={s.title}>
            {mode === 'forgot' ? 'RESET PASSWORD' : mode === 'register' ? 'REGISTER' : 'LOGIN'}
          </h2>
          <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] mt-2">
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
            <input 
              type="password" 
              value={password} 
              onChange={(e)=>setPassword(e.target.value)} 
              className={compactInputClass} 
              placeholder="Password" 
              required 
            />
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
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-sm font-black text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            {mode === 'login' ? 'สมัครสมาชิกใหม่' : 'กลับไปหน้าเข้าสู่ระบบ'}
          </button>
          
          {mode === 'login' && (
            <button 
              type="button"
              onClick={() => setMode('forgot')} 
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              ลืมรหัสผ่านใช่หรือไม่?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth;
