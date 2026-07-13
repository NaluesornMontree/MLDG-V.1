import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';

function ChevronDownIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isClubRentalService(serviceName = '') {
  return serviceName.includes('ไม้กอล์ฟ') || serviceName.includes('Club');
}

function isBallService(serviceName = '') {
  return serviceName.includes('ลูกกอล์ฟ') || serviceName.includes('ถาด') || serviceName.includes('Ball');
}

function LanePaymentModal({ booking, onClose, setAlert }) {
  const [services, setServices] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [usedPoints, setUsedPoints] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('เงินสด');
  const [cashAmount, setCashAmount] = useState(0);
  const [transferAmount, setTransferAmount] = useState(0);
  const [loadingServices, setLoadingServices] = useState(true);
  const [isClubDetailOpen, setIsClubDetailOpen] = useState(false);

  const rentedClubs = useMemo(
    () => (Array.isArray(booking?.rentedClubs) ? booking.rentedClubs : []),
    [booking?.rentedClubs]
  );
  const totalRentedClubQty = useMemo(
    () => rentedClubs.reduce((sum, club) => sum + Number(club.qty || 0), 0),
    [rentedClubs]
  );
  const bookingTimeLabel = useMemo(() => {
    if (!Array.isArray(booking?.timeSlots) || booking.timeSlots.length === 0) {
      return '-';
    }

    return booking.timeSlots.join(', ');
  }, [booking?.timeSlots]);

  useEffect(() => {
    const fetchActiveServices = async () => {
      setLoadingServices(true);

      try {
        const servicesQuery = query(
          collection(db, 'service_settings'),
          where('Is_Active', '==', true)
        );
        const snapshot = await getDocs(servicesQuery);
        const servicesData = snapshot.docs.map((serviceDoc) => ({
          id: serviceDoc.id,
          ...serviceDoc.data()
        }));

        setServices(servicesData);

        const initialQuantities = {};
        servicesData.forEach((service) => {
          const serviceName = service.Service_Name || '';

          if (isClubRentalService(serviceName)) {
            initialQuantities[service.id] = booking?.needsClubRent ? totalRentedClubQty : 0;
            return;
          }

          if (isBallService(serviceName)) {
            initialQuantities[service.id] = 1;
            return;
          }

          initialQuantities[service.id] = 0;
        });

        setQuantities(initialQuantities);
      } catch (error) {
        console.error('Error fetching active services:', error);
      } finally {
        setLoadingServices(false);
      }
    };

    if (booking) {
      setIsClubDetailOpen(false);
      fetchActiveServices();
    }
  }, [booking, totalRentedClubQty]);

  useEffect(() => {
    if (paymentMethod !== 'รวมทั้งสอง') {
      setCashAmount(0);
      setTransferAmount(0);
    }
  }, [paymentMethod]);

  const safeUsedPoints = Math.min(
    Math.max(0, Number(usedPoints) || 0),
    Number(booking?.Points_Balance || 0)
  );

  const totalAmount = services.reduce((sum, service) => {
    const qty = quantities[service.id] || 0;
    const rate = Number(service.Price_Rate || 0);
    return sum + qty * rate;
  }, 0);

  const netAmount = Math.max(0, totalAmount - safeUsedPoints);
  const safeCashAmount = Math.max(0, Number(cashAmount) || 0);
  const safeTransferAmount = Math.max(0, Number(transferAmount) || 0);
  const mixedPaymentTotal = safeCashAmount + safeTransferAmount;

  const handleQuantityChange = (serviceId, change, options = {}) => {
    const { maxQty = null } = options;

    setQuantities((prev) => {
      const currentQty = Number(prev[serviceId] || 0);
      let nextQty = currentQty + change;

      if (typeof maxQty === 'number') {
        nextQty = Math.min(maxQty, nextQty);
      }

      nextQty = Math.max(0, nextQty);

      return {
        ...prev,
        [serviceId]: nextQty
      };
    });
  };

  const handleConfirmPayment = async () => {
    try {
      const itemsList = services
        .map((service) => {
          const qty = quantities[service.id] || 0;
          if (qty <= 0) return null;

          return {
            item_name: service.Service_Name,
            qty,
            price: qty * Number(service.Price_Rate || 0),
            unit: service.Unit || 'หน่วย'
          };
        })
        .filter(Boolean);

      if (itemsList.length === 0) {
        alert('กรุณาเลือกรายการชำระเงินอย่างน้อย 1 รายการ');
        return;
      }

      const selectedClubRentalItem = itemsList.find((item) =>
        isClubRentalService(item.item_name || '')
      );

      if (selectedClubRentalItem && selectedClubRentalItem.qty > totalRentedClubQty) {
        alert('จำนวนค่าเช่าไม้กอล์ฟต้องไม่เกินจำนวนไม้ที่เลือกไว้');
        return;
      }

      if (paymentMethod === 'รวมทั้งสอง' && mixedPaymentTotal !== netAmount) {
        alert('กรุณากรอกจำนวนเงินสดและเงินโอนให้รวมกันเท่ากับยอดชำระสุทธิ');
        return;
      }

      await addDoc(collection(db, 'payments'), {
        Booking_ID: booking.id,
        User_ID: booking.User_ID || 'walk-in',
        FullName: booking.customerName || 'ลูกค้า Walk-in',
        Needs_Instructor: Boolean(booking.needsInstructor),
        Needs_Club_Rent: Boolean(booking.needsClubRent),
        Payment_Date: serverTimestamp(),
        Total_Amount: totalAmount,
        Used_Points: safeUsedPoints,
        Point_Discount: safeUsedPoints,
        Net_Amount: netAmount,
        Payment_Method: paymentMethod,
        Cash_Amount:
          paymentMethod === 'รวมทั้งสอง'
            ? safeCashAmount
            : paymentMethod === 'เงินสด'
              ? netAmount
              : 0,
        Transfer_Amount:
          paymentMethod === 'รวมทั้งสอง'
            ? safeTransferAmount
            : paymentMethod === 'เงินโอน'
              ? netAmount
              : 0,
        Lane_Code: booking.selectedLanes
          ? `เลน ${booking.selectedLanes.join(', ')}`
          : 'ไม่ระบุเลน',
        Time_Slots: Array.isArray(booking.timeSlots) ? booking.timeSlots : [],
        status: 'active',
        Items_List: itemsList,
        Rented_Clubs: rentedClubs
      });

      await updateDoc(doc(db, 'bookings', booking.id), { status: 'completed' });

      if (Array.isArray(booking.selectedLanes)) {
        for (const laneNum of booking.selectedLanes) {
          await updateDoc(doc(db, 'lanes', `lane_${laneNum}`), { status: 'available' });
        }
      }

      onClose();
      setAlert({
        isOpen: true,
        type: 'info',
        title: 'ชำระเงินเสร็จสิ้น',
        message: `ระบบบันทึกรายการชำระเงินจำนวน ${netAmount.toLocaleString()} บาท และเคลียร์สถานะเลนเรียบร้อยแล้ว`,
        onConfirm: () => window.location.reload()
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      alert(`เกิดข้อผิดพลาดในการรับชำระเงิน: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-sm animate-fadeIn sm:items-center sm:p-4">
      <div className="flex max-h-none w-full max-w-4xl flex-col overflow-visible rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-2xl sm:max-h-[90vh] sm:overflow-hidden sm:rounded-[2rem] sm:p-8">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">
            ใบสรุปรายการและคิดเงินรับชำระ
          </h2>
          <p className="mt-1 text-xs font-mono text-slate-400">ID อ้างอิงระบบ: {booking.id}</p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/60 bg-slate-50 p-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 sm:p-5 lg:grid-cols-5">
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              ชื่อลูกค้า
            </span>
            <div className="truncate rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800">
              {booking.customerName || 'ไม่ระบุชื่อ'}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              เบอร์โทรติดต่อ
            </span>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-mono text-sm font-medium text-slate-700">
              {booking.customerPhone || '-'}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              หมายเลขเลน
            </span>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-emerald-600">
              เลน {booking.selectedLanes?.join(', ') || booking.laneNumber}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              เวลาใช้งาน
            </span>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800">
              {bookingTimeLabel}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              จำนวนผู้เข้าใช้
            </span>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-bold text-slate-800">
              {booking.guestCount || 1} ท่าน
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-visible sm:gap-6 sm:overflow-hidden lg:grid-cols-3">
          <div className="flex flex-col justify-between overflow-visible rounded-2xl border border-slate-200 bg-white p-3 sm:overflow-y-auto sm:p-5 lg:col-span-2">
            <div className="space-y-4">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                รายการบริการและสินค้า
              </span>

              {loadingServices ? (
                <p className="py-10 text-center text-xs font-medium text-slate-400">
                  กำลังโหลดข้อมูลราคาค่าบริการ...
                </p>
              ) : (
                services.map((service) => {
                  const currentQty = quantities[service.id] || 0;
                  const priceRate = Number(service.Price_Rate || 0);
                  const serviceName = service.Service_Name || '';
                  const clubRental = isClubRentalService(serviceName);
                  const maxQty = clubRental ? totalRentedClubQty : null;
                  const decreaseDisabled = currentQty <= 0;
                  const increaseDisabled = typeof maxQty === 'number' && currentQty >= maxQty;

                  return (
                    <div
                      key={service.id}
                      className="border-b border-slate-100 pb-3 last:border-none last:pb-0"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1 pr-4 text-left">
                          <span className="block text-sm font-bold text-slate-700">
                            {service.Service_Name}
                          </span>
                          <span className="font-mono text-xs font-medium text-slate-400">
                            เรต {priceRate} ฿ / {service.Unit || 'หน่วย'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-6">
                          <div className="flex items-center space-x-2 rounded-xl border bg-slate-50 p-1 shadow-sm">
                            <button
                              onClick={() =>
                                handleQuantityChange(service.id, -1, { maxQty })
                              }
                              disabled={decreaseDisabled}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border bg-white font-extrabold transition-all ${
                                decreaseDisabled
                                  ? 'cursor-not-allowed text-slate-300'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-mono text-sm font-extrabold text-slate-800">
                              {currentQty}
                            </span>
                            <button
                              onClick={() =>
                                handleQuantityChange(service.id, 1, { maxQty })
                              }
                              disabled={increaseDisabled}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border bg-white font-extrabold transition-all ${
                                increaseDisabled
                                  ? 'cursor-not-allowed text-slate-300'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              +
                            </button>
                          </div>

                          <span className="w-24 text-right font-mono text-sm font-extrabold text-slate-800">
                            {(currentQty * priceRate).toLocaleString()} ฿
                          </span>
                        </div>
                      </div>

                      {clubRental && booking.needsClubRent && rentedClubs.length > 0 && (
                        <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                          <button
                            type="button"
                            onClick={() => setIsClubDetailOpen((prev) => !prev)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl text-left"
                          >
                            <div>
                              <div className="text-xs font-black text-emerald-800">
                                รายการไม้กอล์ฟที่เลือก
                              </div>
                              <div className="text-xs text-emerald-700/80">
                                รวม {totalRentedClubQty} ชิ้น
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-emerald-700">
                              <span className="text-xs font-bold">
                                {isClubDetailOpen ? 'ซ่อนรายการ' : 'ดูรายการ'}
                              </span>
                              <span
                                className={`flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-white transition-transform ${
                                  isClubDetailOpen ? 'rotate-180' : ''
                                }`}
                              >
                                <ChevronDownIcon className="h-4 w-4" />
                              </span>
                            </div>
                          </button>

                          {isClubDetailOpen && (
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {rentedClubs.map((club, index) => (
                                <div
                                  key={`${club.clubId || club.Club_Name || 'club'}-${index}`}
                                  className="rounded-xl border border-emerald-100 bg-white px-3 py-2"
                                >
                                  <div className="text-sm font-bold text-slate-800">
                                    {club.Club_Name || 'ไม่ระบุชื่อไม้กอล์ฟ'}
                                  </div>
                                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                                    <span className="text-slate-500">
                                      {club.Club_Type || 'ไม่ระบุประเภทไม้'}
                                    </span>
                                    <span className="font-black text-emerald-700">
                                      {Number(club.qty || 0)} ชิ้น
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-2 text-right text-[11px] font-medium text-emerald-700/80">
                            เพิ่มจำนวนได้สูงสุด {totalRentedClubQty} ชิ้นตามรายการไม้ที่เลือกไว้
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-3 pt-4 sm:p-4">
              <div className="flex justify-between text-sm font-semibold text-slate-600">
                <span>ยอดรวมค่าบริการทั้งหมด:</span>
                <span className="font-mono">{totalAmount.toLocaleString()} บาท</span>
              </div>

              <div className="flex flex-col justify-between gap-3 text-xs text-slate-400 sm:flex-row sm:items-center">
                <span>แต้มสะสมสมาชิกคงเหลือ: {booking.Points_Balance || 0} แต้ม</span>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-500">ส่วนลดแต้ม:</span>
                  <input
                    type="number"
                    value={safeUsedPoints}
                    max={booking.Points_Balance || 0}
                    onChange={(e) => setUsedPoints(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 rounded-lg border border-slate-200 bg-white py-1 text-center font-mono text-sm font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                  <span>แต้ม</span>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-1 border-t border-slate-200/80 pt-3 font-extrabold text-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-base text-slate-700">ยอดเงินรวมชำระสุทธิ:</span>
                <span className="font-mono text-2xl font-black text-emerald-600">
                  {netAmount.toLocaleString()} บาท
                </span>
              </div>
            </div>
          </div>

          <div className="flex h-full flex-col justify-between lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <span className="mb-4 block text-center text-xs font-extrabold uppercase tracking-wider text-slate-400">
                ช่องทางรับชำระเงิน
              </span>

              <div className="flex flex-col space-y-2.5">
                {['เงินสด', 'เงินโอน', 'รวมทั้งสอง'].map((method) => {
                  const isChecked = paymentMethod === method;

                  return (
                    <label
                      key={method}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3.5 transition-all ${
                        isChecked
                          ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      <span
                        className={`text-sm font-bold ${
                          isChecked ? 'text-emerald-900' : 'text-slate-600'
                        }`}
                      >
                        {method}
                      </span>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={isChecked}
                        onChange={() => setPaymentMethod(method)}
                        className="h-4 w-4 cursor-pointer accent-emerald-600"
                      />
                    </label>
                  );
                })}
              </div>

              {paymentMethod === 'รวมทั้งสอง' && (
                <div className="mt-4 space-y-3 rounded-xl border border-emerald-100 bg-white p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-slate-500">เงินสด</span>
                      <input
                        type="number"
                        min="0"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white"
                        placeholder="0"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-slate-500">เงินโอน</span>
                      <input
                        type="number"
                        min="0"
                        value={transferAmount}
                        onChange={(e) =>
                          setTransferAmount(Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white"
                        placeholder="0"
                      />
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-600">ยอดที่กรอก</span>
                    <span
                      className={`font-black ${
                        mixedPaymentTotal === netAmount ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {mixedPaymentTotal.toLocaleString()} / {netAmount.toLocaleString()} บาท
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex w-full flex-col gap-3 pt-4 sm:flex-row lg:pt-0">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200/60 bg-slate-100 py-3 text-center text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 active:scale-95"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleConfirmPayment}
                className="flex-[2] whitespace-nowrap rounded-xl bg-emerald-600 py-3 text-center text-sm font-extrabold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95"
              >
                ยืนยันปิดยอดบิล & เคลียร์เลน
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LanePaymentModal;
