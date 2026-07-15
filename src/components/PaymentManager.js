import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, orderBy, Timestamp, increment } from 'firebase/firestore';
import Popup from './Popup'; 
import LanePaymentModal from './LanePaymentModal';
import OtherIncomeModal from './OtherIncomeModal';
import { NavIcon } from './DashboardNav';
import { toWholeNumber } from '../utils/numberUtils';

const getCheckoutTarget = (value) => (
  typeof value === 'object' && value !== null
    ? value
    : { bookingId: value }
);

function PaymentManager({ user = null, userData = null, initialBookingId = null, onInitialBookingHandled = null }) {
  const [activeLanes, setActiveLanes] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clubInventory, setClubInventory] = useState([]);
  const [historyDate, setHistoryDate] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    return new Date(today.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
  });

  // เรตราคากลางจากฐานข้อมูล service_settings
  const [clubPriceRate, setClubPriceRate] = useState(20); 
  const [ballPriceRate, setBallPriceRate] = useState(30); 
  const [penaltyPriceRate, setPenaltyPriceRate] = useState(50); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isOtherIncomeModalOpen, setIsOtherIncomeModalOpen] = useState(false);
  const [voidConfirmTargetId, setVoidConfirmTargetId] = useState(null);
  const [voidReasonTarget, setVoidReasonTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidReasonError, setVoidReasonError] = useState('');
  const [alertPopup, setAlertPopup] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

  const historyDateLabel = new Date(`${historyDate}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const selectedPaymentDateLabel = selectedPayment?.Payment_Date?.toDate
    ? selectedPayment.Payment_Date.toDate().toLocaleString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-';
  const selectedPaymentNeedsInstructor = Boolean(
    selectedPayment?.Needs_Instructor ?? selectedPayment?.needsInstructor
  );
  const selectedPaymentNeedsClubRent =
    typeof (selectedPayment?.Needs_Club_Rent ?? selectedPayment?.needsClubRent) === 'boolean'
      ? Boolean(selectedPayment?.Needs_Club_Rent ?? selectedPayment?.needsClubRent)
      : Array.isArray(selectedPayment?.Rented_Clubs) && selectedPayment.Rented_Clubs.length > 0;
  const cashierInfo = {
    id: user?.uid || '',
    name: userData?.FullName || userData?.fullName || user?.displayName || user?.email || 'ไม่ระบุชื่อผู้รับชำระ',
    role: userData?.Role || userData?.role || 'staff',
    email: user?.email || userData?.Email || userData?.email || ''
  };
  const getCashierLabel = (payment) => {
    const name = payment?.Cashier_Name || payment?.cashierName || payment?.Processed_By_Name || '';
    const role = payment?.Cashier_Role || payment?.cashierRole || payment?.Processed_By_Role || '';
    if (!name && !role) return 'ไม่ระบุผู้รับชำระ';
    return `${name || 'ไม่ระบุชื่อ'}${role ? ` (${String(role).toUpperCase()})` : ''}`;
  };
  const getPaymentNote = (payment) => (
    payment?.Cancel_Reason ||
    payment?.cancelReason ||
    payment?.Description ||
    payment?.description ||
    ''
  );
  const getPaymentTimeLabel = (payment) => {
    const timeSlots = payment?.Time_Slots || payment?.timeSlots || payment?.TimeSlots || [];
    if (Array.isArray(timeSlots) && timeSlots.length > 0) {
      return timeSlots.join(', ');
    }
    if (typeof timeSlots === 'string' && timeSlots.trim()) {
      return timeSlots;
    }
    return '-';
  };

  const getLaneSortNumber = (value) => {
    if (Array.isArray(value)) {
      const laneNumbers = value
        .map((lane) => Number(String(lane).match(/\d+/)?.[0]))
        .filter(Number.isFinite);
      return laneNumbers.length > 0 ? Math.min(...laneNumbers) : Number.MAX_SAFE_INTEGER;
    }

    const laneNumber = Number(String(value || '').match(/\d+/)?.[0]);
    return Number.isFinite(laneNumber) ? laneNumber : Number.MAX_SAFE_INTEGER;
  };

  const getBookingLaneLabel = (booking) => (
    Array.isArray(booking.checkoutLaneNumbers) && booking.checkoutLaneNumbers.length > 0
      ? booking.checkoutLaneNumbers.map((lane) => `เลน ${lane}`).join(', ')
      : booking.checkoutLaneNumber
        ? `เลน ${booking.checkoutLaneNumber}`
        : booking.selectedLanes?.length
          ? booking.selectedLanes.map((lane) => `เลน ${lane}`).join(', ')
          : booking.Lane_Code || booking.laneNumber || booking.laneCode || 'ไม่ระบุเลน'
  );

  const getBookingLaneSortValue = (booking) => getLaneSortNumber(
    booking.selectedLanes?.length ? booking.selectedLanes : (booking.Lane_Code || booking.laneNumber || booking.laneCode)
  );

  const getPaymentLaneSortValue = (payment) => getLaneSortNumber(
    payment.Lane_Code || payment.laneCode || payment.laneNumber
  );

  const sortedActiveLanes = [...activeLanes].sort((a, b) => (
    getBookingLaneSortValue(a) - getBookingLaneSortValue(b) ||
    getBookingLaneLabel(a).localeCompare(getBookingLaneLabel(b), ['th', 'en'], { numeric: true, sensitivity: 'base' })
  ));

  const getPaymentSortTime = (payment) => {
    const dateValue = payment.Payment_Date || payment.createdAt || payment.Updated_At;
    const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue || 0);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const sortedHistory = [...history].sort((a, b) => (
    getPaymentSortTime(b) - getPaymentSortTime(a) ||
    getPaymentLaneSortValue(a) - getPaymentLaneSortValue(b)
  ));

  useEffect(() => {
    // 1. ดึงข้อมูลเลนที่กำลังใช้งานอยู่จริง
    const unsubscribeBookings = onSnapshot(query(collection(db, 'bookings'), where('status', '==', 'occupied')), (snapshot) => {
      setActiveLanes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // 3. ดึงราคากลางจาก service_settings
    const unsubscribeSettings = onSnapshot(query(collection(db, "service_settings"), where("Is_Active", "==", true)), (snapshot) => {
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const name = data.Service_Name || "";
        const rate = toWholeNumber(data.Price_Rate || 0);
        if (name.includes("ไม้กอล์ฟ") || name.includes("Club")) setClubPriceRate(rate);
        else if (name.includes("ลูกกอล์ฟ") || name.includes("ถาด") || name.includes("Ball")) setBallPriceRate(rate);
        else if (name.includes("ค่าปรับ") || name.includes("เสียหาย") || name.includes("Penalty")) setPenaltyPriceRate(rate);
      });
    });

    // 4. ดึงคลังไม้กอล์ฟหลัก
    const unsubscribeClubs = onSnapshot(collection(db, "golf_clubs"), (snapshot) => {
      setClubInventory(snapshot.docs.map(d => ({ id: d.id, name: d.data().Club_Name || "ไม่มีชื่ออุปกรณ์", price: clubPriceRate })));
    });

    return () => {
      unsubscribeBookings();
      unsubscribeClubs();
      unsubscribeSettings();
    };
  }, [clubPriceRate]); 

  useEffect(() => {
    const [year, month, day] = historyDate.split('-').map(Number);
    const startOfDay = Timestamp.fromDate(new Date(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = Timestamp.fromDate(new Date(year, month - 1, day, 23, 59, 59, 999));

    const paymentsQuery = query(
      collection(db, 'payments'),
      where('Payment_Date', '>=', startOfDay),
      where('Payment_Date', '<=', endOfDay),
      orderBy('Payment_Date', 'desc')
    );

    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribePayments();
  }, [historyDate]);

  useEffect(() => {
    if (!initialBookingId || activeLanes.length === 0) return;

    const target = getCheckoutTarget(initialBookingId);
    const matchedBooking = activeLanes.find((booking) => booking.id === target.bookingId);
    if (!matchedBooking) return;

    setSelectedBooking({
      ...matchedBooking,
      checkoutLaneNumber: target.laneNumber || null,
      checkoutLaneNumbers: Array.isArray(target.laneNumbers) ? target.laneNumbers : null,
      checkoutSlot: target.slot || null,
      checkoutSlots: Array.isArray(target.slots) ? target.slots : null,
      checkoutEndTime: target.checkoutEndTime || null,
      releaseAllSlotsForLane: Boolean(target.releaseAllSlotsForLane),
      releaseAllSlotsForLanes: Boolean(target.releaseAllSlotsForLanes)
    });
    setIsModalOpen(true);
    if (onInitialBookingHandled) {
      onInitialBookingHandled();
    }
  }, [initialBookingId, activeLanes, onInitialBookingHandled]);

  const handleRequestVoidPayment = (item) => {
    if (item.status === 'cancelled') return;
    setVoidConfirmTargetId(item.id);
    setVoidReasonTarget(item);
    setVoidReason('');
    setVoidReasonError('');
  };

  const closeVoidReasonModal = () => {
    setVoidReasonTarget(null);
    setVoidConfirmTargetId(null);
    setVoidReason('');
    setVoidReasonError('');
  };

  const handleConfirmVoidPayment = async () => {
    const reason = voidReason.trim();
    if (!voidReasonTarget) return;

    if (!reason) {
      setVoidReasonError('กรุณากรอกหมายเหตุการยกเลิกรายการ');
      return;
    }

    try {
      await updateDoc(doc(db, 'payments', voidReasonTarget.id), {
        status: 'cancelled',
        Cancel_Reason: reason,
        cancelReason: reason,
        Cancelled_At: Timestamp.now()
      });

      const paymentUserId = voidReasonTarget.User_ID || voidReasonTarget.userId || '';
      const pointBalanceChange = Number(voidReasonTarget.Point_Balance_Change || 0);
      if (paymentUserId && paymentUserId !== 'walk-in' && pointBalanceChange !== 0) {
        await updateDoc(doc(db, 'users', paymentUserId), {
          Points_Balance: increment(-pointBalanceChange)
        });
      }

      const voidedBookingId = voidReasonTarget.Booking_ID || voidReasonTarget.bookingId || '';
      if (voidedBookingId) {
        const reviewQueries = [
          query(collection(db, 'reviews'), where('Booking_ID', '==', voidedBookingId)),
          query(collection(db, 'reviews'), where('bookingId', '==', voidedBookingId))
        ];
        const reviewSnapshots = await Promise.all(
          reviewQueries.map((reviewQuery) => getDocs(reviewQuery).catch(() => ({ docs: [] })))
        );
        const reviewDocsById = new Map();
        reviewSnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((reviewDoc) => reviewDocsById.set(reviewDoc.id, reviewDoc));
        });

        await Promise.all([...reviewDocsById.values()].map((reviewDoc) => updateDoc(doc(db, 'reviews', reviewDoc.id), {
          Is_Active: false,
          isActive: false,
          Review_Status: 'voided_payment',
          reviewStatus: 'voided_payment',
          Hidden_Reason: 'payment_cancelled',
          hiddenReason: 'payment_cancelled',
          Voided_Payment_ID: voidReasonTarget.id,
          Updated_At: Timestamp.now()
        })));
      }

      closeVoidReasonModal();
      setAlertPopup({
        isOpen: true,
        type: 'info',
        title: 'ยกเลิกรายการเสร็จสิ้น',
        message: 'ระบบดำเนินการยกเลิกบิลและบันทึกหมายเหตุเรียบร้อยแล้ว',
        onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
      });
    } catch (error) {
      setAlertPopup({
        isOpen: true,
        type: 'danger',
        title: 'เกิดข้อผิดพลาด',
        message: error.message,
        onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 font-sans text-slate-800 shadow-sm relative select-none sm:p-8">
      <div className="border-b border-slate-100 pb-4 mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">ระบบจัดการและคิดเงินรายได้หน้าร้าน</h1>
        <button onClick={() => setIsOtherIncomeModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl shadow text-sm transition-all w-full sm:w-auto">
          เพิ่มข้อมูลรายได้ใหม่
        </button>
      </div>

      {/* ลิสต์เลนซ้อมที่กำลังใช้งาน */}
      <div className="mb-8">
        <h3 className="font-bold text-gray-700 mb-4 text-sm text-left">เลนซ้อมที่เปิดบริการขณะนี้</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {sortedActiveLanes.length === 0 ? (
            <div className="col-span-full bg-slate-50 p-10 rounded-2xl text-center text-gray-400 font-bold border border-dashed">ไม่มีเลนสนามที่เปิดใช้งานอยู่ ณ ขณะนี้</div>
          ) : (
            sortedActiveLanes.map((booking) => (
              <div key={booking.id} className="bg-white rounded-2xl shadow-sm p-4 border border-slate-200 flex flex-col items-center">
                <div className="w-24 h-20 bg-slate-100 rounded-xl mb-2 border flex flex-col items-center justify-center p-2 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">ชื่อลูกค้า</p>
                  <p className="text-xs text-emerald-700 font-black truncate max-w-full">{booking.customerName || 'ไม่ระบุชื่อ'}</p>
                </div>
                <span className="text-sm font-black mb-1">เลนซ้อม: {getBookingLaneLabel(booking)}</span>
                <button onClick={() => { setSelectedBooking(booking); setIsModalOpen(true); }} className="w-full mt-2 py-2 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white text-sm shadow-sm transition-all">
                  เรียกคิดเงินชำระบิล
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ตารางประวัติรายได้ 10 รายการล่าสุด */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-left">
        <div className="bg-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-black text-slate-700 text-sm">ประวัติการปิดยอดชำระเงิน</div>
            <div className="text-xs font-bold text-slate-500 mt-1">วันที่แสดง: {historyDateLabel}</div>
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm cursor-pointer hover:border-emerald-400 hover:text-emerald-700 transition-all w-full sm:w-auto">
            <NavIcon name="calendar" className="w-4 h-4 shrink-0" />
            <span>เลือกวันที่ดู</span>
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="min-w-0 bg-transparent outline-none text-slate-700 font-bold"
            />
          </label>
        </div>
        <div className="md:hidden p-3 space-y-3">
          {sortedHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm font-bold">ยังไม่มีประวัติการชำระเงินในวันที่เลือก</div>
          ) : (
            sortedHistory.map((item) => (
              <div key={item.id} className={`rounded-2xl border p-4 space-y-3 ${item.status === 'cancelled' ? 'bg-slate-100 text-slate-400 opacity-75' : voidConfirmTargetId === item.id ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{item.FullName || 'ไม่ระบุชื่อ'}</p>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">{item.Lane_Code || 'ไม่ระบุเลน'}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-full ${item.status === 'cancelled' ? 'bg-slate-200 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                    {item.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'สำเร็จ'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <div className="bg-slate-50 rounded-xl p-2">
                    <span className="block text-slate-400">ยอดรวม</span>
                    <span className="text-slate-700">{toWholeNumber(item.Total_Amount).toLocaleString()} บาท</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2">
                    <span className="block text-slate-400">ยอดสุทธิ</span>
                    <span className="text-emerald-700 font-black">{toWholeNumber(item.Net_Amount).toLocaleString()} บาท</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2">
                    <span className="block text-slate-400">ส่วนลดแต้ม</span>
                    <span className="text-slate-700">{toWholeNumber(item.Point_Discount || 0).toLocaleString()} บาท</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2">
                    <span className="block text-slate-400">ชำระโดย</span>
                    <span className="text-slate-700">{item.Payment_Method || '-'}</span>
                  </div>
                </div>

                {getPaymentNote(item) && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-2 font-medium">{getPaymentNote(item)}</p>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => setSelectedPayment(item)}
                    className="w-full text-xs font-black px-3 py-2 rounded-xl border transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  >
                    ตรวจสอบรายการ
                  </button>
                  <button onClick={() => handleRequestVoidPayment(item)} className={`w-full text-xs font-black px-3 py-2 rounded-xl border transition-all ${item.status === 'cancelled' ? 'text-slate-400 bg-slate-200 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'}`} disabled={item.status === 'cancelled'}>
                    {item.status === 'cancelled' ? 'ยกเลิกบิลเรียบร้อย' : 'ยกเลิกรายการ'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block p-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm border-collapse">
            <thead>
              <tr className="text-gray-400 border-b pb-2 text-xs uppercase font-bold">
                <th className="py-2.5 pl-2">ชื่อลูกค้า</th>
                <th>ตำแหน่งเลน</th>
                <th>ยอดเงินรวม</th>
                <th>ส่วนลดแต้ม</th>
                <th>ชำระเงินสุทธิ</th>
                <th>วิธีชำระเงิน</th>
                {/* เพิ่มหัวตารางคอลัมน์หมายเหตุชี้แจงเพิ่มเติม */}
                <th>หมายเหตุเพิ่มเติม</th>
                <th className="text-right pr-4">การจัดการบิล</th>
              </tr>
            </thead>
            <tbody className="font-medium text-slate-600">
              {sortedHistory.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-10 text-center text-sm font-bold text-slate-400">
                    ยังไม่มีประวัติการชำระเงินในวันที่เลือก
                  </td>
                </tr>
              ) : (
                sortedHistory.map((item) => (
                  <tr key={item.id} className={`border-b last:border-none hover:bg-slate-50 ${item.status === 'cancelled' ? 'bg-slate-100 text-slate-400 line-through opacity-75' : voidConfirmTargetId === item.id ? 'bg-amber-50' : ''}`}>
                    <td className="py-3 font-bold pl-2">{item.FullName || 'ไม่ระบุชื่อ'}</td>
                    <td className="text-xs font-bold text-slate-500">{item.Lane_Code || 'ไม่ระบุเลน'}</td>
                    <td>{toWholeNumber(item.Total_Amount).toLocaleString()} บาท</td>
                    <td>{toWholeNumber(item.Point_Discount || 0).toLocaleString()} บาท</td>
                    <td className={`font-black ${item.status === 'cancelled' ? 'text-slate-400' : 'text-emerald-700'}`}>{toWholeNumber(item.Net_Amount).toLocaleString()} บาท</td>
                    <td><span className="bg-white px-2 py-0.5 rounded-md text-xs font-bold border text-slate-500">{item.Payment_Method}</span></td>
                    
                    <td className="text-xs text-slate-500 max-w-[160px] truncate" title={getPaymentNote(item)}>
                      {getPaymentNote(item) || '-'}
                    </td>

                    <td className="py-2 text-right pr-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedPayment(item)}
                          className="text-xs font-black px-3 py-1 rounded-lg border transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        >
                          ตรวจสอบรายการ
                        </button>
                        <button onClick={() => handleRequestVoidPayment(item)} className={`text-xs font-black px-3 py-1 rounded-lg border transition-all ${item.status === 'cancelled' ? 'text-slate-400 bg-slate-200 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'}`} disabled={item.status === 'cancelled'}>
                          {item.status === 'cancelled' ? 'ยกเลิกบิลเรียบร้อย' : 'ยกเลิกรายการ'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* เรียกใช้งาน Sub-components แยกไฟล์ออกไป */}
      {isModalOpen && (
        <LanePaymentModal 
          booking={selectedBooking} onClose={() => setIsModalOpen(false)} 
          rates={{ club: clubPriceRate, ball: ballPriceRate, penalty: penaltyPriceRate }} setAlert={setAlertPopup}
          cashierInfo={cashierInfo}
        />
      )}
      {isOtherIncomeModalOpen && (
        <OtherIncomeModal 
          isOpen={isOtherIncomeModalOpen} onClose={() => setIsOtherIncomeModalOpen(false)} 
          clubInventory={clubInventory} setAlert={setAlertPopup}
          cashierInfo={cashierInfo}
        />
      )}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-sm modal-overlay-transition sm:items-center sm:p-4">
          <div className="modal-card-transition flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#fcfcfb] text-left shadow-2xl">
            <div className="shrink-0 border-b border-slate-200 bg-white/95 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900">ตรวจสอบรายการปิดยอดชำระเงิน</h3>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black border ${
                      selectedPayment.status === 'cancelled'
                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {selectedPayment.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'สำเร็จ'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-slate-400">บันทึกเมื่อ: {selectedPaymentDateLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="h-8 w-8 shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-base font-black text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 sm:p-5 lg:grid-cols-[minmax(0,1.55fr)_280px]">
              <div className="space-y-4">
                <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">ข้อมูลรายการ</p>
                      <h4 className="mt-0.5 text-sm font-black text-slate-800">สรุปข้อมูลลูกค้าและการใช้บริการ</h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                      <div className="text-[10px] font-black text-slate-400 mb-1">ชื่อลูกค้า</div>
                      <div className="text-sm font-black text-slate-800 break-words">{selectedPayment.FullName || 'ไม่ระบุชื่อ'}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                      <div className="text-[10px] font-black text-slate-400 mb-1">ตำแหน่งเลน</div>
                      <div className="text-sm font-black text-emerald-700">{selectedPayment.Lane_Code || 'ไม่ระบุเลน'}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                      <div className="text-[10px] font-black text-slate-400 mb-1">ช่วงเวลาใช้งานเลน</div>
                      <div className="text-sm font-black text-slate-800 break-words">{getPaymentTimeLabel(selectedPayment)}</div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2 xl:col-span-3">
                      <div className={`rounded-2xl border px-4 py-3 ${selectedPaymentNeedsInstructor ? 'border-indigo-100 bg-indigo-50/70' : 'border-slate-100 bg-slate-50/80'}`}>
                        <div className="text-[10px] font-black text-slate-400 mb-1">ผู้สอนพื้นฐานการเล่นกอล์ฟ</div>
                        <div className={`text-sm font-black ${selectedPaymentNeedsInstructor ? 'text-indigo-700' : 'text-slate-500'}`}>
                          {selectedPaymentNeedsInstructor ? 'ต้องการ' : 'ไม่ต้องการ'}
                        </div>
                      </div>
                      <div className={`rounded-2xl border px-4 py-3 ${selectedPaymentNeedsClubRent ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-100 bg-slate-50/80'}`}>
                        <div className="text-[10px] font-black text-slate-400 mb-1">เช่าไม้กอล์ฟ</div>
                        <div className={`text-sm font-black ${selectedPaymentNeedsClubRent ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {selectedPaymentNeedsClubRent ? 'ต้องการเช่า' : 'ไม่ต้องการเช่า'}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Payment Items</p>
                    <h4 className="mt-0.5 text-sm font-black text-slate-800">รายการชำระเงิน</h4>
                  </div>

                  <div className="space-y-2">
                    {Array.isArray(selectedPayment.Items_List) && selectedPayment.Items_List.length > 0 ? (
                      selectedPayment.Items_List.map((item, index) => (
                        <div key={`${item.item_name || 'item'}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                          <div className="min-w-0">
                            <div className="text-sm font-black text-slate-800 break-words">{item.item_name || '-'}</div>
                            <div className="mt-0.5 text-[10px] font-bold text-slate-400">จำนวน {item.qty || 0} {item.unit || 'หน่วย'}</div>
                          </div>
                          <div className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-slate-700 border border-slate-200">
                            {item.price || 0} บาท
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-400">
                        ไม่พบรายการชำระเงิน
                      </div>
                    )}
                  </div>
                </section>

                {Array.isArray(selectedPayment.Rented_Clubs) && selectedPayment.Rented_Clubs.length > 0 && (
                  <section className="rounded-3xl border border-emerald-100 bg-white p-4 sm:p-5">
                    <div className="mb-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-500">Rental Clubs</p>
                      <h4 className="mt-0.5 text-sm font-black text-slate-800">รายการไม้กอล์ฟที่เช่า</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedPayment.Rented_Clubs.map((club, index) => (
                        <div key={`${club.Club_Name || 'club'}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                          <div className="min-w-0 text-sm font-black text-emerald-800 break-words">{club.Club_Name || 'ไม่ระบุชื่อไม้กอล์ฟ'}</div>
                          <div className="shrink-0 rounded-xl bg-white/90 px-3 py-1 text-xs font-black text-emerald-700 border border-emerald-200">
                            {club.qty || 0} ชิ้น
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {getPaymentNote(selectedPayment) && (
                  <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="mb-2.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Note</p>
                      <h4 className="mt-0.5 text-sm font-black text-slate-800">หมายเหตุเพิ่มเติม</h4>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-sm font-bold text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {getPaymentNote(selectedPayment)}
                    </div>
                  </section>
                )}
              </div>

              <div className="space-y-3">
                <aside className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 lg:sticky lg:top-4">
                  <div className="mb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Summary</p>
                    <h4 className="mt-0.5 text-sm font-black text-slate-800">สรุปยอดชำระ</h4>
                  </div>

                  <div className="mb-3 grid grid-cols-1 gap-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                      <div className="text-[10px] font-black text-slate-400 mb-1">วิธีชำระเงิน</div>
                      <div className="text-sm font-black text-slate-800 break-words">{selectedPayment.Payment_Method || '-'}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                      <div className="text-[10px] font-black text-slate-400 mb-1">ผู้รับชำระเงิน</div>
                      <div className="text-sm font-black text-slate-800 break-words">{getCashierLabel(selectedPayment)}</div>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-slate-50/80 border border-slate-100 p-4">
                    <div className="space-y-0 divide-y divide-slate-200/70">
                      <div className="flex items-center justify-between gap-3 py-2 text-xs font-bold text-slate-600">
                        <span>ยอดเงินรวม</span>
                        <span className="text-slate-800">{toWholeNumber(selectedPayment.Total_Amount || 0).toLocaleString()} บาท</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-2 text-xs font-bold text-slate-600">
                        <span>ส่วนลดแต้ม</span>
                        <span className="text-slate-800">{toWholeNumber(selectedPayment.Point_Discount || 0).toLocaleString()} บาท</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-2 text-xs font-bold text-slate-600">
                        <span>เงินสด</span>
                        <span className="text-slate-800">{toWholeNumber(selectedPayment.Cash_Amount || 0).toLocaleString()} บาท</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 py-2 text-xs font-bold text-slate-600">
                        <span>เงินโอน</span>
                        <span className="text-slate-800">{toWholeNumber(selectedPayment.Transfer_Amount || 0).toLocaleString()} บาท</span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white border border-emerald-100 px-4 py-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-500 mb-1">Net Total</div>
                      <div className="text-xl font-black text-emerald-700">{toWholeNumber(selectedPayment.Net_Amount || 0).toLocaleString()} บาท</div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:px-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-5 py-2 rounded-xl text-xs transition-all"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {voidReasonTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-sm modal-overlay-transition sm:items-center sm:p-4">
          <div className="modal-card-transition w-full max-w-md overflow-hidden rounded-3xl border border-rose-100 bg-white text-left shadow-2xl">
            <div className="border-b border-rose-100 bg-rose-50 px-4 py-4 sm:px-5">
              <h3 className="text-lg font-black text-rose-700">ยกเลิกรายการชำระเงิน</h3>
              <p className="mt-1 text-xs font-bold text-rose-500">
                กรุณาระบุหมายเหตุการยกเลิกก่อนยืนยัน
              </p>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-black text-slate-400 mb-1">รายการที่ต้องการยกเลิก</div>
                <div className="text-sm font-black text-slate-800">{voidReasonTarget.FullName || 'ไม่ระบุชื่อลูกค้า'}</div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  {voidReasonTarget.Lane_Code || 'ไม่ระบุเลน'} | ยอดสุทธิ {toWholeNumber(voidReasonTarget.Net_Amount || 0).toLocaleString()} บาท
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">
                  หมายเหตุการยกเลิก <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={voidReason}
                  onChange={(e) => {
                    setVoidReason(e.target.value);
                    if (voidReasonError) setVoidReasonError('');
                  }}
                  rows={4}
                  placeholder="เช่น ลูกค้าขอคืนเงิน, บันทึกยอดผิด, ชำระซ้ำ..."
                  className={`w-full resize-none rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:bg-white ${
                    voidReasonError
                      ? 'border-rose-300 focus:border-rose-500'
                      : 'border-slate-200 focus:border-emerald-500'
                  }`}
                />
                {voidReasonError && (
                  <p className="mt-2 text-xs font-bold text-rose-600">{voidReasonError}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 border-t border-slate-100 bg-white px-4 py-4 sm:px-5">
              <button
                type="button"
                onClick={closeVoidReasonModal}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmVoidPayment}
                className="flex-1 rounded-xl border border-rose-600 bg-rose-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition-all hover:bg-rose-700"
              >
                ยืนยันยกเลิกรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup isOpen={alertPopup.isOpen} type={alertPopup.type} title={alertPopup.title} message={alertPopup.message} onConfirm={alertPopup.onConfirm} onCancel={() => setAlertPopup(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
}

export default PaymentManager;
