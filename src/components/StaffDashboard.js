import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import LaneManagement from './LaneManagement';
import PaymentManager from './PaymentManager';
import ReviewManagement from './ReviewManagement';
import { NavIcon, ResponsiveNavButton } from './DashboardNav';
import AccountProfileCard from './AccountProfileCard';
import DashboardHome from './DashboardHome';
import { findUserByPhoneNumber, getDuplicatePhoneMessage, normalizePhoneNumber } from '../utils/userPhoneUtils';

function StaffDashboard({ user, userData, handleLogout, onPasswordResetEmailSent }) {
  const [activeTab, setActiveTab] = useState('dashboard');
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
    const normalizedPhone = normalizePhoneNumber(profileForm.PhoneNumber);
    if (normalizedPhone.length !== 10) return alert("กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก");

    setUpdatingProfile(true);
    try {
      const duplicatePhoneUser = await findUserByPhoneNumber(db, normalizedPhone, user.uid);
      if (duplicatePhoneUser) {
        alert(getDuplicatePhoneMessage(normalizedPhone));
        return;
      }

      await updateDoc(doc(db, "users", user.uid), {
        FullName: profileForm.FullName.trim(),
        PhoneNumber: normalizedPhone
      });
      alert("บันทึกการแก้ไขข้อมูลส่วนตัวสำเร็จ");
    } catch (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: 'dashboard' },
    { id: 'profile', label: 'จัดการข้อมูลส่วนตัว', icon: 'user' },
    { id: 'lanes', label: 'ตารางการใช้เลนซ้อม', icon: 'lane' },
    { id: 'payment', label: 'คิดเงินและจัดการรายได้', icon: 'payment' },
    { id: 'reviews', label: 'ตรวจสอบคะแนนและความคิดเห็น', icon: 'star' },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden bg-emerald-950 text-white p-2 shadow-2xl border-t border-emerald-800/70 md:inset-y-0 md:right-auto md:h-dvh md:w-72 md:shrink-0 md:overflow-y-auto md:p-6 md:border-t-0 md:flex md:flex-col md:justify-between">
        <img
          src="/sidebar-cover.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = '/shop-hero.jpg';
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-950/95 via-emerald-950/82 to-emerald-950/96" />
        <div className="relative z-10">
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
            <button
              type="button"
              onClick={handleLogout}
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className="flex h-14 min-w-[58px] flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-2 font-bold text-rose-100 transition-all hover:bg-rose-900/40 hover:text-white md:hidden"
            >
              <NavIcon name="logOut" className="h-5 w-5 shrink-0" />
            </button>
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
                 tab === 'payment' ? 'คิดเงินและจัดการรายได้' : 'ตรวจสอบคะแนนและความคิดเห็น'}
              </button>
            ))}
          </nav>
        </div>
        <div className="relative z-10 hidden border-t border-emerald-800/60 pt-4 md:block">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl border border-rose-200/10 bg-rose-50/10 px-4 py-3 text-left text-sm font-black text-rose-100 transition-all hover:bg-rose-500/20 hover:text-white"
          >
            <NavIcon name="logOut" className="h-5 w-5 shrink-0" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="min-w-0 flex-1 p-4 pb-28 md:ml-72 md:p-10 md:pb-10 overflow-y-auto">
        <header className="hidden">
          <button onClick={handleLogout} className="shrink-0 text-sm font-bold text-red-500 bg-red-50 px-3 md:px-4 py-2 rounded-xl hover:bg-red-100 transition-all flex items-center gap-2">
            <NavIcon name="logOut" className="w-4 h-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
          <button onClick={handleLogout} className="text-sm font-bold text-red-500 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-all">ออกจากระบบ</button>
        </header>

        <div key={activeTab} className="dashboard-page-transition">
        {activeTab === 'dashboard' && (
          <DashboardHome
            role="staff"
            user={user}
            userData={userData}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'profile' && (
          <AccountProfileCard
            user={user}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            updatingProfile={updatingProfile}
            onSubmit={handleUpdateProfile}
            roleLabel="STAFF"
            roleClassName="bg-amber-600"
            fallbackName="พนักงาน"
            fallbackInitials="ST"
            onPasswordResetEmailSent={onPasswordResetEmailSent}
          />
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
            user={user}
            userData={userData}
            initialBookingId={checkoutBookingId}
            onInitialBookingHandled={() => setCheckoutBookingId(null)}
          />
        )}
        {activeTab === 'reviews' && <ReviewManagement />}
        </div>
      </div>
    </div>
  );
}

export default StaffDashboard;
