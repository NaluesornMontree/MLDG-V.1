import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import LaneManagement from './LaneManagement';
import PaymentManager from './PaymentManager';
import ReviewManagement from './ReviewManagement';
import { NavIcon, ResponsiveNavButton } from './DashboardNav';

function StaffDashboard({ user, userData, handleLogout }) {
  const [activeTab, setActiveTab] = useState('payment');
  const [checkoutBookingId, setCheckoutBookingId] = useState(null);
  const [profileForm, setProfileForm] = useState({ FullName: '', PhoneNumber: '' });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    if (userData) {
      setProfileForm({
        FullName: userData.FullName || userData.fullName || '',
        PhoneNumber: userData.PhoneNumber || userData.phone || ''
      });
    }
  }, [userData]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.FullName.trim()) return alert("กรุณากรอกชื่อ-นามสกุลจริง");
    if (profileForm.PhoneNumber.length !== 10) return alert("กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก");

    setUpdatingProfile(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        FullName: profileForm.FullName.trim(),
        PhoneNumber: profileForm.PhoneNumber
      });
      alert("บันทึกการแก้ไขข้อมูลส่วนตัวสำเร็จ");
    } catch (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const navItems = [
    { id: 'profile', label: 'จัดการข้อมูลส่วนตัว', icon: 'user' },
    { id: 'lanes', label: 'ตารางการใช้เลนซ้อม', icon: 'lane' },
    { id: 'payment', label: 'คิดเงินและจัดการรายได้', icon: 'payment' },
    { id: 'reviews', label: 'ตรวจสอบคะแนน', icon: 'star' },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-950/95 text-white p-2 shadow-2xl border-t border-emerald-800/70 md:static md:w-72 md:bg-emerald-900 md:p-6 md:border-t-0 md:flex md:flex-col md:justify-between">
        <div>
          <h2 className="hidden md:block text-xl font-black mb-6 tracking-tighter">MLG STAFF</h2>
          <div className="hidden md:block mb-6 p-4 bg-emerald-950/40 rounded-2xl border border-emerald-800/50">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">ผู้เข้าใช้งาน</div>
            <div className="text-sm font-black truncate mt-1">{userData?.FullName || 'พนักงาน'}</div>
            <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
            <span className="inline-block mt-2 bg-amber-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">STAFF</span>
          </div>

          <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
            {navItems.map((item) => (
              <ResponsiveNavButton
                key={item.id}
                active={activeTab === item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => setActiveTab(item.id)}
              />
            ))}
          </nav>

          <nav className="hidden">
            {['profile', 'lanes', 'payment', 'reviews'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)} 
                className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === tab ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}
              >
                {tab === 'profile' ? 'จัดการข้อมูลส่วนตัว' : 
                 tab === 'lanes' ? 'ตารางการใช้เลนซ้อม' : 
                 tab === 'payment' ? 'คิดเงินและจัดการรายได้' : 'ตรวจสอบคะแนน'}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 pb-28 md:p-10 md:pb-10 overflow-y-auto">
        <header className="mb-6 md:mb-10 flex justify-between items-center gap-3 [&>button:last-child]:hidden">
          <h1 className="text-xl md:text-2xl font-black text-slate-800 uppercase leading-tight">
            {activeTab === 'profile' ? 'My Account Profile' :
             activeTab === 'lanes' ? 'ตารางการใช้เลนซ้อม' :
             activeTab === 'payment' ? 'Payment Management' : 'Review Management'}
          </h1>
          <button onClick={handleLogout} className="shrink-0 text-sm font-bold text-red-500 bg-red-50 px-3 md:px-4 py-2 rounded-xl hover:bg-red-100 transition-all flex items-center gap-2">
            <NavIcon name="logOut" className="w-4 h-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
          <button onClick={handleLogout} className="text-sm font-bold text-red-500 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-all">ออกจากระบบ</button>
        </header>

        {activeTab === 'profile' && (
          <div className="w-full max-w-4xl mx-auto my-auto bg-white rounded-[2rem] border shadow-md flex flex-col md:flex-row overflow-hidden animate-fadeIn">
            <div className="md:w-1/3 bg-slate-50 p-5 sm:p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center text-xl font-black mb-4">
                {profileForm.FullName ? profileForm.FullName.slice(0, 2).toUpperCase() : 'ST'}
              </div>
              <h3 className="font-black text-slate-800">{profileForm.FullName}</h3>
            </div>
            <div className="md:w-2/3 p-5 sm:p-8">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <input type="email" value={user?.email} disabled className="w-full bg-slate-100 p-3 rounded-xl text-sm font-mono" />
                <input type="text" value={profileForm.FullName} onChange={(e) => setProfileForm({...profileForm, FullName: e.target.value})} className="w-full border p-3 rounded-xl text-sm font-bold" placeholder="ชื่อ-นามสกุล" />
                <input type="text" value={profileForm.PhoneNumber} maxLength={10} onChange={(e) => setProfileForm({...profileForm, PhoneNumber: e.target.value.replace(/\D/g, '')})} className="w-full border p-3 rounded-xl text-sm font-bold" placeholder="เบอร์โทรศัพท์ (10 หลัก)" />
                <button type="submit" className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl shadow">{updatingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'lanes' && (
          <LaneManagement
            userData={userData}
            onCheckoutBooking={(bookingId) => {
              setCheckoutBookingId(bookingId);
              setActiveTab('payment');
            }}
          />
        )}
        {activeTab === 'payment' && (
          <PaymentManager
            initialBookingId={checkoutBookingId}
            onInitialBookingHandled={() => setCheckoutBookingId(null)}
          />
        )}
        {activeTab === 'reviews' && <ReviewManagement />}
      </div>
    </div>
  );
}

export default StaffDashboard;
