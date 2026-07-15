import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { theme } from '../styles/theme';
import Popup from './Popup';

function ReviewManagement({ publicView = false, canManageReviews = false }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryStats, setSummaryStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });

  // State สำหรับควบคุมระบบแจ้งเตือนสากลผ่าน Popup คอมโพเนนต์ประจำร้าน
  const [alertPopup, setAlertPopup] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  const s = theme.admin;

  const getReviewRating = (review) => Number(review.rating ?? review.Rating ?? 0);
  const getReviewComment = (review) => review.comment || review.Comment || '';
  const getReviewCustomerName = (review) => review.customerName || review.Customer_Name || 'ไม่ระบุชื่อ';
  const getReviewDate = (review) => {
    const value = review.createdAt || review.Review_Date || review.reviewDate;
    if (!value) return null;
    const date = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  useEffect(() => {
    // ดึงข้อมูลคะแนนและความคิดเห็นแบบ realtime และเรียงลำดับจากล่าสุดลงไป
    const reviewsRef = collection(db, "reviews");

    const unsubscribe = onSnapshot(reviewsRef, (snapshot) => {
      const reviewList = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((review) => (
          review.Is_Active !== false &&
          review.isActive !== false &&
          review.Review_Status !== 'voided_payment' &&
          review.reviewStatus !== 'voided_payment'
        ))
        .sort((a, b) => {
          const aDate = getReviewDate(a);
          const bDate = getReviewDate(b);
          return (bDate?.getTime?.() || 0) - (aDate?.getTime?.() || 0);
        });
      
      setReviews(reviewList);
      calculateStats(reviewList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reviews: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ฟังก์ชันคำนวณค่าสถิติคะแนนเฉลี่ยภายในระบบ
  const calculateStats = (reviewList) => {
    if (reviewList.length === 0) {
      setSummaryStats({
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      });
      return;
    }

    const total = reviewList.length;
    let sum = 0;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviewList.forEach(rev => {
      const rawRating = getReviewRating(rev);
      const rating = Math.round(rawRating) || 5;
      sum += rawRating;
      if (distribution[rating] !== undefined) {
        distribution[rating] += 1;
      }
    });

    setSummaryStats({
      averageRating: (sum / total).toFixed(1),
      totalReviews: total,
      ratingDistribution: distribution
    });
  };

  // ฟังก์ชันลบคะแนนและความคิดเห็น (กรองสแปม)
  const handleDeleteReview = (id, customerName) => {
    setAlertPopup({
      isOpen: true,
      type: 'danger',
      title: 'ยืนยันการลบความคิดเห็น',
      message: `คุณต้องการลบข้อมูลความคิดเห็นของคุณ ${customerName || 'ลูกค้า'} ออกจากระบบอย่างถาวรใช่หรือไม่?`,
      onCancel: () => setAlertPopup(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, "reviews", id), {
            Is_Active: false,
            isActive: false,
            Review_Status: 'deleted_by_shop',
            reviewStatus: 'deleted_by_shop',
            Hidden_Reason: 'shop_removed_review',
            hiddenReason: 'shop_removed_review',
            Deleted_At: serverTimestamp()
          });
          setAlertPopup({
            isOpen: true,
            type: 'info',
            title: 'ดำเนินการสำเร็จ',
            message: 'ลบข้อมูลความคิดเห็นและคะแนนความพึงพอใจเรียบร้อยแล้ว',
            onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
          });
        } catch (error) {
          setAlertPopup({
            isOpen: true,
            type: 'danger',
            title: 'เกิดข้อผิดพลาด',
            message: 'ไม่สามารถลบข้อมูลได้เนื่องจาก: ' + error.message,
            onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
          });
        }
      }
    });
  };

  if (loading) return <div className="text-center py-10 font-bold text-slate-500">กำลังโหลดข้อมูลคะแนนและความคิดเห็น...</div>;

  return (
    <div className="w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left font-sans shadow-sm relative select-none sm:p-8">
      
      {/* ส่วนหัวแสดงชื่อโมดูล */}
      <div className="border-b border-slate-200 pb-4 mb-6">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          {publicView ? 'คะแนนและความคิดเห็นจากลูกค้า' : 'ระบบตรวจสอบคะแนนและความคิดเห็น'}
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          {publicView
            ? 'ตรวจสอบคะแนนความพึงพอใจและความคิดเห็นจากผู้ใช้บริการก่อนตัดสินใจจองเลนซ้อม'
            : 'สรุปข้อมูลความพึงพอใจของลูกค้าเพื่อนำไปใช้วิเคราะห์คุณภาพบริการและกรองความคิดเห็นสแปม'}
        </p>
      </div>

      {/* แดชบอร์ดสรุปสถิติคะแนนเฉลี่ย */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 bg-slate-50 p-4 sm:p-6 rounded-3xl border border-slate-200">
        <div className="flex flex-col justify-center items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">คะแนนความพึงพอใจเฉลี่ย</span>
          <span className="text-5xl font-black text-slate-800 mt-2">{summaryStats.averageRating}</span>
          <span className="text-xs font-bold text-amber-500 mt-2">คะแนนเต็ม 5.0 คะแนน</span>
        </div>

        <div className="md:col-span-2 space-y-2 flex flex-col justify-center">
          <div className="text-sm font-bold text-slate-500 mb-2">
            จำนวนความคิดเห็นทั้งหมด: <span className="text-indigo-600 font-black">{summaryStats.totalReviews}</span> รายการ
          </div>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = summaryStats.ratingDistribution[stars];
            const percentage = summaryStats.totalReviews > 0 ? (count / summaryStats.totalReviews) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <span className="w-16">{stars} คะแนน</span>
                <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                </div>
                <span className="w-12 text-right">{count} รายการ</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ตารางแสดงรายการความคิดเห็นและคะแนนบริการ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="w-full min-w-[820px] text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-400 text-xs font-bold uppercase">
              <th className="p-4 w-48">ข้อมูลลูกค้า</th>
              <th className="p-4 w-32">คะแนนที่ให้</th>
              <th className="p-4">ข้อเสนอแนะและความคิดเห็น</th>
              {canManageReviews && <th className="p-4 text-right w-28">การจัดการ</th>}
            </tr>
          </thead>
          <tbody className="text-slate-600 text-sm font-medium">
            {reviews.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all items-center">
                <td className="p-4">
                  <div className="font-bold text-slate-800 truncate max-w-[180px]">{getReviewCustomerName(item)}</div>
                  <div className="text-slate-400 text-[11px] font-bold mt-0.5">
                    {getReviewDate(item) ? getReviewDate(item).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : "ทั่วไป"}
                  </div>
                </td>
                <td className="p-4">
                  <span className="inline-block px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 font-black text-xs rounded-lg">
                    {getReviewRating(item)} / 5
                  </span>
                </td>
                <td className="p-4 whitespace-pre-line text-slate-700 leading-relaxed font-semibold">
                  {getReviewComment(item) ? getReviewComment(item) : <span className="text-slate-400 italic font-normal">ลูกค้าไม่ได้เขียนระบุข้อความประกอบ</span>}
                </td>
                {canManageReviews && (
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleDeleteReview(item.id, getReviewCustomerName(item))} 
                      className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-black rounded-lg hover:bg-red-100 border border-red-200 transition-colors"
                    >
                      ลบความคิดเห็น
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr>
                <td colSpan={canManageReviews ? 4 : 3} className="text-center py-12 text-slate-400 italic">ไม่มีข้อมูลคะแนนและความคิดเห็นภายในระบบขณะนี้</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* หน้าต่าง Custom Popup แสดงกล่องข้อความเตือนการลบสแปมของระบบ */}
      <Popup 
        isOpen={alertPopup.isOpen} 
        type={alertPopup.type} 
        title={alertPopup.title} 
        message={alertPopup.message} 
        onConfirm={alertPopup.onConfirm} 
        onCancel={alertPopup.onCancel} 
      />
    </div>
  );
}

export default ReviewManagement;
