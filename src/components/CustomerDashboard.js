import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import BookingFlow from './BookingFlow'; 
import { NavIcon, ResponsiveNavButton } from './DashboardNav';

function CustomerDashboard({ user, userData, handleLogout }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [myBookings, setMyBookings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchMyBookings = async () => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'bookings'),
        where('User_ID', '==', user.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setMyBookings(list);
    } catch (error) {
      console.error("Error fetching personal bookings:", error);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchMyBookings();
    }
  }, [activeTab]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;

    setSubmittingReview(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        User_ID: user.uid,
        Customer_Name: userData?.FullName || userData?.fullName || 'สมาชิกไม่ระบุชื่อ',
        Email: user.email,
        Rating: Number(reviewRating),
        Comment: reviewComment.trim(),
        Review_Date: serverTimestamp()
      });

      alert("ขอบคุณสำหรับคะแนนและความคิดเห็นที่มีให้ทางสนามครับ");
      setReviewComment('');
      setReviewRating(5);
      setActiveTab('profile'); 
    } catch (error) {
      alert("ไม่สามารถส่งรีวิวได้: " + error.message);
    }
    setSubmittingReview(false);
  };

  const navItems = [
    { id: 'profile', label: 'ข้อมูลโปรไฟล์ของฉัน', icon: 'user' },
    { id: 'booking', label: 'จองสนามซ้อมออนไลน์', icon: 'booking' },
    { id: 'history', label: 'ประวัติการจองของฉัน', icon: 'history' },
    { id: 'writereview', label: 'ให้คะแนนและรีวิวสนาม', icon: 'star' },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans">
      {/* --- SIDEBAR (ถอดดีไซน์สีและ Layout มาจาก OwnerDashboard) --- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-950/95 text-white p-2 shadow-2xl border-t border-emerald-800/70 md:static md:w-72 md:bg-emerald-900 md:p-6 md:border-t-0 md:flex md:flex-col md:justify-between">
        <div>
          <h2 className="hidden md:block text-xl font-black mb-4 tracking-tighter">MLG MEMBER</h2>
          
          {/* บล็อกแสดงข้อมูลผู้เข้าใช้งานและแต้มสะสม */}
          <div className="hidden md:block mb-6 p-4 bg-emerald-950/40 rounded-2xl border border-emerald-800/50 text-left">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              แต้มสะสมของคุณ
            </div>
            <div className="text-3xl font-black text-amber-400 mt-1">
              {userData?.Points_Balance ?? userData?.points_balance ?? 0} <span className="text-xs text-white font-bold">PTS</span>
            </div>
            <div className="text-[10px] text-slate-300 font-bold truncate mt-2">
              คุณ {userData?.FullName || userData?.fullName || 'สมาชิก'}
            </div>
            <div className="mt-2.5">
              <span className="inline-block bg-amber-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                MEMBER
              </span>
            </div>
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
            <button onClick={() => setActiveTab('profile')} 
              className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'profile' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              ข้อมูลโปรไฟล์ของฉัน
            </button>
            <button onClick={() => setActiveTab('booking')} 
              className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'booking' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              จองสนามซ้อมออนไลน์
            </button>
            <button onClick={() => setActiveTab('history')} 
              className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'history' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              ประวัติการจองของฉัน
            </button>
            <button onClick={() => setActiveTab('writereview')} 
              className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'writereview' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              ให้คะแนนและรีวิวสนาม
            </button>
          </nav>
        </div>
      </div>

      {/* --- MAIN CONTENT (โครงสร้างตรงกับหน้าหลักแอดมิน) --- */}
      <div className="flex-1 p-4 pb-28 md:p-10 md:pb-10 overflow-y-auto">
        <header className="mb-6 md:mb-10 flex justify-between items-center gap-3 [&>button:last-child]:hidden">
          <h1 className="text-xl md:text-3xl font-black text-slate-800 uppercase leading-tight">
            {activeTab === 'profile' ? 'My Profile' : 
             activeTab === 'booking' ? 'Online Booking' : 
             activeTab === 'history' ? 'Booking History' : 'Write a Review'}
          </h1>
          <button 
            onClick={handleLogout} 
            className="shrink-0 text-sm font-bold text-red-500 bg-red-50 px-3 md:px-4 py-2 rounded-xl hover:bg-red-100 transition-all shadow-sm flex items-center gap-2"
          >
            <NavIcon name="logOut" className="w-4 h-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
          
          <button 
            onClick={handleLogout} 
            className="text-sm font-bold text-red-500 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-all shadow-sm"
          >
            ออกจากระบบ
          </button>
        </header>
        
        {/* TAB 1: ข้อมูลหน้าโปรไฟล์สมาชิก */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-100 text-left animate-fadeIn">
            <h2 className="text-2xl font-black text-slate-800 mb-6">ข้อมูลบัญชีผู้ใช้งาน</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border">
                  <span className="block text-xs font-bold text-slate-400 uppercase">ชื่อ-นามสกุลสมาชิก</span>
                  <span className="text-base font-black text-slate-700 mt-1 block">{userData?.FullName || userData?.fullName || 'ไม่ได้ระบุ'}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border">
                  <span className="block text-xs font-bold text-slate-400 uppercase">เบอร์โทรศัพท์ติดต่อ</span>
                  <span className="text-base font-black text-slate-700 mt-1 block">{userData?.PhoneNumber || userData?.phone || 'ไม่ได้ระบุ'}</span>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border">
                <span className="block text-xs font-bold text-slate-400 uppercase">อีเมลแอดเดรส</span>
                <span className="text-base font-black text-slate-700 mt-1 block">{user?.email}</span>
              </div>
              <div className="bg-amber-50/50 border border-amber-200 p-5 rounded-2xl mt-6">
                <h4 className="text-sm font-black text-amber-900 mb-1">สิทธิประโยชน์ของแต้มสะสม</h4>
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  ทุกๆ การใช้บริการหน้าร้าน ค่านับถาดลูกกอล์ฟ และค่าเช่าอุปกรณ์จะถูกนำมาคำนวณแปลงเป็นแต้มสะสมประจำบัญชีของคุณ โดยสามารถนำแต้มมาใช้แลกเป็นส่วนลดเงินสดแทนการจ่ายเงินจริงได้ที่หน้าเคาน์เตอร์คิดเงินพนักงานครับ
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: หน้าต่างทำรายการจองสนาม */}
        {activeTab === 'booking' && (
          <div className="bg-white rounded-3xl p-3 sm:p-6 shadow-sm border border-slate-100 animate-fadeIn">
            <BookingFlow />
          </div>
        )}

        {/* TAB 3: หน้าแสดงประวัติและสถานะคิวการจองของตนเอง */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl p-3 sm:p-6 shadow-sm border border-slate-100 text-left animate-fadeIn">
            <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight">ประวัติคิวการจองซ้อมของคุณ</h2>
            
            {loadingHistory ? (
              <p className="text-center py-10 text-slate-400 font-bold">กำลังดึงข้อมูลตารางเวลาของคุณ...</p>
            ) : myBookings.length === 0 ? (
              <div className="text-center py-14 text-slate-400 border border-dashed rounded-2xl italic font-bold">
                คุณยังไม่มีประวัติการทำรายการจองเลนในระบบขณะนี้
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm border-collapse">
                  <thead>
                    <tr className="text-slate-400 text-xs font-black uppercase border-b border-slate-200">
                      <th className="py-3 px-2">วันที่เข้าใช้</th>
                      <th>ตำแหน่งเลน</th>
                      <th>ช่วงเวลาซ้อม</th>
                      <th>บริการผู้สอน</th>
                      <th className="text-center">สถานะบิลคิว</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold text-slate-600 text-xs">
                    {myBookings.map((b) => (
                      <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-4 px-2 text-slate-800">{b.bookingDate}</td>
                        <td className="text-indigo-600">เลน {b.selectedLanes?.join(', ') || b.laneNumber}</td>
                        <td className="text-slate-500 font-medium">{b.timeSlots?.join(', ')}</td>
                        <td>{b.needsInstructor ? 'ต้องการโปรผู้สอน' : 'ไม่มี'}</td>
                        <td className="text-center">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase ${
                            b.status === 'pending' ? 'bg-slate-100 text-slate-500' :
                            b.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            b.status === 'occupied' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                            b.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {b.status === 'pending' ? 'รอตรวจสอบ' :
                             b.status === 'confirmed' ? 'ยืนยันจองแล้ว' :
                             b.status === 'occupied' ? 'กำลังใช้บริการ' :
                             b.status === 'completed' ? 'เสร็จสิ้นรายการ' : 'ถูกยกเลิก'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: หน้าจอให้คะแนนและเขียนข้อความรีวิว */}
        {activeTab === 'writereview' && (
          <div className="max-w-xl bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-100 text-left animate-fadeIn">
            <h2 className="text-2xl font-black text-slate-800 mb-2">เขียนรีวิวและความคิดเห็น</h2>
            <p className="text-xs text-slate-400 mb-6">ความคิดเห็นของคุณจะส่งตรงไปที่หน้าแดชบอร์ดบริหารของเจ้าของร้านเพื่อนำไปปรับปรุงบริการ</p>
            
            <form onSubmit={handleSubmitReview} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ระดับความพึงพอใจการเข้าใช้บริการ</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setReviewRating(num)}
                      className={`w-12 h-11 rounded-xl text-xs font-black transition-all border ${
                        reviewRating >= num 
                          ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-inner' 
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {num} ดาว
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">พิมพ์ข้อความเสนอแนะหรือคำชมเชย</label>
                <textarea
                  rows="4"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="พิมพ์ข้อความของคุณตรงนี้..."
                  className="w-full bg-slate-100 p-4 rounded-2xl text-sm font-bold focus:outline-none border focus:border-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-sm shadow transition-all active:scale-95"
              >
                {submittingReview ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลรีวิวสู่ระบบ'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default CustomerDashboard;
