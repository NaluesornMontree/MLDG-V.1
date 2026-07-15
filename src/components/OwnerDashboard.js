import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { doc, updateDoc } from 'firebase/firestore';
import { theme } from '../styles/theme';
import StaffManagement from './StaffManagement';
import ClubManagement from './ClubManagement';
import CustomerManagement from './CustomerManagement'; 
import LaneManagement from './LaneManagement';
import SystemSettings from './SystemSettings';
import ShopClosureManagement from './ShopClosureManagement'; 
import PaymentManager from './PaymentManager'; 
import ReviewManagement from './ReviewManagement'; 
import BookingHistoryManagement from './BookingHistoryManagement';
import { NavIcon, ResponsiveNavButton } from './DashboardNav';
import AccountProfileCard from './AccountProfileCard';
import DashboardHome from './DashboardHome';
import { findUserByPhoneNumber, getDuplicatePhoneMessage, normalizePhoneNumber } from '../utils/userPhoneUtils';

function OwnerDashboard({ user, userData, handleLogout, onPasswordResetEmailSent }) { 
  const rawRole = userData?.Role || userData?.role || '';
  const role = rawRole.trim().toLowerCase();

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
    if (!profileForm.FullName.trim()) {
      alert("กรุณากรอกชื่อ-นามสกุลจริง");
      return;
    }
    const normalizedPhone = normalizePhoneNumber(profileForm.PhoneNumber);
    if (normalizedPhone.length !== 10) {
      alert("กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก");
      return;
    }

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
      alert("บันทึกการแก้ไขข้อมูลส่วนตัวสำเร็จเรียบร้อยแล้ว");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: 'dashboard', title: 'Dashboard' },
    { id: 'profile', label: 'จัดการข้อมูลส่วนตัว', icon: 'user', title: 'My Account Profile' },
    { id: 'staff', label: 'จัดการบุคลากร', icon: 'users', title: 'PERSONNEL Management' },
    { id: 'customers', label: 'จัดการข้อมูลลูกค้า', icon: 'users', title: 'Customer Management' },
    { id: 'lanes', label: 'จัดการเลนซ้อม', icon: 'lane', title: 'Lane Management' },
    { id: 'bookingHistory', label: 'ประวัติการจอง', icon: 'history', title: 'Booking History' },
    { id: 'payment', label: 'คิดเงินและจัดการรายได้', icon: 'payment', title: 'Payment Management' },
    { id: 'closures', label: 'ตั้งวันปิดร้านล่วงหน้า', icon: 'calendar', title: 'Shop Closure Management' },
    { id: 'clubs', label: 'จัดการไม้กอล์ฟ', icon: 'club', title: 'Club Management' },
    { id: 'settings', label: 'ตั้งค่าค่าบริการระบบร้าน', icon: 'code', title: 'System Settings' },
    { id: 'reviews', label: 'ตรวจสอบคะแนนและความคิดเห็น', icon: 'star', title: 'Review Management' },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans">
      {/* --- SIDEBAR --- */}
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
          <h2 className="hidden md:block text-xl font-black mb-4 tracking-tighter">MLG MANAGEMENT</h2>
          
          <div className="hidden md:block mb-6 p-4 bg-emerald-950/40 rounded-2xl border border-emerald-800/50 text-left">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">ผู้เข้าใช้งาน</div>
            <div className="text-sm font-black text-white truncate mt-1">
              {userData?.FullName || userData?.fullName || 'ไม่ระบุชื่อ'}
            </div>
            <div className="text-[10px] text-slate-400 font-bold truncate">{user?.email}</div>
            <div className="mt-2.5">
              <span className="inline-block text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider bg-blue-600">
                OWNER
              </span>
            </div>
          </div>

          <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
            {navItems.map(item => (
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
            <button onClick={() => setActiveTab('profile')} className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'profile' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              จัดการข้อมูลส่วนตัว
            </button>
            <hr className="border-emerald-800 my-2" />
            <button onClick={() => setActiveTab('staff')} className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'staff' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              จัดการบุคลากร
            </button>
            <button onClick={() => setActiveTab('customers')} className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'customers' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              จัดการข้อมูลบุคคล
            </button>
            <button onClick={() => setActiveTab('lanes')} className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'lanes' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              จัดการเลนซ้อม
            </button>
            <button onClick={() => setActiveTab('payment')} className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'payment' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              คิดเงินและจัดการรายได้
            </button>
            <button onClick={() => setActiveTab('closures')} className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'closures' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              ตั้งวันปิดร้านล่วงหน้า
            </button>
            <button onClick={() => setActiveTab('clubs')} className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'clubs' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              จัดการไม้กอล์ฟ
            </button>
            <button onClick={() => setActiveTab('settings')} className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'settings' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              ตั้งค่าค่าบริการระบบร้าน
            </button>
            <button onClick={() => setActiveTab('reviews')} className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'reviews' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              ตรวจสอบคะแนนและความคิดเห็น
            </button>
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

      {/* --- MAIN CONTENT --- */}
      <div className="min-w-0 flex-1 p-4 pb-28 md:ml-72 md:p-10 md:pb-10 overflow-y-auto flex flex-col justify-start">
        <header className="hidden">
          <button onClick={handleLogout} className="shrink-0 text-sm font-bold text-red-500 bg-red-50 px-3 md:px-4 py-2 rounded-xl hover:bg-red-100 transition-all shadow-sm flex items-center gap-2">
            <NavIcon name="logOut" className="w-4 h-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
          <button onClick={handleLogout} className="text-sm font-bold text-red-500 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-all shadow-sm">ออกจากระบบ</button>
        </header>

        <div key={activeTab} className="dashboard-page-transition">
        {activeTab === 'dashboard' && (
          <DashboardHome
            role="owner"
            user={user}
            userData={userData}
            onNavigate={setActiveTab}
          />
        )}

        {/* หน้าโปรไฟล์ดีไซน์กึ่งกลางสมมาตรไร้อีโมจิ */}
        {activeTab === 'profile' && (
          <AccountProfileCard
            user={user}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            updatingProfile={updatingProfile}
            onSubmit={handleUpdateProfile}
            roleLabel="OWNER"
            roleClassName="bg-blue-600"
            fallbackName="ผู้บริหารระบบ"
            fallbackInitials="US"
            onPasswordResetEmailSent={onPasswordResetEmailSent}
          />
        )}

        {activeTab === 'staff' && <StaffManagement />}
        {activeTab === 'customers' && <CustomerManagement />}
        {activeTab === 'lanes' && (
          <LaneManagement
            userData={userData}
            onCheckoutBooking={(bookingId) => {
              setCheckoutBookingId(bookingId);
              setActiveTab('payment');
            }}
          />
        )}
        {activeTab === 'bookingHistory' && <BookingHistoryManagement />}
        {activeTab === 'payment' && (
          <PaymentManager
            user={user}
            userData={userData}
            initialBookingId={checkoutBookingId}
            onInitialBookingHandled={() => setCheckoutBookingId(null)}
          />
        )}
        {activeTab === 'closures' && <ShopClosureManagement />}  
        {activeTab === 'clubs' && <ClubManagement />}
        {activeTab === 'settings' && <SystemSettings />}
        {activeTab === 'reviews' && <ReviewManagement canManageReviews />}
        </div>
      </div>
    </div>
  );
}

export default OwnerDashboard;
