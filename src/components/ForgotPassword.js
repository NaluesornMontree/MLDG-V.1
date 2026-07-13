import React, { useState } from 'react';
import { auth } from '../firebase'; // ตรวจสอบ path ให้ตรงกับที่ระบุใน App.js
import { sendPasswordResetEmail } from 'firebase/auth';

export default function ForgotPassword({ onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('กรุณากรอกอีเมลของคุณครับ');
      return;
    }

    try {
      setMessage('');
      setError('');
      setLoading(true);

      // เรียกใช้ฟังก์ชันของ Firebase ส่งลิงก์เข้าอีเมลลูกค้า/พนักงาน
      await sendPasswordResetEmail(auth, email);
      
      setMessage('ระบบได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบในกล่องข้อความหรืออีเมลขยะ (Spam) ครับ');
      setEmail(''); // เคลียร์ช่องกรอกข้อมูล
    } catch (err) {
      console.error(err);
      // แปลความหมาย Error พื้นฐานให้ผู้ใช้เข้าใจง่าย
      if (err.code === 'auth/user-not-found') {
        setError('ไม่พบอีเมลนี้ในระบบการใช้งานครับ');
      } else if (err.code === 'auth/invalid-email') {
        setError('รูปแบบอีเมลไม่ถูกต้อง');
      } else {
        setError('เกิดข้อผิดพลาดในระบบ ไม่สามารถส่งอีเมลได้');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans p-4">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full border-t-8 border-emerald-600 text-center">
        
        <h2 className="text-2xl font-black text-slate-800 mb-2">ลืมรหัสผ่านใช่ไหม?</h2>
        <p className="text-xs text-slate-400 mb-6">
          กรอกอีเมลของคุณในช่องด้านล่าง ระบบจะทำการส่งลิงก์เพื่อตั้งรหัสผ่านใหม่ไปให้ทันทีครับ
        </p>

        {/* บล็อกแจ้งเตือนสถานะสำเร็จ/ล้มเหลว */}
        {message && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl font-medium">{message}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">{error}</div>}

        <form onSubmit={handleResetPassword} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">อีเมลผู้ใช้งาน</label>
            <input 
              type="email" 
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-all font-medium"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-black text-white text-sm shadow-md transition-all uppercase tracking-wider ${
              loading ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {loading ? 'กำลังส่งข้อมูล...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
          </button>
        </form>

        <button 
          onClick={onBackToLogin}
          className="mt-6 text-xs font-bold text-slate-400 hover:text-emerald-600 transition-all"
        >
          ← ย้อนกลับไปหน้าเข้าสู่ระบบ
        </button>

      </div>
    </div>
  );
}
