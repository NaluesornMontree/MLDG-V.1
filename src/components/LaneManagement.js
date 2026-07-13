import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { collection, getDocs, setDoc, doc, updateDoc, query, where, Timestamp, deleteDoc, addDoc } from "firebase/firestore"; 
import { theme } from '../styles/theme';
import Popup from './Popup'; 
import BookingDetailModal from './BookingDetailModal'; 
import { CheckIcon, GolfIcon, UserIcon, WrenchIcon } from './AppIcons';

function LaneManagement({ userData, onCheckoutBooking }) { 
  const rawRole = userData?.Role || userData?.role || '';
  const isOwner = rawRole.trim().toLowerCase() === 'owner';

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  });

  const [bookingsList, setBookingsList] = useState([]); 
  const [baseLanes, setBaseLanes] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState({});
  const [isShopClosed, setIsShopClosed] = useState(false); 

  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [laneActionMode, setLaneActionMode] = useState('walk-in');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false); 
  const [currentBooking, setCurrentBooking] = useState(null);
  const [focusedCellInfo, setFocusedCellInfo] = useState(null); 

  const [walkInName, setWalkInName] = useState('');
  const [walkInEmail, setWalkInEmail] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInGuests, setWalkInGuests] = useState('1');
  const [walkInInstructor, setWalkInInstructor] = useState(false);
  const [walkInNeedsClubRent, setWalkInNeedsClubRent] = useState(false);
  const [walkInLookupLoading, setWalkInLookupLoading] = useState(false);
  const [walkInMemberInfo, setWalkInMemberInfo] = useState(null);
  const [walkInModalStep, setWalkInModalStep] = useState('details');
  const [walkInClubInventory, setWalkInClubInventory] = useState([]);
  const [walkInSelectedClubs, setWalkInSelectedClubs] = useState([]);
  const [walkInClubsLoading, setWalkInClubsLoading] = useState(false);

  const [alertPopup, setAlertPopup] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null
  });

  const TOTAL_LANES = 15;
  const laneNumbers = Array.from({ length: TOTAL_LANES }, (_, i) => i + 1);
  const isImmediateActivationMode = laneActionMode === 'walk-in';
  const isPhoneBookingMode = laneActionMode === 'phone-booking';
  const walkInMemberStatusMessage = walkInLookupLoading
    ? 'กำลังตรวจสอบสมาชิก...'
    : walkInMemberInfo
      ? 'พบสมาชิกในระบบแล้ว ระบบจะเปิดใช้งานเลนให้ทันทีและเติมชื่อกับเบอร์ให้เรียบร้อย'
      : walkInEmail.trim()
        ? 'ไม่พบอีเมลนี้ในระบบ สามารถกรอกชื่อและเบอร์สำหรับจองให้คนอื่นได้'
        : '';

  const TIME_SLOTS = [
    "08:00-09:00", "09:00-10:00", "10:00-11:00", "11:00-12:00",
    "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00",
    "16:00-17:00", "17:00-18:00", "18:00-19:00"
  ];

  const getBorderColorById = (id) => {
    if (!id) return 'border-slate-400';
    if (id.startsWith('maintenance_')) return 'border-rose-300'; 
    
    const colors = [
      'border-violet-300',    'border-sky-300',       'border-emerald-300', 
      'border-fuchsia-300',   'border-orange-300',    'border-indigo-300',    
      'border-pink-300',      'border-teal-300',      'border-lime-300',      
      'border-cyan-300',      'border-rose-300',      'border-purple-300',    
      'border-amber-300',     'border-yellow-300',    'border-red-300'
    ];

    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

      const startTimestamp = Timestamp.fromDate(startOfDay);
      const endTimestamp = Timestamp.fromDate(endOfDay);

      const closureQuery = query(
        collection(db, "shop_closures"),
        where("date", ">=", startTimestamp),
        where("date", "<=", endTimestamp)
      );
      const closureSnapshot = await getDocs(closureQuery);

      const activeClosureDoc = closureSnapshot.docs.find((closureDoc) => {
        const data = closureDoc.data();
        return (data.status || 'active') === 'active';
      });

      if (activeClosureDoc) {
        const closureData = activeClosureDoc.data();
        const reason = closureData.reason || "ปรับปรุงสนามประจำปี";
        setIsShopClosed(true);
        setBookingsList([]);
        setBaseLanes({});
        setLoading(false);

        setAlertPopup({
          isOpen: true,
          type: 'danger',
          title: 'สนามปิดให้บริการ',
          message: `วันที่เลือก (${selectedDate}) ตรงกับวันปิดร้านล่วงหน้าที่ระบบบันทึกไว้ เนื่องจาก: ${reason}`,
          onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }

      setIsShopClosed(false);

      const laneSnapshot = await getDocs(collection(db, "lanes"));
      const lanesData = {};
      laneSnapshot.forEach(doc => {
        const data = doc.data();
        if (data && data.laneNumber) {
          lanesData[data.laneNumber.toString()] = data;
        }
      });
      setBaseLanes(lanesData);

      const bookingsRef = collection(db, "bookings");
      const q = query(bookingsRef, where("bookingDate", "==", selectedDate));
      const bookingSnapshot = await getDocs(q);
      
      const tempBookings = bookingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookingsList(tempBookings);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    setSelectedSlots({}); 
  }, [selectedDate]);

  const getCellStatus = (laneNum, slot) => {
    if (isShopClosed) {
      return { status: 'maintenance', booking: { id: `shop_closed`, customerName: 'สนามปิดให้บริการล่วงหน้า', laneNum } };
    }

    if (baseLanes[laneNum.toString()]?.status === 'maintenance') {
      return { status: 'maintenance', booking: { id: `maintenance_total_${laneNum}`, customerName: 'ปิดปรับปรุงระบบ', laneNum } };
    }

    const matched = bookingsList.find(b => {
      const isStatusActive = b.status === 'pending' || b.status === 'confirmed' || b.status === 'occupied' || b.status === 'maintenance';
      const hasLane = b.selectedLanes && b.selectedLanes.includes(laneNum);
      const hasSlot = b.timeSlots && b.timeSlots.includes(slot);
      return isStatusActive && hasLane && hasSlot;
    });

    if (matched) {
      if (matched.status === 'maintenance') {
        return { status: 'maintenance', booking: { ...matched, laneNum } };
      }
      return {
        status: matched.status === 'occupied' ? 'occupied' : 'booked',
        booking: { ...matched, laneNum }
      };
    }

    return { status: 'available', booking: null };
  };

  const getBookingCountByStatus = (statusName) => {
    return bookingsList.filter(b => b.status === statusName).length;
  };

  const maintenanceLaneCount = laneNumbers.filter(
    (laneNum) => baseLanes[laneNum.toString()]?.status === 'maintenance'
  ).length;

  const findMemberByEmail = async (email) => {
    const trimmedEmail = email.trim();
    const normalizedEmail = trimmedEmail.toLowerCase();
    if (!trimmedEmail) {
      setWalkInMemberInfo(null);
      setWalkInLookupLoading(false);
      return;
    }

    setWalkInLookupLoading(true);
    try {
      let memberDoc = null;
      let snap = { empty: true };
      const emailFields = ["Email", "email"];
      const emailVariants = [...new Set([trimmedEmail, normalizedEmail])];

      for (const fieldName of emailFields) {
        for (const emailValue of emailVariants) {
          const emailQuery = query(collection(db, "users"), where(fieldName, "==", emailValue));
          snap = await getDocs(emailQuery);
          if (!snap.empty) {
            break;
          }
        }
        if (!snap.empty) {
          break;
        }
      }

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();
        memberDoc = {
          id: docSnap.id,
          email: data.Email || data.email || normalizedEmail,
          fullName: data.FullName || data.fullName || data.displayName || '',
          phoneNumber: data.PhoneNumber || data.phone || ''
        };
      }

      if (memberDoc) {
        setWalkInMemberInfo(memberDoc);
        setWalkInName(memberDoc.fullName || '');
        setWalkInPhone(memberDoc.phoneNumber || '');
      } else {
        setWalkInMemberInfo(null);
      }
    } catch (error) {
      console.error("Error finding member by email:", error);
      setWalkInMemberInfo(null);
    }
    setWalkInLookupLoading(false);
  };

  const handleCellClick = (laneNum, slot) => {
    if (isShopClosed) {
      setAlertPopup({
        isOpen: true,
        type: 'warning',
        title: 'ระงับการจองคิว',
        message: 'ไม่สามารถทำรายการได้ เนื่องจากสนามปิดให้บริการชั่วคราวในวันดังกล่าว',
        onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const cellInfo = getCellStatus(laneNum, slot);
    
    if (cellInfo.status !== 'available') {
      setFocusedCellInfo({ laneNumber: laneNum, slot: slot, status: cellInfo.status });
      setCurrentBooking(cellInfo.booking);
      setIsDetailModalOpen(true);
      return;
    }

    const laneKey = `lane_${laneNum}`;
    const currentLaneSlots = selectedSlots[laneKey] || [];

    if (currentLaneSlots.includes(slot)) {
      const updated = currentLaneSlots.filter(s => s !== slot);
      if (updated.length === 0) {
        const copy = { ...selectedSlots };
        delete copy[laneKey];
        setSelectedSlots(copy);
      } else {
        setSelectedSlots({ ...selectedSlots, [laneKey]: updated });
      }
    } else {
      setSelectedSlots({ ...selectedSlots, [laneKey]: [...currentLaneSlots, slot] });
    }
  };

  const getTotalSelectedSlotsCount = () => {
    return Object.values(selectedSlots).reduce((acc, curr) => acc + curr.length, 0);
  };

  const getSelectedLanesArray = () => {
    return Object.keys(selectedSlots).map(key => parseInt(key.replace('lane_', ''))).sort((a,b)=>a-b);
  };

  const isMemberLaneActivation = Boolean(walkInMemberInfo);

  const resetLaneActionForm = (mode = 'walk-in') => {
    setLaneActionMode(mode);
    setWalkInName('');
    setWalkInEmail('');
    setWalkInPhone('');
    setWalkInGuests('1');
    setWalkInInstructor(false);
    setWalkInNeedsClubRent(false);
    setWalkInLookupLoading(false);
    setWalkInMemberInfo(null);
    setWalkInModalStep('details');
    setWalkInSelectedClubs([]);
    setWalkInClubInventory([]);
  };

  const fetchWalkInClubInventory = async () => {
    setWalkInClubsLoading(true);
    try {
      const clubSnap = await getDocs(collection(db, "golf_clubs"));
      const rentedQtyMap = {};

      bookingsList.forEach((booking) => {
        if (booking.status === 'occupied' && Array.isArray(booking.rentedClubs)) {
          booking.rentedClubs.forEach((clubItem) => {
            const clubId = clubItem.clubId;
            const qty = Number(clubItem.qty || 0);
            rentedQtyMap[clubId] = (rentedQtyMap[clubId] || 0) + qty;
          });
        }
      });

      const inventory = clubSnap.docs.map((clubDoc) => {
        const data = clubDoc.data();
        const totalQty = Number(data.Quantity_Total || 0);
        const repairQty = Number(data.Repair_Club_Total || 0);
        const unavailableQty = rentedQtyMap[clubDoc.id] || 0;
        const availableQty = Math.max(0, totalQty - repairQty - unavailableQty);

        return {
          id: clubDoc.id,
          name: data.Club_Name || 'ไม่ระบุชื่อไม้กอล์ฟ',
          type: data.Club_Type || '',
          price: Number(data.price || 100),
          available: availableQty
        };
      }).filter((club) => club.available > 0);

      setWalkInClubInventory(inventory);
    } catch (error) {
      console.error("Error fetching walk-in club inventory:", error);
      setAlertPopup({
        isOpen: true,
        type: 'danger',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถโหลดข้อมูลไม้กอล์ฟได้',
        onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
      });
    }
    setWalkInClubsLoading(false);
  };

  const handleWalkInClubQtyChange = (club, change) => {
    const existingItem = walkInSelectedClubs.find((item) => item.clubId === club.id);
    const currentQty = existingItem ? Number(existingItem.qty || 0) : 0;
    const newQty = Math.max(0, currentQty + change);

    if (newQty > club.available) {
      setAlertPopup({
        isOpen: true,
        type: 'warning',
        title: 'จำนวนไม้กอล์ฟไม่พอ',
        message: `ไม้กอล์ฟรายการนี้พร้อมใช้งานได้อีก ${club.available} ชิ้น`,
        onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (existingItem) {
      if (newQty === 0) {
        setWalkInSelectedClubs(walkInSelectedClubs.filter((item) => item.clubId !== club.id));
      } else {
        setWalkInSelectedClubs(
          walkInSelectedClubs.map((item) => (
            item.clubId === club.id ? { ...item, qty: newQty } : item
          ))
        );
      }
      return;
    }

    if (change > 0) {
      setWalkInSelectedClubs([
        ...walkInSelectedClubs,
        { clubId: club.id, Club_Name: club.name, Club_Type: club.type, qty: 1, price: club.price }
      ]);
    }
  };

  const proceedToWalkInClubSelection = async () => {
    if (!walkInName.trim()) {
      setAlertPopup({
        isOpen: true,
        type: 'danger',
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกชื่อลูกค้าก่อนเลือกไม้กอล์ฟ',
        onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    await fetchWalkInClubInventory();
    setIsWalkInModalOpen(false);
    setWalkInModalStep('clubs');
  };

  const handleSaveWalkInSubmission = async () => {
    if (isShopClosed) return;
    if (!walkInName.trim()) {
      setAlertPopup({
        isOpen: true,
        type: 'danger',
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกชื่อลูกค้า Walk-in ก่อนทำการบันทึกข้อมูลเข้าสนามซ้อม',
        onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    if (walkInNeedsClubRent && walkInSelectedClubs.length === 0) {
      setAlertPopup({
        isOpen: true,
        type: 'warning',
        title: 'ยังไม่ได้เลือกไม้กอล์ฟ',
        message: 'กรุณาเลือกไม้กอล์ฟอย่างน้อย 1 รายการ หรือเปลี่ยนเป็นไม่ต้องการเช่า',
        onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    try {
      const lanesArray = getSelectedLanesArray();
      const allTimeSlots = Array.from(new Set(Object.values(selectedSlots).flat())).sort(); 
      const normalizedEmail = walkInEmail.trim();

      const bookingStatus = isImmediateActivationMode ? 'occupied' : 'confirmed';
      const bookingType = isImmediateActivationMode
        ? (isMemberLaneActivation ? 'member-lane-activation' : 'walk-in')
        : 'phone-reservation';

      const walkInBookingData = {
        bookingDate: selectedDate,
        timeSlots: allTimeSlots, 
        detailedSlots: selectedSlots,
        User_ID: walkInMemberInfo?.id || 'walk-in',
        customerName: walkInName,
        customerEmail: normalizedEmail,
        customerPhone: walkInPhone || "",
        guestCount: Number(walkInGuests || 1),
        needsInstructor: walkInInstructor,
        needsClubRent: walkInNeedsClubRent,
        selectedLanes: lanesArray,
        laneNumber: lanesArray.join(", "),
        rentedClubs: walkInNeedsClubRent ? walkInSelectedClubs : [],
        status: bookingStatus,
        bookingType,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "bookings"), walkInBookingData);

      setIsWalkInModalOpen(false);
      setSelectedSlots({});
      setWalkInModalStep('details');
      setWalkInSelectedClubs([]);
      setWalkInNeedsClubRent(false);

      const successTitle = isPhoneBookingMode
        ? 'บันทึกรายการจองล่วงหน้าเรียบร้อย'
        : (isMemberLaneActivation ? 'เปิดใช้งานเลนสมาชิกสำเร็จ' : 'เปิดเลน Walk-in สำเร็จ');
      const successMessage = isPhoneBookingMode
        ? `บันทึกการจองเลน ${lanesArray.join(", ")} สำหรับลูกค้าโทรมาจองเรียบร้อยแล้ว`
        : isMemberLaneActivation
          ? `ระบบเปิดใช้งานเลน ${lanesArray.join(", ")} ให้สมาชิกเรียบร้อยแล้ว`
          : `ทำรายการเปิดใช้งานเลน ${lanesArray.join(", ")} ในระบบเรียบร้อยแล้ว`;

      setAlertPopup({
        isOpen: true,
        type: 'info',
        title: successTitle,
        message: successMessage,
        onConfirm: () => {
          setAlertPopup(prev => ({ ...prev, isOpen: false }));
          fetchData();
        }
      });
      return;
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

  const handleSaveMaintenanceSlots = async () => {
    if (!isOwner) {
      setAlertPopup({
        isOpen: true,
        type: 'warning',
        title: 'ปฏิเสธการเข้าถึง',
        message: 'ขออภัย เฉพาะเจ้าของร้านเท่านั้นที่มีสิทธิ์สั่งปิดปรับปรุงระบบเลนซ้อม',
        onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (isShopClosed) return;
    const lanesArray = getSelectedLanesArray();
    if (lanesArray.length === 0) return;

    try {
      for (const num of lanesArray) {
        const docId = `lane_${num}`;
        await setDoc(doc(db, "lanes", docId), {
          laneNumber: num,
          status: "maintenance" 
        });
      }

      setSelectedSlots({});

      setAlertPopup({
        isOpen: true,
        type: 'info',
        title: 'ปิดปรับปรุงเลนสำเร็จ',
        message: `ระบบดำเนินการตั้งค่าปิดใช้งานเลนที่ ${lanesArray.join(", ")} ทุกช่วงเวลาเสร็จสิ้น`,
        onConfirm: () => {
          setAlertPopup(prev => ({ ...prev, isOpen: false }));
          fetchData();
        }
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

  const handleCheckInBooking = async () => {
    if (!currentBooking) return;
    try {
      await updateDoc(doc(db, "bookings", currentBooking.id), { status: 'occupied' });
      setIsDetailModalOpen(false);
      setAlertPopup({
        isOpen: true,
        type: 'info',
        title: 'Check-in สำเร็จ',
        message: 'ยืนยันการเข้าใช้งานเลนซ้อมเรียบร้อยแล้ว',
        onConfirm: () => { setAlertPopup(prev => ({ ...prev, isOpen: false })); fetchData(); }
      });
    } catch (error) {
      setAlertPopup({ isOpen: true, type: 'danger', title: 'เกิดข้อผิดพลาด', message: error.message, onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false })) });
    }
  };

  const handleClearToAvailable = (actionType) => {
    // ๐”’ เน€เธเธดเนเธกเธเธฒเธฃเธ•เธฃเธงเธเธชเธญเธเธเธฑเนเธเน€เธ”เนเธ”เธเธฒเธ”: เธซเนเธฒเธกเธเธเธฑเธเธเธฒเธเธเธ”เธขเธเน€เธฅเธดเธเธซเธฃเธทเธญเธเธฅเธ”เธฅเนเธญเธเธเธดเธงเธ—เธตเนเน€เธเนเธเธชเธ–เธฒเธเธฐเธเธดเธ”เธเธฃเธฑเธเธเธฃเธธเธ (maintenance) เธญเธขเธนเนเธเนเธญเธเนเธฅเนเธง
    const isMaintenanceSlot = currentBooking?.status === 'maintenance' || currentBooking?.id?.startsWith('maintenance_') || focusedCellInfo?.status === 'maintenance';
    
    if (!isOwner && (isMaintenanceSlot || actionType === 'open')) {
      setAlertPopup({
        isOpen: true,
        type: 'warning',
        title: 'ปฏิเสธการเข้าถึง',
        message: 'ขออภัย เฉพาะเจ้าของร้านเท่านั้นที่สามารถจัดการหรือปลดล็อกสถานะปิดซ่อมแซมเลนได้',
        onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    let titleMsg = "ยืนยันการเปลี่ยนสถานะ";
    let confirmMsg = "คุณต้องการเปลี่ยนสถานะรายการนี้ใช่หรือไม่?";
    let popType = 'info';

    if (actionType === 'checkout') {
      titleMsg = "ไปหน้าคิดเงินและปิดรายการ";
      confirmMsg = "ยืนยันการสิ้นสุดเวลาใช้งาน แล้วไปยังใบสรุปรายการและคิดเงินรับชำระของรายการนี้ใช่หรือไม่?";
    }
    if (actionType === 'cancel') {
      titleMsg = "ยกเลิกรายการ";
      confirmMsg = "คุณต้องการยกเลิกรายการนี้ออกจากระบบใช่หรือไม่?";
      popType = 'danger';
    }
    if (actionType === 'open') {
      titleMsg = "เปิดใช้งานเลนปกติ";
      confirmMsg = "ต้องการเปิดใช้งานเลนนี้ในสถานะปกติใช่หรือไม่?";
    }

    setAlertPopup({
      isOpen: true,
      type: popType,
      title: titleMsg,
      message: confirmMsg,
      onConfirm: async () => {
        try {
          if (actionType === 'checkout' && currentBooking?.id) {
            setIsDetailModalOpen(false);
            setAlertPopup(prev => ({ ...prev, isOpen: false }));
            if (onCheckoutBooking) {
              onCheckoutBooking(currentBooking.id);
            }
            return;
          }

          if (actionType === 'open' && focusedCellInfo) {
            await setDoc(doc(db, "lanes", `lane_${focusedCellInfo.laneNumber}`), {
              laneNumber: focusedCellInfo.laneNumber,
              status: "available"
            });
          } else if (currentBooking) {
            const targetStatus = actionType === 'cancel' ? 'cancelled' : 'completed';
            
            if (currentBooking.id && currentBooking.id.startsWith('maintenance_total')) {
              await setDoc(doc(db, "lanes", `lane_${focusedCellInfo.laneNumber}`), {
                laneNumber: focusedCellInfo.laneNumber,
                status: "available"
              });
            } else {
              await updateDoc(doc(db, "bookings", currentBooking.id), { status: targetStatus });
            }
          }

          setIsDetailModalOpen(false);
          setAlertPopup({
            isOpen: true,
            type: 'info',
            title: 'อัปเดตสถานะสำเร็จ',
            message: 'ระบบทำการปรับปรุงข้อมูลบนผังเลนเรียบร้อยแล้ว',
            onConfirm: () => { setAlertPopup(prev => ({ ...prev, isOpen: false })); fetchData(); }
          });
        } catch (error) {
          setAlertPopup({ isOpen: true, type: 'danger', title: 'เกิดข้อผิดพลาด', message: error.message, onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false })) });
        }
      }
    });
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-left font-sans relative">
      
      {/* เธชเนเธงเธเธซเธฑเธงเธเธฒเธฃเธเธฑเธ”เธเธฒเธฃเนเธฅเธฐเธเธเธดเธ—เธดเธเธเนเธญเธเน€เธเนเธฒ */}
      <div className="border-b border-slate-200 pb-4 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">กระดานควบคุมผังเวลาและเลนซ้อมกอล์ฟ</h2>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 p-2.5 rounded-2xl w-full md:w-auto">
          <label className="text-xs font-black text-indigo-700 uppercase tracking-wider pl-1">เลือกวันที่ตรวจสอบ :</label>
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border border-indigo-200 p-1.5 rounded-xl text-sm font-bold text-slate-700 focus:outline-none"
          />
        </div>
      </div>

      {/* เธเธฅเนเธญเธเธชเธฃเธธเธ: เนเธชเธ”เธเธชเธ–เธดเธ•เธดเธเธณเธเธงเธเนเธเธเธญเธ */}
      <div className="bg-slate-100 p-4 sm:p-5 rounded-2xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-200 shadow-3xs">
        <div>
          <p className="text-xl font-black text-slate-700">สรุปข้อมูลลูกค้าหน้าร้าน</p>
          <p className="text-xs text-indigo-600 font-black mt-0.5">ประจำวันที่: {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex flex-col lg:flex-row flex-wrap gap-3 sm:gap-4 font-bold text-sm w-full sm:w-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-white text-slate-700 border px-4 sm:px-5 py-3 rounded-2xl shadow-xs">
            <span className="text-xs uppercase tracking-wider font-extrabold text-slate-400">จองคิวออนไลน์ทั้งหมด</span>
            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl text-base font-black">
              {loading ? "..." : (getBookingCountByStatus('pending') + getBookingCountByStatus('confirmed'))} รายการ
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-white text-slate-700 border px-4 sm:px-5 py-3 rounded-2xl shadow-xs">
            <span className="text-xs uppercase tracking-wider font-extrabold text-slate-400">กำลังซ้อมหน้าร้านตอนนี้</span>
            <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-xl text-base font-black">
              {loading ? "..." : getBookingCountByStatus('occupied')} รายการ
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-white text-slate-700 border px-4 sm:px-5 py-3 rounded-2xl shadow-xs">
            <span className="text-xs uppercase tracking-wider font-extrabold text-slate-400">เลนปิดปรับปรุง</span>
            <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-xl text-base font-black">
              {loading ? "..." : maintenanceLaneCount} เลน
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 font-black text-slate-400 tracking-widest animate-pulse">กำลังจัดระเบียบตารางพิกัดเวลา...</div>
      ) : (
        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-center">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="p-4 font-black text-slate-700 bg-slate-200 sticky left-0 z-10 w-28 border-r">เลนซ้อม</th>
                {TIME_SLOTS.map(slot => (
                  <th key={slot} className="p-3 text-xs font-black text-slate-600 border-r min-w-[90px]">{slot}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {laneNumbers.map((laneNum) => {
                const laneKey = `lane_${laneNum}`;
                const currentLaneSlots = selectedSlots[laneKey] || [];

                return (
                  <tr key={laneNum} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="p-3 font-extrabold text-slate-800 bg-slate-50 sticky left-0 z-10 border-r shadow-sm">เลน {laneNum}</td>
                    {TIME_SLOTS.map((slot, index) => {
                      const cell = getCellStatus(laneNum, slot);
                      const isSelecting = currentLaneSlots.includes(slot); 

                      let cellStyle = "bg-white hover:bg-slate-100 cursor-pointer text-transparent border border-slate-200";
                      let customBorders = ""; 

                      if (isSelecting) {
                        cellStyle = "bg-emerald-100 text-emerald-800 font-black border border-emerald-300 shadow-inner animate-pulse"; 
                      } else if (cell.status === 'maintenance' || cell.status === 'booked' || cell.status === 'occupied') {
                        const prevSlot = index > 0 ? TIME_SLOTS[index - 1] : null;
                        const nextSlot = index < TIME_SLOTS.length - 1 ? TIME_SLOTS[index + 1] : null;

                        const prevCell = prevSlot ? getCellStatus(laneNum, prevSlot) : null;
                        const nextCell = nextSlot ? getCellStatus(laneNum, nextSlot) : null;

                        const isPrevSameBooking = prevCell && prevCell.booking && cell.booking && prevCell.booking.id === cell.booking.id && prevCell.status === cell.status && prevCell.booking.laneNum === cell.booking.laneNum;
                        const isNextSameBooking = nextCell && nextCell.booking && cell.booking && nextCell.booking.id === cell.booking.id && nextCell.status === cell.status && nextCell.booking.laneNum === cell.booking.laneNum;

                        const bColor = getBorderColorById(cell.booking?.id);
                        
                        let bgBase = 'bg-cyan-50';
                        let textBase = 'text-slate-700';
                        if (cell.status === 'maintenance') {
                          bgBase = isShopClosed ? 'bg-slate-100' : 'bg-rose-100';
                          textBase = isShopClosed ? 'text-slate-500' : 'text-rose-700';
                        } else if (cell.status === 'occupied') {
                          bgBase = 'bg-amber-100';
                          textBase = 'text-amber-800';
                        }
                        
                        customBorders = `border-4 ${bColor} ${bgBase} ${textBase} font-bold `;
                        
                        if (isPrevSameBooking) {
                          customBorders += " border-l-0 rounded-l-none pl-[18px] "; 
                        } else {
                          customBorders += " rounded-l-lg border-l-4 "; 
                        }

                        if (isNextSameBooking) {
                          customBorders += " border-r-0 rounded-r-none pr-[18px] "; 
                        } else {
                          customBorders += " rounded-r-lg border-r-4 "; 
                        }

                        cellStyle = `cursor-pointer ${customBorders}`;
                      }

                      return (
                        <td
                          key={slot}
                          onClick={() => handleCellClick(laneNum, slot)}
                          className={`p-3 text-xs transition-all select-none ${cellStyle}`}
                        >
                          {isShopClosed ? (
                            'X'
                          ) : cell.status === 'maintenance' ? (
                            <WrenchIcon className="mx-auto h-4 w-4 text-rose-600" />
                          ) : cell.status === 'booked' ? (
                            <UserIcon className="mx-auto h-4 w-4 text-slate-600" />
                          ) : cell.status === 'occupied' ? (
                            <GolfIcon className="mx-auto h-4 w-4 text-emerald-700" />
                          ) : isSelecting ? (
                            <CheckIcon className="mx-auto h-4 w-4 text-emerald-700" />
                          ) : (
                            ''
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* เนเธ–เธเธเธธเนเธกเธฅเธญเธขเธชเธฃเธธเธเธขเธญเธ”เนเธญเธเธเธฑเธเธเธฒเธฃเน */}
      {getTotalSelectedSlotsCount() > 0 && !isShopClosed && (
        <div className="mt-6 border border-emerald-200 rounded-xl p-5 bg-emerald-50 flex flex-col sm:flex-row items-center justify-between shadow-md gap-4 animate-slideUp">
          <div className="text-left">
            <div className="text-sm md:text-base font-bold text-slate-700">
              เลือกทั้งหมด : <span className="text-emerald-700 font-black text-xl">{getTotalSelectedSlotsCount()}</span> ช่องเวลา
            </div>
            <div className="text-xs text-slate-500 font-bold mt-1">
              ตำแหน่งเลนซ้อม: {getSelectedLanesArray().map(l => `เลน ${l}`).join(', ')}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button onClick={() => setSelectedSlots({})} className="bg-white hover:bg-slate-100 border text-slate-600 font-bold px-4 py-2 rounded-xl text-sm transition-all">ล้างรายการ</button>
            
            {/* เนเธชเธ”เธเธเธธเนเธกเธเธดเธ”เธเธฃเธฑเธเธเธฃเธธเธเน€เธฅเธเน€เธเธเธฒเธฐเธชเธดเธ—เธเธดเนเนเธญเธ”เธกเธดเธเน€เธ—เนเธฒเธเธฑเนเธ */}
            {isOwner && (
              <button onClick={handleSaveMaintenanceSlots} className="bg-rose-600 hover:bg-rose-700 text-white font-black px-4 py-2.5 rounded-xl text-sm transition-all shadow">ปิดซ่อมแซมทั้งเลน</button>
            )}
            
            <button 
              onClick={() => {
                resetLaneActionForm('walk-in');
                setIsWalkInModalOpen(true); 
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl text-sm transition-all shadow"
            >
              ดำเนินการจอง
            </button>
          </div>
        </div>
      )}

      {/* MODAL: เธเธญเธฃเนเธกเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธฅเธนเธเธเนเธฒ */}
      {isWalkInModalOpen && !isShopClosed && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white p-4 sm:p-6 rounded-3xl sm:rounded-[2rem] shadow-2xl border text-left">
            <h3 className="text-xl font-black text-slate-800 border-b pb-2 mb-4">
              {isMemberLaneActivation ? 'เปิดใช้งานเลนสำหรับสมาชิก' : 'ฟอร์มรายละเอียดลูกค้า'}
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">ประเภทการทำรายการ</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLaneActionMode('phone-booking')}
                    className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                      isPhoneBookingMode
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-800'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    จองล่วงหน้า
                  </button>
                  <button
                    type="button"
                    onClick={() => setLaneActionMode('walk-in')}
                    className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                      isImmediateActivationMode
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    เปิดเลนทันที
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">อีเมลสมาชิก</label>
                  <input
                    type="email"
                    value={walkInEmail}
                    onChange={(e) => {
                      if (walkInMemberInfo) {
                        setWalkInName('');
                        setWalkInPhone('');
                      }
                      setWalkInEmail(e.target.value);
                      setWalkInMemberInfo(null);
                      setWalkInLookupLoading(false);
                    }}
                    onBlur={(e) => findMemberByEmail(e.target.value)}
                    placeholder="กรอกอีเมลเพื่อตรวจสอบสมาชิก..."
                    className="w-full bg-slate-100 p-3 rounded-xl text-sm font-bold focus:outline-none"
                  />
                  {walkInMemberStatusMessage && (
                    <div className="mt-1 text-[11px] leading-4 font-bold">
                      <span className={walkInLookupLoading ? 'text-indigo-600' : walkInMemberInfo ? 'text-emerald-600' : 'text-slate-400'}>
                        {walkInMemberStatusMessage}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อลูกค้า</label>
                  <input type="text" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} placeholder="กรอกชื่อเพื่อเปิดสิทธิ์ใช้งาน..." className="w-full bg-slate-100 p-3 rounded-xl text-sm font-bold focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input type="tel" value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} placeholder="กรอกเบอร์โทรศัพท์ (ถ้ามี)..." className="w-full bg-slate-100 p-3 rounded-xl text-sm font-bold focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">จำนวนผู้เข้าใช้บริการ (ท่าน)</label>
                <input type="number" min="1" value={walkInGuests} onChange={(e) => setWalkInGuests(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl text-sm font-bold focus:outline-none" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 mb-1">ต้องการผู้สอนพื้นฐานการเล่นกอล์ฟหรือไม่?</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => setWalkInInstructor(true)} className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${walkInInstructor ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-white'}`}>ต้องการ</button>
                  <button onClick={() => setWalkInInstructor(false)} className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${!walkInInstructor ? 'bg-rose-100 border-rose-300 text-rose-800' : 'bg-white'}`}>ไม่ต้องการ</button>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 mb-1">ต้องการเช่าไม้กอล์ฟหรือไม่?</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setWalkInNeedsClubRent(true)}
                    className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${walkInNeedsClubRent ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-white'}`}
                  >
                    ต้องการเช่า
                  </button>
                  <button
                    onClick={() => { setWalkInNeedsClubRent(false); setWalkInSelectedClubs([]); }}
                    className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${!walkInNeedsClubRent ? 'bg-rose-100 border-rose-300 text-rose-800' : 'bg-white'}`}
                  >
                    ไม่ต้องการเช่า
                  </button>
                </div>
                {walkInNeedsClubRent && walkInSelectedClubs.length > 0 && (
                  <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    เลือกไม้กอล์ฟไว้แล้ว {walkInSelectedClubs.reduce((sum, item) => sum + Number(item.qty || 0), 0)} ชิ้น
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button onClick={() => { setIsWalkInModalOpen(false); setWalkInLookupLoading(false); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-sm">ย้อนกลับ</button>
              <button onClick={walkInNeedsClubRent ? proceedToWalkInClubSelection : handleSaveWalkInSubmission} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-sm shadow">
                {walkInNeedsClubRent ? 'ไปหน้าเลือกไม้กอล์ฟ' : (isMemberLaneActivation ? 'ยืนยันและเปิดใช้งานทันที' : 'ยืนยันและเปิดเลน')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Component เธขเนเธญเธขเธชเธณเธซเธฃเธฑเธเธ”เธนเนเธฅเธฐเนเธเนเนเธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฒเธฃเธเธญเธ */}
      {walkInModalStep === 'clubs' && !isShopClosed && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white p-4 sm:p-6 rounded-3xl sm:rounded-[2rem] shadow-2xl border text-left">
            <h3 className="text-xl font-black text-slate-800 border-b pb-2 mb-4">เลือกไม้กอล์ฟสำหรับเช่า</h3>
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">
                ลูกค้า: <span className="text-slate-800">{walkInName || '-'}</span>
              </div>
              {walkInClubsLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-400">
                  กำลังโหลดข้อมูลไม้กอล์ฟ...
                </div>
              ) : walkInClubInventory.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-400">
                  ไม่มีไม้กอล์ฟพร้อมให้เช่าในตอนนี้
                </div>
              ) : (
                <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {walkInClubInventory.map((club) => {
                    const selectedItem = walkInSelectedClubs.find((item) => item.clubId === club.id);
                    const qty = selectedItem ? Number(selectedItem.qty || 0) : 0;
                    return (
                      <div key={club.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-800">{club.name}</div>
                            <div className="text-xs font-bold text-slate-400">{club.type || 'ไม่ระบุประเภทไม้'}</div>
                            <div className="mt-1 text-xs font-bold text-emerald-600">พร้อมใช้งาน {club.available} ชิ้น</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-slate-400">ราคา/ชิ้น</div>
                            <div className="text-sm font-black text-slate-800">{club.price} บาท</div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button type="button" onClick={() => handleWalkInClubQtyChange(club, -1)} className="h-9 w-9 rounded-full border border-slate-300 bg-white text-lg font-black text-slate-600">-</button>
                          <div className="min-w-[52px] rounded-xl bg-white px-3 py-2 text-center text-sm font-black text-slate-800">{qty}</div>
                          <button type="button" onClick={() => handleWalkInClubQtyChange(club, 1)} className="h-9 w-9 rounded-full border border-emerald-300 bg-emerald-100 text-lg font-black text-emerald-700">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button onClick={() => { setWalkInModalStep('details'); setIsWalkInModalOpen(true); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-sm">ย้อนกลับไปฟอร์ม</button>
              <button onClick={handleSaveWalkInSubmission} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-sm shadow">ยืนยันและเปิดเลน</button>
            </div>
          </div>
        </div>
      )}

      <BookingDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        focusedCellInfo={focusedCellInfo}
        currentBooking={currentBooking}
        isShopClosed={isShopClosed}
        isOwner={isOwner} 
        onCheckIn={handleCheckInBooking}
        onClearToAvailable={handleClearToAvailable}
        onUpdateBooking={async (bookingId, updatedData) => {
          // ๐”’ เธเนเธญเธเธเธฑเธเธเธฑเนเธเน€เธ”เนเธ”เธเธฒเธ”: เธซเนเธฒเธกเธเธเธฑเธเธเธฒเธเนเธญเธเธชเนเธเธเธณเธชเธฑเนเธเธญเธฑเธเน€เธ”เธ•เธชเธ–เธฒเธเธฐเธเธฒเธฃเธเธญเธเธ—เธฑเนเธงเนเธเนเธซเนเธเธฅเธฒเธขเน€เธเนเธ เธเธดเธ”เธเธฃเธฑเธเธเธฃเธธเธ (maintenance)
          const newStatus = (updatedData?.status || updatedData?.Status || '').toString().toLowerCase();
          if (!isOwner && newStatus === 'maintenance') {
            setAlertPopup({
              isOpen: true,
              type: 'warning',
              title: 'ปฏิเสธการเข้าถึง',
              message: 'ขออภัย เฉพาะเจ้าของร้านเท่านั้นที่สามารถตั้งค่าเป็นสถานะปิดปรับปรุงได้',
              onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
            });
            return;
          }

          try {
            await updateDoc(doc(db, "bookings", bookingId), updatedData);
            setIsDetailModalOpen(false);
            fetchData(); 
          } catch(err) { 
            console.error(err); 
            setAlertPopup({
              isOpen: true,
              type: 'danger',
              title: 'เกิดข้อผิดพลาด',
              message: "เกิดข้อผิดพลาดขณะอัปเดตข้อมูล: " + err.message,
              onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
            });
          }
        }}
        onDeleteBooking={(bookingId) => {
          setAlertPopup({
            isOpen: true,
            type: 'danger',
            title: 'ยืนยันการลบรายการจอง',
            message: 'คุณต้องการลบรายการจองนี้ออกจากระบบอย่างถาวรใช่หรือไม่?',
            onConfirm: async () => {
              try {
                await deleteDoc(doc(db, "bookings", bookingId));
                setIsDetailModalOpen(false);
                setAlertPopup({
                  isOpen: true,
                  type: 'info',
                  title: 'ลบข้อมูลสำเร็จ',
                  message: 'ระบบทำการลบข้อมูลรายการจองนี้ออกจากระบบอย่างถาวรเรียบร้อยแล้ว',
                  onConfirm: () => { setAlertPopup(prev => ({ ...prev, isOpen: false })); fetchData(); }
                });
              } catch (err) {
                console.error(err);
                setAlertPopup({
                  isOpen: true,
                  type: 'danger',
                  title: 'เกิดข้อผิดพลาด',
                  message: "เกิดข้อผิดพลาดขณะลบข้อมูล: " + err.message,
                  onConfirm: () => setAlertPopup(prev => ({ ...prev, isOpen: false }))
                });
              }
            }
          });
        }}
      />

      <Popup 
        isOpen={alertPopup.isOpen} 
        type={alertPopup.type} 
        title={alertPopup.title} 
        message={alertPopup.message} 
        onConfirm={alertPopup.onConfirm} 
        onCancel={() => setAlertPopup(prev => ({ ...prev, isOpen: false }))} 
      />
    </div>
  );
}

export default LaneManagement;

