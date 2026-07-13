import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase'; 
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore"; 
import Auth from './components/Auth';
import OwnerDashboard from './components/OwnerDashboard'; 
import StaffDashboard from './components/StaffDashboard';
import CustomerDashboard from './components/CustomerDashboard'; 

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data()); 
          } else {
            console.error("ไม่พบข้อมูลผู้ใช้ในระบบฐานข้อมูล");
            setUserData(null);
          }
        } catch (error) {
          console.error("เกิดข้อผิดพลาดในการดึงข้อมูลจาก Firestore:", error);
          setUserData(null);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth).then(() => alert("ออกจากระบบเรียบร้อยแล้ว"));
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-emerald-900 text-white font-bold animate-pulse">
      MUANG LOEI GOLF IS LOADING...
    </div>
  );

  // กรณีที่ 1: ยังไม่ได้เข้าสู่ระบบ
  if (!user) return <Auth />;

  // กรณีที่ 2: เข้าสู่ระบบแล้ว แต่ยังไม่ได้ยืนยันอีเมล
  if (!user.emailVerified) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center border-t-8 border-amber-500 w-96">
          <h2 className="text-xl font-black text-slate-800">กรุณายืนยันอีเมลของคุณ</h2>
          <p className="text-sm text-slate-500 my-4">
            ระบบได้ส่งลิงก์ยืนยันตัวตนไปที่อีเมลของท่านแล้ว กรุณาตรวจสอบในกล่องจดหมายหลัก หรือกล่องจดหมายขยะ จากนั้นกดยืนยันลิงก์ก่อนเข้าใช้งานระบบ
          </p>
          <button 
            onClick={handleLogout} 
            className="bg-slate-800 text-white font-bold px-6 py-3 rounded-2xl hover:bg-red-500 transition-all text-sm w-full tracking-wider shadow-md"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  // ดักจับสิทธิ์จากฐานข้อมูลและแปลงเป็นตัวพิมพ์เล็กเพื่อตรวจสอบความถูกต้อง
  const rawRole = userData?.Role || userData?.role || '';
  const role = rawRole.trim().toLowerCase(); 

  // กรณีที่ 3: ผ่านการตรวจสอบแล้ว แยกการสลับหน้าแดชบอร์ดให้ตรงตามสิทธิ์จริง
  if (role === 'owner') {
    return <OwnerDashboard user={user} userData={userData} handleLogout={handleLogout} />;
  } else if (role === 'staff') {
    return <StaffDashboard user={user} userData={userData} handleLogout={handleLogout} />;
  } else {
    return <CustomerDashboard user={user} userData={userData} handleLogout={handleLogout} />;
  }
}

export default App;
