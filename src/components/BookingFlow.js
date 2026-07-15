// ไฟล์: BookingFlow.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, setDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import { CheckIcon, UserIcon, WrenchIcon } from './AppIcons';
import {
    getClubName,
    getClubPrice,
    getClubRepairQty,
    getClubTotalQty,
    getClubType,
    sortGolfClubsLikeInventory
} from '../utils/golfClubUtils';
import { areSelectedSlotsContiguous, isSelectedSlotsDraftValid } from '../utils/bookingTimeUtils';
import { normalizeWholeNumberInput, toWholeNumber } from '../utils/numberUtils';

const BookingFlow = ({ user, userData }) => {
    const [step, setStep] = useState(1);
    const [bookingData, setBookingData] = useState({
        date: '',
        customerName: '',
        phone: '',
        guests: 1,
        needsInstructor: false,
        needsClubRent: false
    });

    const [selectedSlots, setSelectedSlots] = useState({});
    const [dragSelection, setDragSelection] = useState(null);
    const [dbBookings, setDbBookings] = useState([]); 
    const [baseLanes, setBaseLanes] = useState({});
    const [clubCart, setClubCart] = useState([]);
    const [clubInventory, setClubInventory] = useState([]);
    const [loading, setLoading] = useState(false);

    const [modal, setModal] = useState({
        isOpen: false,
        message: '',
        type: 'info'
    });

    const TOTAL_LANES = 15;
    const laneNumbers = Array.from({ length: TOTAL_LANES }, (_, i) => i + 1);
    
    const TIME_SLOTS = [
        "08:00-09:00", "09:00-10:00", "10:00-11:00", "11:00-12:00",
        "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00",
        "16:00-17:00", "17:00-18:00", "18:00-19:00"
    ];

    const showAlert = (message, type = 'warning') => {
        setModal({ isOpen: true, message, type });
    };

    const closeModal = () => {
        setModal({ ...modal, isOpen: false });
        if (modal.type === 'success') {
            window.location.reload();
        }
    };

    const getMemberName = () => (
        userData?.FullName ||
        userData?.fullName ||
        userData?.displayName ||
        user?.displayName ||
        ''
    );

    const getMemberPhone = () => (
        userData?.PhoneNumber ||
        userData?.phoneNumber ||
        userData?.phone ||
        user?.phoneNumber ||
        ''
    );

    const getMemberEmail = () => (
        userData?.Email ||
        userData?.email ||
        user?.email ||
        ''
    );

    const proceedToCustomerDetails = () => {
        if (!areSelectedSlotsContiguous(selectedSlots, TIME_SLOTS)) {
            showAlert('กรุณาเลือกช่วงเวลาให้เหมือนกันทุกเลนก่อนดำเนินการต่อ เช่น เลน 1 และเลน 2 ต้องเป็นเวลา 08:00-10:00 เหมือนกัน', 'warning');
            return;
        }

        setBookingData((prev) => ({
            ...prev,
            customerName: prev.customerName || getMemberName(),
            phone: prev.phone || getMemberPhone()
        }));
        setStep(3);
    };

    const checkShopClosureStatus = async () => {
        if (!bookingData.date) {
            showAlert("กรุณาระบุวันที่ก่อนดำเนินการต่อ", 'warning');
            return;
        }

        setLoading(true);
        try {
            const [year, month, day] = bookingData.date.split('-').map(Number);
            const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
            const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

            const closureRef = collection(db, "shop_closures");
            const q = query(
                closureRef, 
                where("date", ">=", Timestamp.fromDate(startOfDay)),
                where("date", "<=", Timestamp.fromDate(endOfDay))
            );
            
            const querySnapshot = await getDocs(q);

            const activeClosureDoc = querySnapshot.docs.find((closureDoc) => {
                const data = closureDoc.data();
                return (data.status || 'active') === 'active';
            });

            if (activeClosureDoc) {
                const closureData = activeClosureDoc.data();
                const reason = closureData.reason || "ปรับปรุงสนามประจำปี";
                showAlert(`ขออภัยในความไม่สะดวก วันที่ ${bookingData.date} ทางร้านปิดให้บริการชั่วคราวเนื่องจาก: ${reason}`, 'error');
                setLoading(false);
                return;
            }

            setStep(2);
        } catch (err) {
            console.error(err);
            showAlert("เกิดข้อผิดพลาดในการตรวจสอบวันปิดร้าน: " + err.message, 'error');
        }
        setLoading(false); // แก้ไขจาก loading(false) เป็น setLoading(false) เรียบร้อยครับ
    };

    useEffect(() => {
        const fetchBookingsByDate = async () => {
            if (!bookingData.date) {
                setDbBookings([]);
                setBaseLanes({});
                return;
            }
            try {
                const bookingsRef = collection(db, "bookings");
                const q = query(
                    bookingsRef, 
                    where("bookingDate", "==", bookingData.date),
                    where("status", "in", ["pending", "confirmed", "occupied", "maintenance"])
                );
                const [snap, laneSnap] = await Promise.all([
                    getDocs(q),
                    getDocs(collection(db, "lanes"))
                ]);
                
                const list = [];
                snap.forEach(doc => {
                    list.push(doc.data());
                });

                const lanesData = {};
                laneSnap.forEach(laneDoc => {
                    const data = laneDoc.data();
                    if (data && data.laneNumber) {
                        lanesData[data.laneNumber.toString()] = data;
                    }
                });

                setDbBookings(list);
                setBaseLanes(lanesData);
            } catch (err) {
                console.error("Error fetching bookings:", err);
            }
        };

        if (step === 2 || step === 4) {
            fetchBookingsByDate();
        }
    }, [bookingData.date, step]);

    useEffect(() => {
        const fetchClubsAndCalculateAvail = async () => {
            setLoading(true);
            try {
                const snap = await getDocs(collection(db, "golf_clubs"));
                const rentedQtyMap = {};

                dbBookings.forEach(b => {
                    if (['pending', 'confirmed', 'occupied'].includes(b.status) && b.rentedClubs && Array.isArray(b.rentedClubs)) {
                        b.rentedClubs.forEach(clubItem => {
                            const qty = Number(clubItem.qty || 0);
                            rentedQtyMap[clubItem.clubId] = (rentedQtyMap[clubItem.clubId] || 0) + qty;
                        });
                    }
                });

                const data = snap.docs
                  .map(d => {
                    const clubData = d.data();
                    const totalQty = getClubTotalQty(clubData);
                    const repairQty = getClubRepairQty(clubData);
                    const rentedQty = rentedQtyMap[d.id] || 0;
                    
                    return {
                        id: d.id,
                        name: getClubName(clubData),
                        type: getClubType(clubData),
                        price: getClubPrice(clubData),
                        available: Math.max(0, totalQty - repairQty - rentedQty),
                        isActive: clubData.Is_Active !== false
                    };
                  })
                  .filter((club) => club.isActive);

                setClubInventory(sortGolfClubsLikeInventory(data));
            } catch (err) {
                console.error("Error fetching golf clubs:", err);
            }
            setLoading(false);
        };

        if (step === 4) {
            fetchClubsAndCalculateAvail();
        }
    }, [step, dbBookings]);

    useEffect(() => {
        const stopDragSelection = () => setDragSelection(null);
        window.addEventListener('mouseup', stopDragSelection);
        return () => window.removeEventListener('mouseup', stopDragSelection);
    }, []);

    const isLaneUnderMaintenance = (laneNum) => {
        return (baseLanes[laneNum.toString()]?.status || '').toLowerCase() === 'maintenance';
    };

    const getSlotBooking = (laneNum, slot) => {
        const laneKey = `lane_${laneNum}`;

        return dbBookings.find(b => {
            const selectedLanes = Array.isArray(b.selectedLanes) ? b.selectedLanes : [];
            const timeSlots = Array.isArray(b.timeSlots) ? b.timeSlots : [];
            const detailedSlots = b.detailedSlots || b.Detailed_Slots || {};
            const hasDetailedSlots = detailedSlots && Object.keys(detailedSlots).length > 0;
            const hasLane = hasDetailedSlots
                ? Array.isArray(detailedSlots[laneKey])
                : selectedLanes.some((lane) => Number(lane) === Number(laneNum));
            const hasSlot = hasDetailedSlots
                ? detailedSlots[laneKey]?.includes(slot)
                : timeSlots.includes(slot);
            return hasLane && hasSlot;
        }) || null;
    };

    const isOwnBookingRecord = (booking) => {
        if (!booking) return false;
        const currentUserId = user?.uid || '';
        const currentEmail = getMemberEmail().trim().toLowerCase();
        const bookingUserId = booking.User_ID || booking.userId || booking.uid || '';
        const bookingEmail = (
            booking.customerEmail ||
            booking.Email ||
            booking.email ||
            booking.Customer_Email ||
            ''
        ).trim().toLowerCase();

        return Boolean(
            (currentUserId && bookingUserId && currentUserId === bookingUserId) ||
            (currentEmail && bookingEmail && currentEmail === bookingEmail)
        );
    };

    const isSlotBookedInDB = (laneNum, slot) => {
        if (isLaneUnderMaintenance(laneNum)) return true;
        return Boolean(getSlotBooking(laneNum, slot));
    };

    const handleSlotClick = (laneNum, slot) => {
        if (isSlotBookedInDB(laneNum, slot)) return; 

        const laneKey = `lane_${laneNum}`;
        const currentLaneSlots = selectedSlots[laneKey] || [];
        applySlotSelection(laneNum, slot, !currentLaneSlots.includes(slot));
    };

    const applySlotSelection = (laneNum, slot, shouldSelect) => {
        if (isSlotBookedInDB(laneNum, slot)) return;

        const laneKey = `lane_${laneNum}`;
        setSelectedSlots((prevSelectedSlots) => {
            const currentLaneSlots = prevSelectedSlots[laneKey] || [];

            if (!shouldSelect && currentLaneSlots.includes(slot)) {
                const updated = currentLaneSlots.filter(s => s !== slot);
                if (updated.length === 0) {
                    const copy = { ...prevSelectedSlots };
                    delete copy[laneKey];
                    return copy;
                }
                const nextSelectedSlots = { ...prevSelectedSlots, [laneKey]: updated };
                if (!isSelectedSlotsDraftValid(nextSelectedSlots, TIME_SLOTS)) {
                    showAlert('ไม่สามารถเลือกแบบข้ามเลนข้ามเวลาได้ ทุกเลนที่เลือกต้องใช้ช่วงเวลาเดียวกันและเวลาต้องติดกัน', 'warning');
                    return prevSelectedSlots;
                }
                return nextSelectedSlots;
            }

            if (shouldSelect && !currentLaneSlots.includes(slot)) {
                const nextSelectedSlots = { ...prevSelectedSlots, [laneKey]: [...currentLaneSlots, slot] };
                if (!isSelectedSlotsDraftValid(nextSelectedSlots, TIME_SLOTS)) {
                    showAlert('ไม่สามารถเลือกแบบข้ามเลนข้ามเวลาได้ ทุกเลนที่เลือกต้องใช้ช่วงเวลาเดียวกันและเวลาต้องติดกัน', 'warning');
                    return prevSelectedSlots;
                }
                return nextSelectedSlots;
            }

            return prevSelectedSlots;
        });
    };

    const handleSlotMouseDown = (laneNum, slot) => {
        if (isSlotBookedInDB(laneNum, slot)) return;
        const laneKey = `lane_${laneNum}`;
        const shouldSelect = !(selectedSlots[laneKey] || []).includes(slot);
        setDragSelection({ shouldSelect });
        applySlotSelection(laneNum, slot, shouldSelect);
    };

    const handleSlotMouseEnter = (laneNum, slot) => {
        if (!dragSelection) return;
        applySlotSelection(laneNum, slot, dragSelection.shouldSelect);
    };

    const getTotalSelectedSlotsCount = () => {
        return Object.values(selectedSlots).reduce((acc, curr) => acc + curr.length, 0);
    };

    const getSelectedLanesArray = () => {
        return Object.keys(selectedSlots).map(key => parseInt(key.replace('lane_', ''))).sort((a,b)=>a-b);
    };

    const hasMoreSelectedLanesThanGuests = () => {
        const selectedLaneCount = getSelectedLanesArray().length;
        const guestCount = toWholeNumber(bookingData.guests || 0);
        return selectedLaneCount > guestCount;
    };

    const getSelectedTimeSlotsLabel = () => {
        const slots = Array.from(new Set(Object.values(selectedSlots).flat())).sort();
        return slots.length > 0 ? slots.join(', ') : '-';
    };

    const handleClubCartUpdate = (club, change) => {
        const existing = clubCart.find(item => item.id === club.id);
        if (existing) {
            const newQty = Math.max(0, existing.qty + change);
            if (newQty > club.available) {
                showAlert(`ไม้กอล์ฟนี้พร้อมใช้งานหน้าตู้เหลือเพียง ${club.available} ชิ้นเท่านั้น`, 'warning');
                return;
            }
            if (newQty === 0) {
                setClubCart(clubCart.filter(item => item.id !== club.id));
            } else {
                setClubCart(clubCart.map(item => item.id === club.id ? { ...item, qty: newQty } : item));
            }
        } else if (change > 0) {
            if (club.available < 1) {
                showAlert("อุปกรณ์ชิ้นนี้หมดสต็อกชั่วคราว", 'warning');
                return;
            }
            setClubCart([...clubCart, { ...club, qty: 1 }]);
        }
    };

    const validateAndProceedFromStep3 = () => {
        if (!bookingData.customerName.trim()) {
            showAlert("กรุณากรอกชื่อผู้จอง", 'warning');
            return;
        }
        if (bookingData.phone.length !== 10) {
            showAlert("กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลขให้ครบ 10 หลัก", 'warning');
            return;
        }
        if (hasMoreSelectedLanesThanGuests()) {
            showAlert('จำนวนเลนที่เลือกมากกว่าจำนวนผู้เข้าใช้งาน กรุณาปรับจำนวนผู้เข้าใช้งานหรือเลือกเลนให้น้อยลง', 'warning');
            return;
        }

        if (bookingData.needsClubRent) {
            setStep(4);
        } else {
            handleBookingSubmission();
        }
    };

    const handleBookingSubmission = async () => {
        if (!bookingData.customerName.trim() || bookingData.phone.length !== 10) {
            showAlert("กรุณากรอกชื่อและเบอร์โทรศัพท์ติดต่อของลูกค้าให้ครบ 10 หลัก", 'warning');
            return;
        }

        try {
            const lanesArray = getSelectedLanesArray();
            const allTimeSlots = Array.from(new Set(Object.values(selectedSlots).flat())).sort();

            if (lanesArray.length > toWholeNumber(bookingData.guests || 0)) {
                showAlert('จำนวนเลนที่เลือกมากกว่าจำนวนผู้เข้าใช้งาน กรุณาปรับจำนวนผู้เข้าใช้งานหรือเลือกเลนให้น้อยลง', 'warning');
                return;
            }

            if (!areSelectedSlotsContiguous(selectedSlots, TIME_SLOTS)) {
                showAlert('ไม่สามารถเลือกแบบข้ามเลนข้ามเวลาได้ ทุกเลนที่เลือกต้องใช้ช่วงเวลาเดียวกันและเวลาต้องติดกัน', 'warning');
                return;
            }

            const finalBookingData = {
                bookingDate: bookingData.date,
                timeSlots: allTimeSlots, 
                detailedSlots: selectedSlots, 
                customerName: bookingData.customerName,
                customerPhone: bookingData.phone,
                customerEmail: getMemberEmail(),
                User_ID: user?.uid || '',
                bookingType: 'online-member',
                guestCount: Math.max(1, toWholeNumber(bookingData.guests || 1)),
                needsInstructor: bookingData.needsInstructor,
                needsClubRent: bookingData.needsClubRent,
                selectedLanes: lanesArray, 
                laneNumber: lanesArray.join(", "),
                rentedClubs: bookingData.needsClubRent ? clubCart.map(i => ({ clubId: i.id, Club_Name: i.name, Club_Type: i.type, qty: i.qty, price: i.price })) : [],
                status: 'pending',
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, "bookings"), finalBookingData);

            for (const num of lanesArray) {
                const docId = `lane_${num}`;
                await setDoc(doc(db, "lanes", docId), {
                    laneNumber: num,
                    status: 'booked',
                    customerName: bookingData.customerName,
                    customerPhone: bookingData.phone,
                    customerEmail: getMemberEmail(),
                    User_ID: user?.uid || '',
                    guestCount: Math.max(1, toWholeNumber(bookingData.guests || 1))
                });
            }

            showAlert("ระบบบันทึกตารางจองแบบระบุเวลาและลงทะเบียนอุปกรณ์เรียบร้อย!", 'success');
        } catch (err) {
            showAlert("เกิดปัญหาข้อผิดพลาด: " + err.message, 'error');
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto p-2 sm:p-4 font-sans text-slate-800 relative">
            {/* สเต็ป 1: เลือกเฉพาะ วัน/เดือน/ปี */}
            {step === 1 && (
                <div className="flex flex-col items-center justify-center min-h-[420px] sm:min-h-[500px] rounded-3xl border border-slate-200 bg-slate-50 px-3 py-8 sm:px-6 sm:py-12 shadow-inner">
                    <div className="relative flex items-center mb-6 sm:mb-10 w-full justify-center">
                        <div className="hidden sm:block w-10 h-8 bg-emerald-100 border border-emerald-200 rounded-l-md"></div>
                        <div className="bg-white border border-slate-200 px-4 sm:px-14 py-3 rounded-2xl text-lg sm:text-2xl font-black tracking-wide shadow-md text-center leading-tight text-slate-800">
                            ระบบจองสนาม เมืองเลยไดร์ฟกอล์ฟ
                        </div>
                        <div className="hidden sm:block w-10 h-8 bg-emerald-100 border border-emerald-200 rounded-r-md"></div>
                    </div>

                    <div className="w-full max-w-xl bg-white rounded-3xl p-4 sm:p-8 border border-slate-200 shadow-md text-left">
                        <h3 className="text-xl font-black mb-4 text-slate-800">ขั้นตอนที่ 1: เลือกวันที่เข้าใช้บริการ</h3>
                        <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">ระบุวัน/เดือน/ปี</label>
                            <input 
                                type="date" 
                                value={bookingData.date}
                                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-base font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" 
                                onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                            />
                        </div>

                        <div className="text-center">
                            <button 
                                onClick={checkShopClosureStatus}
                                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 sm:px-12 py-3 rounded-xl border border-emerald-700 text-base sm:text-lg shadow-sm transition-all active:scale-95"
                            >
                                ถัดไป (เลือกเลนและเวลา)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* สเต็ป 2: หน้าเลือกเลนและตารางช่วงเวลา */}
            {step === 2 && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="bg-white p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center border border-slate-200 shadow-sm">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-800">ขั้นตอนที่ 2: เลือกเลนและเวลาใช้งาน</h2>
                            <p className="text-sm font-bold text-emerald-700 mt-1">ประจำวันที่: {bookingData.date}</p>
                        </div>
                        <div className="flex flex-wrap gap-3 sm:gap-4 mt-3 md:mt-0">
                            <span className="flex items-center gap-1 text-xs font-bold text-slate-700"><span className="w-4 h-4 bg-white border border-slate-300 rounded"></span> ว่าง</span>
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-800"><span className="w-4 h-4 bg-emerald-100 border border-emerald-300 rounded"></span> กำลังเลือก</span>
                            <span className="flex items-center gap-1 text-xs font-bold text-violet-800"><span className="w-4 h-4 bg-violet-50 border border-violet-200 rounded"></span> คุณจองไว้แล้ว</span>
                            <span className="flex items-center gap-1 text-xs font-bold text-slate-700"><span className="w-4 h-4 bg-cyan-50 border border-cyan-200 rounded"></span> มีคนจองแล้ว</span>
                            <span className="flex items-center gap-1 text-xs font-bold text-rose-800"><span className="w-4 h-4 bg-rose-100 border border-rose-300 rounded"></span> ปิดปรับปรุง</span>
                        </div>
                    </div>

                    <div className="md:hidden space-y-3">
                        {laneNumbers.map((laneNum) => {
                            const laneKey = `lane_${laneNum}`;
                            const currentLaneSlots = selectedSlots[laneKey] || [];

                            return (
                                <div key={laneNum} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <div>
                                            <h3 className="font-black text-slate-800">เลน {laneNum}</h3>
                                            <p className="text-[11px] font-bold text-slate-400">
                                                เลือกแล้ว {currentLaneSlots.length} ช่วงเวลา
                                            </p>
                                        </div>
                                        {currentLaneSlots.length > 0 && (
                                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-1 rounded-lg text-[10px] font-black">
                                                กำลังเลือก
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        {TIME_SLOTS.map(slot => {
                                            const isMaintenance = isLaneUnderMaintenance(laneNum);
                                            const slotBooking = getSlotBooking(laneNum, slot);
                                            const isOwnBooked = isOwnBookingRecord(slotBooking);
                                            const isBooked = isSlotBookedInDB(laneNum, slot);
                                            const isSelecting = currentLaneSlots.includes(slot);

                                            return (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    disabled={isBooked}
                                                    onClick={() => handleSlotClick(laneNum, slot)}
                                                    className={`min-h-[44px] rounded-xl border px-2 py-2 text-xs font-black transition-all ${
                                                        isMaintenance
                                                            ? 'bg-rose-100 text-rose-700 border-rose-300 cursor-not-allowed'
                                                            : isOwnBooked
                                                            ? 'bg-violet-50 text-violet-800 border-violet-200 cursor-not-allowed'
                                                            : isBooked
                                                            ? 'bg-cyan-50 text-slate-700 border-cyan-200 cursor-not-allowed'
                                                            : isSelecting
                                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-inner ring-2 ring-emerald-200'
                                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                                                    }`}
                                                >
                                                    <span className="block">{slot}</span>
                                                    <span className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold opacity-90">
                                                        {isMaintenance ? (
                                                            <>
                                                                <WrenchIcon className="h-3 w-3" /> ปิดปรับปรุง
                                                            </>
                                                        ) : isOwnBooked ? (
                                                            <>
                                                                <CheckIcon className="h-3 w-3" /> คุณจองไว้แล้ว
                                                            </>
                                                        ) : isBooked ? (
                                                            <>
                                                                <UserIcon className="h-3 w-3" /> จองแล้ว
                                                            </>
                                                        ) : isSelecting ? (
                                                            <>
                                                                <CheckIcon className="h-3 w-3" /> เลือกไว้
                                                            </>
                                                        ) : 'ว่าง'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="hidden md:block border border-slate-200 rounded-2xl bg-white shadow-sm overflow-x-auto">
                        <table className="w-full min-w-[1000px] border-collapse text-center">
                            <thead>
                                <tr className="bg-slate-100 border-b border-slate-200">
                                    <th className="p-4 font-black text-slate-700 bg-slate-200 sticky left-0 z-10 w-28 border-r">เลนซ้อม</th>
                                    {TIME_SLOTS.map(slot => (
                                        <th key={slot} className="p-3 text-xs font-black text-slate-600 border-r min-w-[90px]">
                                            {slot}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {laneNumbers.map((laneNum) => {
                                    const laneKey = `lane_${laneNum}`;
                                    const currentLaneSlots = selectedSlots[laneKey] || [];

                                    return (
                                        <tr key={laneNum} className="border-b border-slate-100 hover:bg-slate-50/80">
                                            <td className="p-3 font-extrabold text-slate-800 bg-slate-50 sticky left-0 z-10 border-r border-slate-200 shadow-sm">
                                                เลน {laneNum}
                                            </td>
                                            
                                            {TIME_SLOTS.map(slot => {
                                                const isMaintenance = isLaneUnderMaintenance(laneNum);
                                                const slotBooking = getSlotBooking(laneNum, slot);
                                                const isOwnBooked = isOwnBookingRecord(slotBooking);
                                                const isBooked = isSlotBookedInDB(laneNum, slot);
                                                const isSelecting = currentLaneSlots.includes(slot);

                                                let slotStyle = "bg-white hover:bg-slate-100 cursor-pointer text-transparent border border-slate-200";
                                                if (isMaintenance) {
                                                    slotStyle = "bg-rose-100 text-rose-700 cursor-not-allowed font-black border-4 border-rose-300 rounded-lg";
                                                } else if (isOwnBooked) {
                                                    slotStyle = "bg-violet-50 text-violet-800 cursor-not-allowed font-black border-4 border-violet-300 rounded-lg";
                                                } else if (isBooked) {
                                                    slotStyle = "bg-cyan-50 text-slate-700 cursor-not-allowed font-black border-4 border-sky-300 rounded-lg";
                                                } else if (isSelecting) {
                                                    slotStyle = "bg-emerald-100 text-emerald-800 font-black border border-emerald-300 shadow-inner animate-pulse";
                                                }

                                                return (
                                                    <td 
                                                        key={slot}
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            handleSlotMouseDown(laneNum, slot);
                                                        }}
                                                        onMouseEnter={() => handleSlotMouseEnter(laneNum, slot)}
                                                        onMouseUp={() => setDragSelection(null)}
                                                        className={`p-3 text-xs transition-all select-none ${slotStyle}`}
                                                    >
                                                        {isMaintenance ? (
                                                            <WrenchIcon className="mx-auto h-4 w-4 text-rose-600" />
                                                        ) : isOwnBooked ? (
                                                            <CheckIcon className="mx-auto h-4 w-4 text-violet-700" />
                                                        ) : isBooked ? (
                                                            <UserIcon className="mx-auto h-4 w-4 text-slate-600" />
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

                    <div className="border border-emerald-200 rounded-xl p-5 bg-emerald-50 flex flex-col md:flex-row items-start md:items-center justify-between shadow-md gap-4 animate-slideUp">
                        <div className="text-left w-full">
                            <div className="text-base font-bold text-slate-700">
                                จำนวนช่องเวลาที่เลือกทั้งหมด : <span className="text-emerald-700 font-black text-xl">{getTotalSelectedSlotsCount()}</span> ช่อง
                            </div>
                            <div className="text-xs text-slate-500 font-bold mt-1">
                                เลนที่ได้รับเลือก: {getSelectedLanesArray().length > 0 ? getSelectedLanesArray().map(l => `เลน ${l}`).join(', ') : 'ยังไม่ได้เลือก'}
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:shrink-0">
                            <button onClick={() => setStep(1)} className="w-full sm:w-auto bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold px-4 py-2 rounded-lg text-xs transition-all">
                                ย้อนกลับ
                            </button>
                            <button 
                                disabled={getTotalSelectedSlotsCount() === 0}
                                onClick={proceedToCustomerDetails}
                                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold px-5 py-2 rounded-lg transition-all text-xs shadow-sm"
                            >
                                ดำเนินการต่อ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* สเต็ป 3: กรอกข้อมูลรายละเอียดผู้จอง */}
            {step === 3 && (
                <div className="max-w-2xl mx-auto bg-white p-4 sm:p-8 rounded-3xl shadow-sm border border-slate-100 text-left animate-fadeIn">
                    <div className="bg-slate-50 border border-slate-100 py-3 text-center rounded-2xl mb-8">
                        <h3 className="text-lg font-bold text-slate-800">วันที่ใช้งาน: {bookingData.date}</h3>
                        <p className="text-xs font-bold text-slate-600 mt-1">
                            หมายเลขเลนซ้อมที่เลือก: {getSelectedLanesArray().map((lane) => `เลน ${lane}`).join(', ')}
                        </p>
                        <p className="text-xs font-bold text-slate-600 mt-1">
                            เวลาที่ใช้งานเลนซ้อม: {getSelectedTimeSlotsLabel()}
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-base font-bold text-slate-800 mb-1">ชื่อผู้จอง</label>
                            <input 
                                type="text"
                                value={bookingData.customerName}
                                placeholder="กรอกชื่อผู้รับสิทธิ์การจอง..."
                                className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl focus:outline-none focus:border-emerald-400 font-bold"
                                onChange={(e) => setBookingData({ ...bookingData, customerName: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-base font-bold text-slate-800 mb-1">เบอร์โทรลูกค้า</label>
                            <input 
                                type="text"
                                value={bookingData.phone}
                                placeholder="กรอกเบอร์โทรศัพท์ 10 หลัก..."
                                className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl focus:outline-none focus:border-emerald-400 font-bold"
                                maxLength={10}
                                onChange={(e) => {
                                    const onlyNums = e.target.value.replace(/\D/g, '');
                                    setBookingData({ ...bookingData, phone: onlyNums });
                                }}
                            />
                        </div>

                        <div>
                            <label className="block text-base font-bold text-slate-800 mb-1">จำนวนผู้เข้ามาใช้งาน</label>
                            <input 
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={bookingData.guests}
                                className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl focus:outline-none focus:border-emerald-400 font-bold"
                                onChange={(e) => setBookingData({ ...bookingData, guests: normalizeWholeNumberInput(e.target.value) })}
                            />
                        </div>

                        <div className="space-y-4 pt-2">
                            <div>
                                <p className="text-base font-bold text-slate-800 mb-1">ต้องการผู้สอนพื้นฐานการเล่นกอล์ฟหรือไม่?</p>
                                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                    <button 
                                        onClick={() => setBookingData({ ...bookingData, needsInstructor: true })}
                                        className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 border transition-all ${bookingData.needsInstructor ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}
                                    >
                                        <input type="radio" checked={bookingData.needsInstructor === true} readOnly /> ต้องการ
                                    </button>
                                    <button 
                                        onClick={() => setBookingData({ ...bookingData, needsInstructor: false })}
                                        className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 border transition-all ${!bookingData.needsInstructor ? 'bg-slate-100 border-slate-200 text-slate-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}
                                    >
                                        <input type="radio" checked={bookingData.needsInstructor === false} readOnly /> ไม่ต้องการ
                                    </button>
                                </div>
                            </div>

                            <div>
                                <p className="text-base font-bold text-slate-800 mb-1">ต้องการเช่าไม้กอล์ฟหรือไม่?</p>
                                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                    <button 
                                        onClick={() => setBookingData({ ...bookingData, needsClubRent: true })}
                                        className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 border transition-all ${bookingData.needsClubRent ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}
                                    >
                                        <input type="radio" checked={bookingData.needsClubRent === true} readOnly /> ต้องการ
                                    </button>
                                    <button 
                                        onClick={() => setBookingData({ ...bookingData, needsClubRent: false })}
                                        className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 border transition-all ${!bookingData.needsClubRent ? 'bg-slate-100 border-slate-200 text-slate-700 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}
                                    >
                                        <input type="radio" checked={bookingData.needsClubRent === false} readOnly /> ไม่ต้องการ
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-6">
                            <button onClick={() => setStep(2)} className="flex-1 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-extrabold py-3 rounded-xl text-lg transition-all">
                                ย้อนกลับ
                            </button>
                            <button 
                                onClick={validateAndProceedFromStep3}
                                className="flex-1 bg-emerald-600 border border-emerald-700 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-lg transition-all"
                            >
                                {bookingData.needsClubRent ? 'ไปหน้าเลือกไม้กอล์ฟ' : 'ยืนยันการจอง'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* สเต็ป 4: หน้าต่างเลือกไม้กอล์ฟลงตะกร้าสินค้า */}
            {step === 4 && (
                <div className="space-y-6 text-left animate-fadeIn">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <h2 className="text-xl md:text-2xl font-black text-slate-800">เลือกไม้กอล์ฟให้ลูกค้า</h2>
                        <p className="text-xs font-black text-emerald-700 mt-1">แสดงจำนวนสต็อกสุทธิหน้าตู้ประจำวันที่: {bookingData.date}</p>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                        <div className="flex-[2] w-full space-y-4">
                            {loading && <p className="text-center text-slate-400 font-bold py-6">กำลังคำนวณคลังไม้กอล์ฟประจำวัน...</p>}
                            
                            {!loading && clubInventory.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">
                                    ยังไม่มีไม้กอล์ฟที่พร้อมให้เช่าในฐานข้อมูล
                                </div>
                            )}

                            {!loading && clubInventory.map((club) => {
                                const cartItem = clubCart.find(i => i.id === club.id);
                                const currentQty = cartItem ? cartItem.qty : 0;

                                return (
                                    <div key={club.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm">
                                        <div>
                                            <h4 className="text-xl font-bold text-slate-800">{club.name}</h4>
                                            <p className="text-xs font-black text-emerald-700 mt-0.5">{club.type}</p>
                                            <p className={`text-sm font-bold mt-1 ${club.available === 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                พร้อมให้เช่าจริงหน้าตู้ในวันนี้ : {club.available} ชิ้น
                                            </p>
                                        </div>
                                        
                                        <div className="flex items-center gap-4">
                                            <button type="button" onClick={() => handleClubCartUpdate(club, -1)} className="w-8 h-8 bg-slate-100 text-slate-600 hover:bg-slate-200 font-black rounded-lg text-lg flex items-center justify-center border border-slate-200">-</button>
                                            <span className="text-lg font-black w-6 text-center">{currentQty}</span>
                                            <button type="button" onClick={() => handleClubCartUpdate(club, 1)} className="w-8 h-8 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-black rounded-lg text-lg flex items-center justify-center border border-emerald-200">+</button>
                                        </div>
                                    </div>
                                );
                             })}
                        </div>

                        {/* สรุปตะกร้าขวา */}
                        <div className="flex-1 w-full lg:max-w-xs bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-xl font-black mb-4 tracking-wide">รายการยืมไม้</h3>
                            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                                {clubCart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg border text-sm font-bold">
                                        <span className="truncate max-w-[130px]">{item.name}</span>
                                        <span className="bg-slate-200 px-3 py-0.5 rounded text-slate-700">{item.qty} ชิ้น</span>
                                    </div>
                                ))}
                                {clubCart.length === 0 && <p className="text-slate-400 italic text-center py-4 text-sm">ยังไม่ได้เลือกไม้กอล์ฟ</p>}
                            </div>

                            <button onClick={handleBookingSubmission} className="w-full bg-emerald-600 border border-emerald-700 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl shadow-sm block text-center transition-all">
                                ยืนยันการจอง + ยืมไม้
                            </button>
                            <button onClick={() => setStep(3)} className="w-full text-center text-xs text-slate-500 font-bold mt-4 hover:underline">
                                ย้อนกลับ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOM POPUP MODAL COMPONENT */}
            {modal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-xl border border-slate-100 transform scale-100 transition-all">
                        <div className="mb-4 flex justify-center">
                            {modal.type === 'success' && <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 text-3xl font-bold">✓</div>}
                            {modal.type === 'warning' && <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-500 text-3xl font-bold">!</div>}
                            {modal.type === 'error' && <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 text-3xl font-bold">✕</div>}
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mb-2">
                            {modal.type === 'success' ? 'สำเร็จ' : modal.type === 'error' ? 'เกิดข้อผิดพลาด' : 'แจ้งเตือน'}
                        </h3>
                        <p className="text-slate-600 font-bold text-sm mb-6 whitespace-pre-line">
                            {modal.message}
                        </p>
                        <button
                            onClick={closeModal}
                            className={`w-full py-3 rounded-xl font-extrabold text-white transition-all active:scale-95 shadow-sm
                                ${modal.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                                ${modal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                                ${modal.type === 'error' ? 'bg-red-500 hover:bg-red-600' : ''}
                            `}
                        >
                            ตกลง
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingFlow;
