import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { CheckIcon, UserIcon } from './AppIcons';
import { areSelectedSlotsContiguous, isSelectedSlotsDraftValid } from '../utils/bookingTimeUtils';
import {
  getClubName,
  getClubPrice,
  getClubRepairQty,
  getClubTotalQty,
  getClubType,
  sortGolfClubsLikeInventory
} from '../utils/golfClubUtils';
import { normalizeWholeNumberInput, toWholeNumber } from '../utils/numberUtils';

function isClubRentalService(serviceName = '') {
  return serviceName.includes('ไม้กอล์ฟ') || serviceName.includes('Club');
}

function isInstructorService(serviceName = '') {
  return serviceName.includes('ผู้สอน') || serviceName.includes('Instructor');
}

function OtherIncomeModal({ isOpen, onClose, setAlert, cashierInfo = null }) {
  const [customerForm, setCustomerForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    guestCount: '1',
    description: '',
    method: 'เงินสด'
  });

  const [services, setServices] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [manualSelectedSlots, setManualSelectedSlots] = useState({});
  const [loadingServices, setLoadingServices] = useState(true);
  const [memberLookupLoading, setMemberLookupLoading] = useState(false);
  const [memberInfo, setMemberInfo] = useState(null);
  const [dragSelection, setDragSelection] = useState(null);
  const [needsInstructor, setNeedsInstructor] = useState(false);
  const [needsClubRent, setNeedsClubRent] = useState(false);
  const [clubInventory, setClubInventory] = useState([]);
  const [selectedClubs, setSelectedClubs] = useState([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [pointSettings, setPointSettings] = useState(null);
  const [usedPoints, setUsedPoints] = useState(0);

  const TOTAL_LANES = 15;
  const laneNumbers = Array.from({ length: TOTAL_LANES }, (_, i) => i + 1);
  const TIME_SLOTS = ["08:00-09:00", "09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00", "17:00-18:00", "18:00-19:00"];

  // 1. ดึงรายการตั้งค่าค่าบริการทั้งหมดจากฐานข้อมูล service_settings
  useEffect(() => {
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const q = query(collection(db, 'service_settings'), where('Is_Active', '==', true));
        const snapshot = await getDocs(q);
        const servicesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setServices(servicesData);

        const initialQuantities = {};
        servicesData.forEach(s => {
          initialQuantities[s.id] = 0;
        });
        setQuantities(initialQuantities);
      } catch (error) {
        console.error("Error fetching services: ", error);
      }
      setLoadingServices(false);
    };

    if (isOpen) {
      fetchServices();
      setNeedsInstructor(false);
      setNeedsClubRent(false);
      setSelectedClubs([]);
      setClubInventory([]);
      setUsedPoints(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchPointSettings = async () => {
      try {
        const pointSnap = await getDoc(doc(db, 'Point_Settings', 'config_01'));
        setPointSettings(pointSnap.exists() ? pointSnap.data() : null);
      } catch (error) {
        console.error('Error fetching point settings:', error);
        setPointSettings(null);
      }
    };

    if (isOpen) fetchPointSettings();
  }, [isOpen]);

  useEffect(() => {
    const stopDragSelection = () => setDragSelection(null);
    window.addEventListener('mouseup', stopDragSelection);
    return () => window.removeEventListener('mouseup', stopDragSelection);
  }, []);

  useEffect(() => {
    if (customerForm.method !== 'รวมทั้งสอง') {
      setCashAmount('');
      setTransferAmount('');
    }
  }, [customerForm.method]);

  const showSelectionWarning = () => {
    setAlert({
      isOpen: true,
      type: 'warning',
      title: 'เลือกข้ามเลนข้ามเวลาไม่ได้',
      message: 'ไม่สามารถเลือกแบบข้ามเลนข้ามเวลาได้ ทุกเลนที่เลือกต้องใช้ช่วงเวลาเดียวกันและเวลาต้องติดกัน',
      onConfirm: () => setAlert(prev => ({ ...prev, isOpen: false }))
    });
  };

  const applySlotSelection = (laneNum, slot, shouldSelect) => {
    const laneKey = `lane_${laneNum}`;
    setManualSelectedSlots((prevSelectedSlots) => {
      const current = prevSelectedSlots[laneKey] || [];

      if (!shouldSelect && current.includes(slot)) {
        const updated = current.filter(s => s !== slot);
        const nextSelectedSlots = { ...prevSelectedSlots };
        if (updated.length === 0) {
          delete nextSelectedSlots[laneKey];
        } else {
          nextSelectedSlots[laneKey] = updated;
        }

        if (!isSelectedSlotsDraftValid(nextSelectedSlots, TIME_SLOTS)) {
          showSelectionWarning();
          return prevSelectedSlots;
        }

        return nextSelectedSlots;
      }

      if (shouldSelect && !current.includes(slot)) {
        const nextSelectedSlots = { ...prevSelectedSlots, [laneKey]: [...current, slot] };
        if (!isSelectedSlotsDraftValid(nextSelectedSlots, TIME_SLOTS)) {
          showSelectionWarning();
          return prevSelectedSlots;
        }
        return nextSelectedSlots;
      }

      return prevSelectedSlots;
    });
  };

  const handleSlotMouseDown = (event, laneNum, slot) => {
    event.preventDefault();
    const laneKey = `lane_${laneNum}`;
    const shouldSelect = !(manualSelectedSlots[laneKey] || []).includes(slot);
    setDragSelection({ shouldSelect });
    applySlotSelection(laneNum, slot, shouldSelect);
  };

  const handleSlotMouseEnter = (laneNum, slot) => {
    if (!dragSelection) return;
    applySlotSelection(laneNum, slot, dragSelection.shouldSelect);
  };

  const getSlotsCount = () => Object.values(manualSelectedSlots).reduce((acc, curr) => acc + curr.length, 0);

  // ระบบคำนวณสล็อตเวลาสัมพันธ์กับค่าบริการเลนอัตโนมัติ
  useEffect(() => {
    const slotsCount = getSlotsCount();
    const totalClubQty = needsClubRent
      ? selectedClubs.reduce((sum, club) => sum + Number(club.qty || 0), 0)
      : 0;

    setQuantities(prev => {
      const updated = { ...prev };
      services.forEach(service => {
        const name = service.Service_Name || "";
        if (name.includes("เลน") || name.includes("ชั่วโมง")) {
          updated[service.id] = slotsCount;
        } else if (isInstructorService(name)) {
          updated[service.id] = needsInstructor ? 1 : 0;
        } else if (isClubRentalService(name)) {
          updated[service.id] = totalClubQty;
        }
      });
      return updated;
    });
  }, [manualSelectedSlots, services, needsInstructor, needsClubRent, selectedClubs]);

  const findMemberByEmail = async (email) => {
    const trimmedEmail = String(email || '').trim();
    const normalizedEmail = trimmedEmail.toLowerCase();

    if (!trimmedEmail) {
      setMemberInfo(null);
      setUsedPoints(0);
      setMemberLookupLoading(false);
      return null;
    }

    setMemberLookupLoading(true);
    try {
      let memberDoc = null;
      const emailFields = ['Email', 'email'];
      const emailVariants = [...new Set([trimmedEmail, normalizedEmail])];

      for (const fieldName of emailFields) {
        for (const emailValue of emailVariants) {
          const snap = await getDocs(query(collection(db, 'users'), where(fieldName, '==', emailValue)));
          if (!snap.empty) {
            const userDoc = snap.docs[0];
            const data = userDoc.data();
            memberDoc = {
              id: userDoc.id,
              email: data.Email || data.email || normalizedEmail,
              fullName: data.FullName || data.fullName || data.displayName || '',
              phoneNumber: data.PhoneNumber || data.phone || '',
              pointsBalance: Number(data.Points_Balance ?? data.points_balance ?? 0)
            };
            break;
          }
        }
        if (memberDoc) break;
      }

      setMemberInfo(memberDoc);
      if (!memberDoc) setUsedPoints(0);
      if (memberDoc) {
        setCustomerForm(prev => ({
          ...prev,
          customerName: memberDoc.fullName || prev.customerName,
          customerPhone: memberDoc.phoneNumber || prev.customerPhone
        }));
      }
      return memberDoc;
    } catch (error) {
      console.error('Error finding member by email:', error);
      setMemberInfo(null);
      return null;
    } finally {
      setMemberLookupLoading(false);
    }
  };

  const fetchClubInventory = async () => {
    setClubsLoading(true);
    try {
      const [clubSnap, bookingSnap] = await Promise.all([
        getDocs(collection(db, 'golf_clubs')),
        getDocs(collection(db, 'bookings'))
      ]);
      const rentedQtyMap = {};

      bookingSnap.docs.forEach((bookingDoc) => {
        const booking = bookingDoc.data();
        if (['pending', 'confirmed', 'occupied'].includes(booking.status) && Array.isArray(booking.rentedClubs)) {
          booking.rentedClubs.forEach((clubItem) => {
            const clubId = clubItem.clubId;
            const qty = Number(clubItem.qty || 0);
            rentedQtyMap[clubId] = (rentedQtyMap[clubId] || 0) + qty;
          });
        }
      });

      const inventory = clubSnap.docs.map((clubDoc) => {
        const data = clubDoc.data();
        const totalQty = getClubTotalQty(data);
        const repairQty = getClubRepairQty(data);
        const unavailableQty = rentedQtyMap[clubDoc.id] || 0;
        const availableQty = Math.max(0, totalQty - repairQty - unavailableQty);

        return {
          id: clubDoc.id,
          name: getClubName(data),
          type: getClubType(data),
          price: getClubPrice(data),
          available: availableQty,
          isActive: data.Is_Active !== false
        };
      }).filter((club) => club.isActive && club.available > 0);

      setClubInventory(sortGolfClubsLikeInventory(inventory));
    } catch (error) {
      console.error('Error fetching club inventory:', error);
      setAlert({
        isOpen: true,
        type: 'danger',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถโหลดข้อมูลไม้กอล์ฟได้',
        onConfirm: () => setAlert(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setClubsLoading(false);
    }
  };

  const handleClubQtyChange = (club, change) => {
    const existingItem = selectedClubs.find((item) => item.clubId === club.id);
    const currentQty = existingItem ? Number(existingItem.qty || 0) : 0;
    const newQty = Math.max(0, currentQty + change);

    if (newQty > club.available) {
      setAlert({
        isOpen: true,
        type: 'warning',
        title: 'จำนวนไม้กอล์ฟไม่พอ',
        message: `ไม้กอล์ฟรายการนี้พร้อมใช้งานได้อีก ${club.available} ชิ้น`,
        onConfirm: () => setAlert(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (existingItem) {
      if (newQty === 0) {
        setSelectedClubs(selectedClubs.filter((item) => item.clubId !== club.id));
      } else {
        setSelectedClubs(selectedClubs.map((item) => (
          item.clubId === club.id ? { ...item, qty: newQty } : item
        )));
      }
      return;
    }

    if (change > 0) {
      setSelectedClubs([
        ...selectedClubs,
        { clubId: club.id, Club_Name: club.name, Club_Type: club.type, qty: 1, price: club.price }
      ]);
    }
  };

  const handleQuantityChange = (serviceId, change) => {
    setQuantities(prev => ({
      ...prev,
      [serviceId]: Math.max(0, (prev[serviceId] || 0) + change)
    }));
  };

  const totalAmount = services.reduce((sum, service) => {
    const qty = quantities[service.id] || 0;
    const rate = toWholeNumber(service.Price_Rate || 0);
    return sum + (qty * rate);
  }, 0);
  const availableMemberPoints = memberInfo ? Number(memberInfo.pointsBalance || 0) : 0;
  const safeUsedPoints = Math.min(
    Math.max(0, toWholeNumber(usedPoints)),
    Math.floor(availableMemberPoints)
  );
  const redemptionRatePoints = toWholeNumber(pointSettings?.RDT_Rate_Points || 0);
  const redemptionRateDiscount = toWholeNumber(pointSettings?.RDT_Rate_Discount || 0);
  const pointDiscount =
    memberInfo &&
    pointSettings?.Redemption_Is_Active &&
    redemptionRatePoints > 0 &&
    redemptionRateDiscount > 0
      ? Math.floor(safeUsedPoints / redemptionRatePoints) * redemptionRateDiscount
      : safeUsedPoints;
  const redeemedPoints =
    memberInfo &&
    pointSettings?.Redemption_Is_Active &&
    redemptionRatePoints > 0 &&
    redemptionRateDiscount > 0
      ? Math.floor(safeUsedPoints / redemptionRatePoints) * redemptionRatePoints
      : safeUsedPoints;
  const safePointDiscount = Math.min(totalAmount, Math.floor(Math.max(0, pointDiscount)));
  const netAmount = Math.max(0, totalAmount - safePointDiscount);
  const earningRateAmount = toWholeNumber(pointSettings?.Earning_Rate_Amount || 0);
  const earningRatePoints = toWholeNumber(pointSettings?.Earning_Rate_Points || 0);
  const earnedPoints =
    memberInfo &&
    pointSettings?.Earning_Is_Active &&
    earningRateAmount > 0 &&
    earningRatePoints > 0
      ? Math.floor(Math.floor(netAmount / earningRateAmount) * earningRatePoints)
      : 0;
  const pointBalanceChange = earnedPoints - redeemedPoints;
  const safeCashAmount = Math.max(0, toWholeNumber(cashAmount));
  const safeTransferAmount = Math.max(0, toWholeNumber(transferAmount));
  const mixedPaymentTotal = safeCashAmount + safeTransferAmount;

  // ฟังก์ชันบันทึกข้อมูล พร้อมตรวจสอบความถูกต้องก่อนบันทึก
  const handleSavePayment = async () => {
    // ดักจับที่ 1: ตรวจสอบการกรอกชื่อลูกค้า
    if (!customerForm.customerName.trim()) {
      alert("กรุณากรอกชื่อลูกค้าก่อนทำการบันทึกบิล");
      return;
    }

    // ดักจับที่ 2: บังคับให้พนักงานกดเลือกเวลาในตารางตารางหมากรุกอย่างน้อย 1 ช่อง (ตามเงื่อนไขใหม่)
    if (getSlotsCount() === 0) {
      alert("ไม่สามารถบันทึกได้: กรุณาคลิกเลือกช่วงเวลาซ้อมบนตารางผังเลนฝั่งซ้ายอย่างน้อย 1 ช่องเวลา");
      return;
    }

    if (!areSelectedSlotsContiguous(manualSelectedSlots, TIME_SLOTS)) {
      showSelectionWarning();
      return;
    }

    if (needsClubRent && selectedClubs.length === 0) {
      setAlert({
        isOpen: true,
        type: 'warning',
        title: 'กรุณาเลือกไม้กอล์ฟ',
        message: 'เลือกต้องการเช่าไม้กอล์ฟแล้ว กรุณาเลือกไม้กอล์ฟจากรายการในฐานข้อมูลอย่างน้อย 1 รายการ',
        onConfirm: () => setAlert(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    // ดักจับที่ 3: บังคับให้พิมพ์ข้อมูลหมายเหตุเพิ่มชี้แจง (ตามเงื่อนไขใหม่)
    if (!customerForm.description.trim()) {
      alert("ไม่สามารถบันทึกได้: กรุณากรอกช่องหมายเหตุชี้แจงเพิ่มเติม เพื่อระบุรายละเอียดหรือเหตุผลในบิลนี้");
      return;
    }

    // ดักจับที่ 4: ตรวจสอบยอดรวมราคาสุทธิ
    if (totalAmount <= 0) {
      alert("กรุณาเลือกรายการคิดเงินหรือปรับจำนวนสินค้าให้มียอดชำระมากกว่า 0 บาท");
      return;
    }

    if (customerForm.method === 'รวมทั้งสอง' && mixedPaymentTotal !== netAmount) {
      alert('กรุณากรอกจำนวนเงินสดและเงินโอนให้รวมกันเท่ากับยอดชำระสุทธิ');
      return;
    }

    try {
      const selectedLanes = Object.keys(manualSelectedSlots).map(key => parseInt(key.replace('lane_', ''))).sort((a, b) => a - b);
      const selectedTimeSlots = Array.from(new Set(Object.values(manualSelectedSlots).flat()))
        .sort((a, b) => TIME_SLOTS.indexOf(a) - TIME_SLOTS.indexOf(b));
      const trimmedEmail = customerForm.customerEmail.trim();
      const matchedMember = memberInfo || (trimmedEmail ? await findMemberByEmail(trimmedEmail) : null);
      
      const itemsList = [];
      services.forEach(service => {
        const qty = quantities[service.id] || 0;
        if (qty > 0) {
          itemsList.push({
            item_name: service.Service_Name,
            qty: qty,
            price: qty * toWholeNumber(service.Price_Rate || 0),
            unit: service.Unit || 'หน่วย'
          });
        }
      });

      await addDoc(collection(db, 'payments'), {
        Booking_ID: 'manual_income_' + Date.now(),
        User_ID: matchedMember?.id || 'walk-in',
        FullName: customerForm.customerName,
        Customer_Email: trimmedEmail,
        Email: trimmedEmail,
        email: trimmedEmail,
        Customer_Phone: customerForm.customerPhone,
        Guest_Count: Math.max(1, toWholeNumber(customerForm.guestCount)),
        Needs_Instructor: needsInstructor,
        Needs_Club_Rent: needsClubRent,
        Description: customerForm.description.trim(), // บันทึกหมายเหตุลงฐานข้อมูล
        Payment_Date: serverTimestamp(),
        Cashier_ID: cashierInfo?.id || '',
        Cashier_Name: cashierInfo?.name || 'ไม่ระบุชื่อผู้รับชำระ',
        Cashier_Role: cashierInfo?.role || '',
        Cashier_Email: cashierInfo?.email || '',
        Total_Amount: totalAmount,
        Used_Points: redeemedPoints,
        Point_Discount: safePointDiscount,
        Earned_Points: earnedPoints,
        Point_Balance_Change: pointBalanceChange,
        Net_Amount: netAmount,
        Payment_Method: customerForm.method,
        Cash_Amount:
          customerForm.method === 'รวมทั้งสอง'
            ? safeCashAmount
            : customerForm.method === 'เงินสด'
              ? netAmount
              : 0,
        Transfer_Amount:
          customerForm.method === 'รวมทั้งสอง'
            ? safeTransferAmount
            : customerForm.method === 'เงินโอน'
              ? netAmount
              : 0,
        Lane_Code: selectedLanes.length > 0 ? `เลน ${selectedLanes.join(', ')}` : 'เบ็ดเตล็ดหน้าร้าน',
        Time_Slots: selectedTimeSlots,
        Source_Type: 'manual_income',
        status: 'active',
        Items_List: itemsList,
        Rented_Clubs: needsClubRent ? selectedClubs : []
      });

      if (matchedMember?.id && pointBalanceChange !== 0) {
        await updateDoc(doc(db, 'users', matchedMember.id), {
          Points_Balance: increment(pointBalanceChange)
        });
      }

      onClose();
      setAlert({
        isOpen: true,
        type: 'info',
        title: 'บันทึกสำเร็จ',
        message: `ระบบบันทึกยอดรายได้เบ็ดเตล็ดคุณ ${customerForm.customerName} จำนวน ${netAmount} บาท เรียบร้อยแล้ว${earnedPoints > 0 ? `\nสมาชิกได้รับแต้ม +${earnedPoints} คะแนน` : ''}`,
        onConfirm: () => setAlert(p => ({ ...p, isOpen: false }))
      });
    } catch (err) { 
      alert("เกิดข้อผิดพลาด: " + err.message); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-sm modal-overlay-transition sm:p-4">
      <div className="modal-card-transition flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-y-auto rounded-3xl border bg-white p-4 text-left shadow-2xl sm:max-h-[94vh] sm:rounded-[2.5rem] sm:p-6">
        
        <div className="border-b pb-3 mb-4 flex justify-between items-start gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-800">เพิ่มข้อมูลรายได้ใหม่</h3>
            <p className="text-xs text-slate-400 mt-0.5">ระบุข้อมูลผู้ใช้บริการ เลือกช่องเวลาตาราง หรือคลิกเลือกสินค้าเพื่อคำนวณเงินสด/โอนสุทธิ</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 w-full">
          
          {/* ผังกระดานตารางหมากรุกพิกัดเวลาเลนซ้อม 1-15 ด้านซ้าย */}
          <div className="lg:col-span-2 border rounded-2xl p-3 sm:p-4 bg-slate-50 overflow-auto max-h-[70vh]">
            <p className="text-xs font-black text-indigo-600 mb-3">
              คลิกจิ้มเลือกช่องตารางเลนซ้อม <span className="text-red-500 font-extrabold">* (จำเป็นต้องเลือกอย่างน้อย 1 ช่องเวลา)</span> :
            </p>
            <table className="w-full min-w-[650px] border-collapse text-center text-xs">
              <thead>
                <tr className="bg-slate-200 border-b text-slate-700">
                  <th className="p-2 font-black sticky left-0 bg-slate-300 z-10 w-20">เลนซ้อม</th>
                  {TIME_SLOTS.map(slot => (
                    <th key={slot} className="p-2 font-bold border-r text-[10px]">{slot}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {laneNumbers.map(num => (
                  <tr key={num} className="border-b border-slate-200 bg-white hover:bg-slate-50">
                    <td className="p-2 font-extrabold text-slate-700 bg-slate-100 sticky left-0 z-10 border-r shadow-xs">เลน {num}</td>
                    {TIME_SLOTS.map(slot => {
                      const isSel = (manualSelectedSlots[`lane_${num}`] || []).includes(slot);
                      return (
                        <td
                          key={slot}
                          onMouseDown={(event) => handleSlotMouseDown(event, num, slot)}
                          onMouseEnter={() => handleSlotMouseEnter(num, slot)}
                          onMouseUp={() => setDragSelection(null)}
                          className={`p-2 border-r cursor-pointer font-bold select-none text-[11px] transition-all h-9 ${isSel ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-inner animate-pulse' : 'bg-white text-transparent hover:bg-slate-100 border-slate-200'}`}
                        >
                          {isSel ? <CheckIcon className="mx-auto h-3.5 w-3.5 text-emerald-700" /> : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ฟอร์มกรอกข้อมูลลูกค้าและรายการคิดเงินไดนามิกด้านขวา */}
          <div className="lg:col-span-1 bg-white border border-slate-200 p-3 sm:p-5 rounded-2xl flex min-h-0 flex-col justify-between">
            
            <div className="space-y-4 overflow-y-visible lg:overflow-y-auto lg:max-h-[70vh] flex-1 pr-1 pb-4">
              {/* ข้อมูลส่วนตัวผู้ใช้บริการ */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                <span className="flex items-center gap-1.5 text-xs font-black text-slate-700 border-b pb-1">
                  <UserIcon className="h-3.5 w-3.5" />
                  <span>ข้อมูลส่วนตัวผู้ใช้บริการ</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">อีเมลสมาชิก</label>
                    <input
                      type="email"
                      placeholder="กรอกอีเมลสมาชิกเพื่อผูกประวัติ..."
                      value={customerForm.customerEmail}
                      onChange={e => {
                        setCustomerForm({ ...customerForm, customerEmail: e.target.value });
                        setMemberInfo(null);
                        setUsedPoints(0);
                      }}
                      onBlur={e => findMemberByEmail(e.target.value)}
                      className="w-full bg-white border p-2 rounded-lg text-xs font-bold focus:outline-none"
                    />
                    {(memberLookupLoading || customerForm.customerEmail.trim()) && (
                      <p className={`mt-1 text-[10px] font-bold ${memberLookupLoading ? 'text-indigo-600' : memberInfo ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {memberLookupLoading ? 'กำลังตรวจสอบสมาชิก...' : memberInfo ? 'พบสมาชิก ระบบจะบันทึกประวัติเข้าบัญชีนี้' : 'ถ้าไม่พบสมาชิก ระบบจะบันทึกเป็นลูกค้าหน้าร้าน'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ชื่อลูกค้า <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="ชื่อ-นามสกุล..." value={customerForm.customerName} onChange={e => setCustomerForm({ ...customerForm, customerName: e.target.value })} className="w-full bg-white border p-2 rounded-lg text-xs font-bold focus:outline-none" required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">เบอร์โทรติดต่อ</label>
                    <input type="text" placeholder="เบอร์โทรศัพท์..." maxLength={10} value={customerForm.customerPhone} onChange={e => setCustomerForm({ ...customerForm, customerPhone: e.target.value.replace(/\D/g, '') })} className="w-full bg-white border p-2 rounded-lg text-xs font-bold focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">จำนวนผู้ร่วมใช้งาน (ท่าน)</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={customerForm.guestCount} onChange={e => setCustomerForm({ ...customerForm, guestCount: normalizeWholeNumberInput(e.target.value) })} className="w-full bg-white border p-2 rounded-lg text-xs font-bold focus:outline-none text-center" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">ต้องการผู้สอนพื้นฐานการเล่นกอล์ฟหรือไม่?</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNeedsInstructor(true)}
                        className={`rounded-lg border py-2 text-[11px] font-black transition-all ${needsInstructor ? 'border-emerald-400 bg-emerald-100 text-emerald-800' : 'border-slate-200 bg-white text-slate-400'}`}
                      >
                        ต้องการ
                      </button>
                      <button
                        type="button"
                        onClick={() => setNeedsInstructor(false)}
                        className={`rounded-lg border py-2 text-[11px] font-black transition-all ${!needsInstructor ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-200 bg-white text-slate-400'}`}
                      >
                        ไม่ต้องการ
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">ต้องการเช่าไม้กอล์ฟหรือไม่?</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setNeedsClubRent(true);
                          if (clubInventory.length === 0) fetchClubInventory();
                        }}
                        className={`rounded-lg border py-2 text-[11px] font-black transition-all ${needsClubRent ? 'border-emerald-400 bg-emerald-100 text-emerald-800' : 'border-slate-200 bg-white text-slate-400'}`}
                      >
                        ต้องการเช่า
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNeedsClubRent(false);
                          setSelectedClubs([]);
                        }}
                        className={`rounded-lg border py-2 text-[11px] font-black transition-all ${!needsClubRent ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-200 bg-white text-slate-400'}`}
                      >
                        ไม่ต้องการ
                      </button>
                    </div>
                  </div>
                </div>
                {needsClubRent && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-emerald-800">เลือกไม้กอล์ฟสำหรับเช่า</span>
                      <span className="text-[10px] font-bold text-emerald-700">
                        เลือกแล้ว {selectedClubs.reduce((sum, item) => sum + Number(item.qty || 0), 0)} ชิ้น
                      </span>
                    </div>
                    {clubsLoading ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-[11px] font-bold text-slate-400">
                        กำลังโหลดข้อมูลไม้กอล์ฟ...
                      </div>
                    ) : clubInventory.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-[11px] font-bold text-slate-400">
                        ไม่มีไม้กอล์ฟพร้อมให้เช่าในตอนนี้
                      </div>
                    ) : (
                      <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                        {clubInventory.map((club) => {
                          const selectedItem = selectedClubs.find((item) => item.clubId === club.id);
                          const qty = selectedItem ? Number(selectedItem.qty || 0) : 0;
                          return (
                            <div key={club.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-xs font-black text-slate-800">{club.name}</div>
                                  <div className="text-[10px] font-bold text-slate-400">{club.type || 'ไม่ระบุประเภทไม้'}</div>
                                  <div className="mt-0.5 text-[10px] font-bold text-emerald-600">พร้อมใช้งาน {club.available} ชิ้น</div>
                                </div>
                                {club.price > 0 && (
                                  <div className="text-right text-[10px] font-bold text-slate-400">
                                    ราคา/ชิ้น
                                    <div className="text-xs font-black text-slate-800">{club.price} บาท</div>
                                  </div>
                                )}
                              </div>
                              <div className="mt-2 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => handleClubQtyChange(club, -1)} className="h-8 w-8 rounded-full border border-slate-300 bg-white text-sm font-black text-slate-600">-</button>
                                <div className="min-w-[44px] rounded-lg bg-slate-50 px-3 py-1.5 text-center text-xs font-black text-slate-800">{qty}</div>
                                <button type="button" onClick={() => handleClubQtyChange(club, 1)} className="h-8 w-8 rounded-full border border-emerald-300 bg-emerald-100 text-sm font-black text-emerald-700">+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                {/* บล็อกหมายเหตุชี้แจงเพิ่มเติม */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    หมายเหตุชี้แจงเพิ่มเติม <span className="text-red-500 font-black">* (จำเป็นต้องกรอก)</span>
                  </label>
                  <textarea 
                    placeholder="พิมพ์รายละเอียดชี้แจง เช่น เปิดใช้งานเลน Walk-in หรือ ซื้อค่าน้ำดื่ม..." 
                    value={customerForm.description} 
                    onChange={e => setCustomerForm({ ...customerForm, description: e.target.value })} 
                    className="w-full bg-white border p-2 rounded-lg text-xs font-bold focus:outline-none border-amber-300 focus:border-emerald-500 resize-none" 
                    rows="2" 
                    required
                  />
                </div>
              </div>

              {/* รายการจัดแจงราคาสินค้า ดึงจากตั้งค่าค่าบริการจริงหลังบ้าน */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
                <span className="text-xs font-black text-slate-700 block border-b pb-1">รายการคิดเงินและชำระเงิน</span>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {loadingServices ? (
                    <p className="text-center text-[11px] font-bold text-slate-400 py-4">กำลังดึงข้อมูลค่าบริการ...</p>
                  ) : (
                    services.map(service => {
                      const qty = quantities[service.id] || 0;
                      const rate = toWholeNumber(service.Price_Rate || 0);
                      const isLaneService = service.Service_Name.includes("เลน") || service.Service_Name.includes("ชั่วโมง");
                      const isAutoService = isLaneService || isInstructorService(service.Service_Name || '') || isClubRentalService(service.Service_Name || '');

                      return (
                        <div key={service.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 text-[11px] font-bold">
                          <div className="text-left flex-1 truncate pr-1">
                            <span className="text-slate-800 block truncate">{service.Service_Name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{rate} ฿ / {service.Unit}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button type="button" onClick={() => handleQuantityChange(service.id, -1)} disabled={isAutoService} className={`w-5 h-5 rounded flex items-center justify-center font-black text-white ${isAutoService ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-400'}`}>-</button>
                            <span className="w-4 text-center text-slate-800 text-xs">{qty}</span>
                            <button type="button" onClick={() => handleQuantityChange(service.id, 1)} disabled={isAutoService} className={`w-5 h-5 rounded flex items-center justify-center font-black text-white ${isAutoService ? 'bg-slate-300 cursor-not-allowed' : 'bg-green-400'}`}>+</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ยอดสรุปจำนวนเงินสุทธิ */}
              <div className="border-t pt-2 flex justify-between items-center text-slate-800">
                <span className="text-sm font-black">ยอดรวมก่อนหักแต้ม:</span>
                <span className="text-xl font-black text-emerald-700">{totalAmount.toLocaleString()} บาท</span>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-amber-800">ระบบแต้มสะสมสมาชิก</span>
                  <span className="text-[10px] font-bold text-amber-700">
                    {memberInfo ? `คงเหลือ ${availableMemberPoints.toLocaleString()} แต้ม` : 'กรอกอีเมลสมาชิกเพื่อใช้แต้ม'}
                  </span>
                </div>

                {memberInfo ? (
                  <div className="space-y-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-black text-slate-600">ใช้แต้มเป็นส่วนลด</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        max={Math.floor(availableMemberPoints)}
                        value={safeUsedPoints}
                        onChange={(event) => setUsedPoints(normalizeWholeNumberInput(event.target.value))}
                        className="w-full rounded-lg border border-amber-100 bg-white p-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        placeholder="0"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-black">
                      <div className="rounded-lg bg-white px-3 py-2 text-slate-600">
                        ส่วนลดแต้ม
                        <div className="text-sm text-amber-700">{safePointDiscount.toLocaleString()} บาท</div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2 text-slate-600">
                        แต้มที่จะได้รับ
                        <div className="text-sm text-emerald-700">+{earnedPoints.toLocaleString()} แต้ม</div>
                      </div>
                    </div>
                    <div className="flex justify-between rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-800">
                      <span>ยอดสุทธิหลังหักแต้ม</span>
                      <span className="text-emerald-700">{netAmount.toLocaleString()} บาท</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] font-bold leading-5 text-amber-700">
                    หากต้องการสะสมแต้ม/ใช้แต้ม ให้กรอกอีเมลสมาชิกด้านบน แล้วระบบจะดึงข้อมูลสมาชิกมาให้อัตโนมัติ
                  </p>
                )}
              </div>

              {/* เมนูช่องทางการชำระเงิน */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">ช่องทางรับชำระเงิน</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {['เงินสด', 'เงินโอน', 'รวมทั้งสอง'].map(m => (
                    <button key={m} type="button" onClick={() => setCustomerForm({ ...customerForm, method: m })} className={`py-2 text-[11px] font-black rounded-xl border transition-all truncate ${customerForm.method === m ? 'bg-emerald-100 border-emerald-400 text-emerald-800 shadow-xs' : 'bg-slate-50 text-slate-400'}`}>{m}</button>
                  ))}
                </div>
                {customerForm.method === 'รวมทั้งสอง' && (
                  <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-black text-slate-600">จำนวนเงินสด</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={cashAmount}
                          onChange={(event) => setCashAmount(normalizeWholeNumberInput(event.target.value))}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                          placeholder="0"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-black text-slate-600">จำนวนเงินโอน</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={transferAmount}
                          onChange={(event) => setTransferAmount(normalizeWholeNumberInput(event.target.value))}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                          placeholder="0"
                        />
                      </label>
                    </div>
                    <div className={`mt-2 rounded-lg px-3 py-2 text-[11px] font-black ${
                      mixedPaymentTotal === netAmount
                        ? 'bg-white text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      รวมที่กรอก {mixedPaymentTotal.toLocaleString()} บาท / ต้องชำระ {netAmount.toLocaleString()} บาท
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* แถบปุ่มบันทึกปิดท้าย */}
            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-200 bg-white">
              <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition-all">ยกเลิก</button>
              <button type="button" onClick={handleSavePayment} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs shadow transition-all">บันทึกบิลสำเร็จ</button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

export default OtherIncomeModal;
