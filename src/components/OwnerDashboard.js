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

function OwnerDashboard({ user, userData, handleLogout }) { 
  const rawRole = userData?.Role || userData?.role || '';
  const role = rawRole.trim().toLowerCase();

  const [activeTab, setActiveTab] = useState('staff');
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
    if (profileForm.PhoneNumber.length !== 10) {
      alert("กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก");
      return;
    }

    setUpdatingProfile(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        FullName: profileForm.FullName.trim(),
        PhoneNumber: profileForm.PhoneNumber
      });
      alert("บันทึกการแก้ไขข้อมูลส่วนตัวสำเร็จเรียบร้อยแล้ว");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const navItems = [
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

  const activeTitle = navItems.find(item => item.id === activeTab)?.title || 'Dashboard';

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans">
      {/* --- SIDEBAR --- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-950/95 text-white p-2 shadow-2xl border-t border-emerald-800/70 md:static md:w-72 md:bg-emerald-900 md:p-6 md:border-t-0 md:flex md:flex-col md:justify-between">
        <div>
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
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 p-4 pb-28 md:p-10 md:pb-10 overflow-y-auto flex flex-col justify-start">
        <header className="mb-6 md:mb-10 flex justify-between items-center gap-3 w-full [&>button:last-child]:hidden">
          <h1 className="text-xl md:text-3xl font-black text-slate-800 uppercase leading-tight">
            <span className="sr-only">{activeTitle}</span>
            {activeTab === 'profile' ? 'My Account Profile' :
             activeTab === 'staff' ? 'PERSONNEL Management' : 
             activeTab === 'customers' ? 'Customer Management' : 
             activeTab === 'lanes' ? 'Lane Management' :
             activeTab === 'bookingHistory' ? 'Booking History' :
             activeTab === 'payment' ? 'Payment Management' :
             activeTab === 'closures' ? 'Shop Closure Management' :
             activeTab === 'clubs' ? 'Club Management' : 
             activeTab === 'settings' ? 'System Settings' : 'Review Management'}
          </h1>
          <button onClick={handleLogout} className="shrink-0 text-sm font-bold text-red-500 bg-red-50 px-3 md:px-4 py-2 rounded-xl hover:bg-red-100 transition-all shadow-sm flex items-center gap-2">
            <NavIcon name="logOut" className="w-4 h-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
          <button onClick={handleLogout} className="text-sm font-bold text-red-500 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-all shadow-sm">ออกจากระบบ</button>
        </header>

        {/* หน้าโปรไฟล์ดีไซน์กึ่งกลางสมมาตรไร้อีโมจิ */}
        {activeTab === 'profile' && (
          <div className="w-full max-w-4xl mx-auto my-auto bg-white rounded-[2rem] border border-slate-200/80 shadow-md overflow-hidden flex flex-col md:flex-row text-left animate-fadeIn">
            <div className="md:w-1/3 bg-slate-50 p-5 sm:p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200/60">
              <div className="w-24 h-24 bg-emerald-50 text-emerald-800 rounded-full flex items-center justify-center text-2xl font-black mb-4 border border-emerald-100/70 shadow-inner">
                {profileForm.FullName ? profileForm.FullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'US'}
              </div>
              <h3 className="text-lg font-black text-slate-800 truncate max-w-full">{profileForm.FullName || 'ผู้บริหารระบบ'}</h3>
              <p className="text-xs text-slate-400 font-medium font-mono truncate max-w-full mt-0.5">{user?.email}</p>
              <div className="mt-4">
                <span className="inline-block bg-blue-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">OWNER</span>
              </div>
            </div>
            <div className="md:w-2/3 p-5 sm:p-8 flex flex-col justify-between">
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-base font-black text-slate-800">ข้อมูลรายละเอียดบัญชี</h3>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">อีเมลประจำบัญชี (ไม่สามารถแก้ไขได้)</label>
                  <input type="email" value={user?.email || ''} disabled className="w-full bg-slate-100 border p-3 rounded-xl text-sm font-semibold text-slate-400 font-mono cursor-not-allowed focus:outline-none" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ชื่อจริง - นามสกุล</label>
                    <input type="text" value={profileForm.FullName} onChange={(e) => setProfileForm({ ...profileForm, FullName: e.target.value })} placeholder="กรอกชื่อและนามสกุลจริง" className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500 transition-all shadow-2xs" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">เบอร์โทรศัพท์ติดต่อ (10 หลัก)</label>
                    <input type="text" value={profileForm.PhoneNumber} maxLength={10} onChange={(e) => setProfileForm({ ...profileForm, PhoneNumber: e.target.value.replace(/\D/g, '') })} placeholder="กรอกเบอร์โทรศัพท์" className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-700 font-mono focus:outline-none focus:border-emerald-500 transition-all shadow-2xs" required />
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button type="submit" disabled={updatingProfile} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-8 rounded-xl text-sm shadow transition-all active:scale-95 disabled:bg-slate-300">
                    {updatingProfile ? 'กำลังบันทึกข้อมูล...' : 'บันทึกการเปลี่ยนแปลง'}
                  </button>
                </div>
              </form>
            </div>
          </div>
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
            initialBookingId={checkoutBookingId}
            onInitialBookingHandled={() => setCheckoutBookingId(null)}
          />
        )}
        {activeTab === 'closures' && <ShopClosureManagement />}  
        {activeTab === 'clubs' && <ClubManagement />}
        {activeTab === 'settings' && <SystemSettings />}
        {activeTab === 'reviews' && <ReviewManagement />}
      </div>
    </div>
  );
}

export default OwnerDashboard;
