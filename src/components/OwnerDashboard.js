import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import StaffManagement from './StaffManagement';
import ClubManagement from './ClubManagement';
import CustomerManagement from './CustomerManagement'; 
import LaneManagement from './LaneManagement';
import SystemSettings from './SystemSettings';
import ShopClosureManagement from './ShopClosureManagement'; 
import PaymentManager from './PaymentManager'; 
import ReviewManagement from './ReviewManagement'; 
import BookingHistoryManagement from './BookingHistoryManagement';
import { NavIcon, ResponsiveNavButton, SidebarIdentityPanel } from './DashboardNav';
import AccountProfileCard from './AccountProfileCard';
import DashboardHome from './DashboardHome';
import BillingRequestNotifier from './BillingRequestNotifier';
import { normalizePhoneNumber } from '../utils/userPhoneUtils';
import { isContactError, saveUserProfileWithContactRegistry } from '../utils/contactRegistryUtils';

function OwnerDashboard({ user, userData, handleLogout, onPasswordResetEmailSent }) { 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [checkoutBookingId, setCheckoutBookingId] = useState(null);
  const [profileForm, setProfileForm] = useState({ FullName: '', PhoneNumber: '' });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      window.appAlert("กรุณากรอกชื่อ-นามสกุลจริง");
      return;
    }
    const normalizedPhone = normalizePhoneNumber(profileForm.PhoneNumber);
    if (normalizedPhone.length !== 10) {
      window.appAlert("กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก");
      return;
    }

    setUpdatingProfile(true);
    try {
      await saveUserProfileWithContactRegistry(db, user.uid, {
        FullName: profileForm.FullName.trim(),
        PhoneNumber: normalizedPhone
      });
      window.appAlert("บันทึกการแก้ไขข้อมูลส่วนตัวสำเร็จเรียบร้อยแล้ว");
    } catch (error) {
      if (isContactError(error)) {
        window.appAlert(error.message);
        return;
      }
      window.appAlert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
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
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 ${mobileMenuOpen ? 'max-h-[82dvh] overflow-y-auto' : 'overflow-hidden'} bg-emerald-950 text-white p-2 shadow-2xl border-t border-emerald-800/70 transition-all duration-300 md:inset-y-0 md:right-auto md:h-dvh md:max-h-none md:shrink-0 md:overflow-y-auto md:p-5 md:border-t-0 md:flex md:flex-col md:justify-between ${sidebarCollapsed ? 'md:w-24' : 'md:w-72'}`}
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(2,44,34,0.88), rgba(2,44,34,0.72), rgba(2,44,34,0.84)), url('/sidebar-cover-v2.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'local'
        }}
      >
        <div className="relative z-10">
          <SidebarIdentityPanel
            collapsed={sidebarCollapsed}
            title="MLG Owner"
            name={userData?.FullName || userData?.fullName || 'ไม่ระบุชื่อ'}
            email={user?.email}
            accent="owner"
            fallbackInitials="OW"
            onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          />

          <nav className={`${mobileMenuOpen ? 'grid grid-cols-1 gap-2 pb-2' : 'flex gap-2 overflow-x-auto pb-1'} md:flex md:flex-col md:overflow-visible md:pb-0`}>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              title={mobileMenuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              aria-label={mobileMenuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              className={`${mobileMenuOpen ? 'w-full flex-row justify-start gap-3' : 'min-w-[58px] flex-col justify-center gap-1.5'} flex h-14 items-center rounded-2xl bg-white/10 px-3 py-2 font-bold text-white transition-all hover:bg-white/20 md:hidden`}
            >
              <NavIcon name={mobileMenuOpen ? 'close' : 'menu'} className="h-5 w-5 shrink-0" />
              {mobileMenuOpen && <span>เมนูทั้งหมด</span>}
            </button>
            {navItems.map(item => (
              <ResponsiveNavButton
                key={item.id}
                active={activeTab === item.id}
                icon={item.icon}
                label={item.label}
                collapsed={sidebarCollapsed}
                mobileExpanded={mobileMenuOpen}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
              />
            ))}
            <button
              type="button"
              onClick={handleLogout}
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className={`${mobileMenuOpen ? 'w-full flex-row justify-start gap-3' : 'min-w-[58px] flex-col justify-center gap-1.5'} flex h-14 items-center rounded-2xl px-3 py-2 font-bold text-rose-100 transition-all hover:bg-rose-900/40 hover:text-white md:hidden`}
            >
              <NavIcon name="logOut" className="h-5 w-5 shrink-0" />
              {mobileMenuOpen && <span>ออกจากระบบ</span>}
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
            {!sidebarCollapsed && <span>ออกจากระบบ</span>}
          </button>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className={`min-w-0 flex-1 p-4 ${mobileMenuOpen ? 'pb-[31rem]' : 'pb-28'} mobile-safe-bottom transition-all duration-300 md:p-10 md:pb-10 overflow-y-auto flex flex-col justify-start ${sidebarCollapsed ? 'md:ml-24' : 'md:ml-72'}`}>
        <BillingRequestNotifier
          onOpenPayment={(bookingId) => {
            setCheckoutBookingId(bookingId);
            setActiveTab('payment');
          }}
        />
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
