// ไฟล์: BookingDetailModal.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { collection, getDocs, query, where } from 'firebase/firestore';
import { SaveIcon } from './AppIcons';
import Popup from './Popup';
import {
  getClubName,
  getClubPrice,
  getClubRepairQty,
  getClubTotalQty,
  getClubType,
  sortGolfClubsLikeInventory
} from '../utils/golfClubUtils';

function BookingDetailModal({ 
  isOpen, 
  onClose, 
  focusedCellInfo, 
  currentBooking, 
  onCheckIn, 
  onClearToAvailable,
  onUpdateBooking,
  onDeleteBooking, 
  isShopClosed
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGuests, setEditGuests] = useState('1');
  
  const [editClubRent, setEditClubRent] = useState(false);
  // เก็บอาร์เรย์ของวัตถุไม้กอล์ฟที่ถูกเลือก [{ clubId, Club_Name, qty, price }]
  const [selectedClubs, setSelectedClubs] = useState([]); 
  const [editInstructor, setEditInstructor] = useState(false);

  const [dbClubs, setDbClubs] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [alertPopup, setAlertPopup] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  // =========================================================================
  // 1. คำนวณสต็อกหน้าตู้ยืดหยุ่น: หักลดเฉพาะจากใบจองที่ Check-in (`occupied`) แล้วเท่านั้น
  // =========================================================================
  useEffect(() => {
    const fetchClubsWithSmartStock = async () => {
      if (!isOpen || !currentBooking) return;
      setLoadingClubs(true);
      try {
        const clubSnap = await getDocs(collection(db, "golf_clubs"));
        const clubsMap = {};
        
        clubSnap.forEach((doc) => {
          const data = doc.data();
          if (data && getClubName(data)) {
            clubsMap[doc.id] = {
              id: doc.id,
              name: getClubName(data),
              type: getClubType(data),
              price: getClubPrice(data),
              totalQty: getClubTotalQty(data),
              repairQty: getClubRepairQty(data),
              isActive: data.Is_Active !== false,
              rentedByActiveOccupied: 0 
            };
          }
        });

        const targetDate = currentBooking.bookingDate;
        if (targetDate) {
          const bookingsRef = collection(db, "bookings");
          const q = query(
            bookingsRef,
            where("bookingDate", "==", targetDate),
            where("status", "in", ["pending", "confirmed", "occupied"])
          );
          const bookingSnap = await getDocs(q);

          bookingSnap.forEach((doc) => {
            if (doc.id === currentBooking.id) return; 
            
            const bData = doc.data();
            if (bData.rentedClubs && Array.isArray(bData.rentedClubs)) {
              bData.rentedClubs.forEach((clubItem) => {
                if (clubsMap[clubItem.clubId]) {
                  clubsMap[clubItem.clubId].rentedByActiveOccupied += Number(clubItem.qty || 0);
                }
              });
            }
          });
        }

        const finalClubsList = Object.values(clubsMap).map((club) => {
          let netAvailable = Math.max(0, club.totalQty - club.repairQty);

          if (currentBooking.status === 'occupied') {
            const selfItem = currentBooking.rentedClubs?.find(item => item.clubId === club.id);
            const selfQty = selfItem ? Number(selfItem.qty || 0) : 0;
            netAvailable = Math.max(0, club.totalQty - club.repairQty - club.rentedByActiveOccupied - selfQty);
          } else {
            netAvailable = Math.max(0, club.totalQty - club.repairQty - club.rentedByActiveOccupied);
          }

          return {
            id: club.id,
            name: club.name,
            type: club.type,
            price: club.price,
            available: netAvailable,
            isActive: club.isActive
          };
        }).filter((club) => club.isActive);

        setDbClubs(sortGolfClubsLikeInventory(finalClubsList));
      } catch (error) {
        console.error("Error calculating smart stock:", error);
      }
      setLoadingClubs(false);
    };

    fetchClubsWithSmartStock();
  }, [isOpen, currentBooking]);

  // ==========================================
  // 2. Sync ข้อมูลเดิมของการจองนี้เข้าสู่ State
  // ==========================================
  useEffect(() => {
    if (currentBooking) {
      setEditName(currentBooking.customerName || "");
      setEditPhone(currentBooking.customerPhone || currentBooking.phone || "");
      setEditGuests(currentBooking.guestCount || currentBooking.guests || "1");
      setEditClubRent(currentBooking.needsClubRent || false);
      setEditInstructor(currentBooking.needsInstructor || false);

      if (currentBooking.rentedClubs && Array.isArray(currentBooking.rentedClubs)) {
        setSelectedClubs(currentBooking.rentedClubs);
      } else {
        setSelectedClubs([]);
      }
    }
    setIsEditMode(false); 
  }, [currentBooking, isOpen]);

  if (!isOpen || !focusedCellInfo || isShopClosed) return null;

  const handleUpdateClubQty = (club, change) => {
    const existingItem = selectedClubs.find(item => item.clubId === club.id);
    const currentQty = existingItem ? existingItem.qty : 0;
    const newQty = Math.max(0, currentQty + change);

    if (currentBooking?.status === 'occupied') {
      const originalItem = currentBooking?.rentedClubs?.find(item => item.clubId === club.id);
      const originalQty = originalItem ? Number(originalItem.qty || 0) : 0;
      const diffQty = newQty - originalQty;

      if (diffQty > club.available) {
        setAlertPopup({
          isOpen: true,
          type: 'warning',
          title: 'จำนวนไม้กอล์ฟไม่เพียงพอ',
          message: `ไม้กอล์ฟประเภทนี้เหลือพร้อมใช้งานเพียง ${club.available} ชิ้นเท่านั้น`,
          onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false })),
          onCancel: null
        });
        return;
      }
    } else {
      if (newQty > club.available) {
        setAlertPopup({
          isOpen: true,
          type: 'warning',
          title: 'เลือกจำนวนเกินสต็อก',
          message: `ไม่สามารถเลือกเกินจำนวนคงเหลือสูงสุดของร้าน (${club.available} ชิ้น) ได้`,
          onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false })),
          onCancel: null
        });
        return;
      }
    }

    if (existingItem) {
      if (newQty === 0) {
        setSelectedClubs(selectedClubs.filter(item => item.clubId !== club.id));
      } else {
        setSelectedClubs(selectedClubs.map(item => 
          item.clubId === club.id ? { ...item, qty: newQty } : item
        ));
      }
    } else if (change > 0) {
      setSelectedClubs([...selectedClubs, { 
        clubId: club.id, 
        Club_Name: club.name, 
        qty: 1, 
        price: club.price 
      }]);
    }
  };

  const handleSubmitEdit = () => {
    if (!editName.trim()) {
      setAlertPopup({
        isOpen: true,
        type: 'danger',
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกชื่อผู้ใช้งาน',
        onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false })),
        onCancel: null
      });
      return;
    }
    if (editClubRent && selectedClubs.length === 0) {
      setAlertPopup({
        isOpen: true,
        type: 'warning',
        title: 'ยังไม่ได้เลือกไม้กอล์ฟ',
        message: "กรุณาเพิ่มไม้กอล์ฟอย่างน้อย 1 ชิ้น หรือเลือกสถานะเป็น 'ไม่เช่า'",
        onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false })),
        onCancel: null
      });
      return;
    }
    
    const finalClubsArray = editClubRent ? selectedClubs : [];

    onUpdateBooking(currentBooking.id, {
      customerName: editName,
      customerPhone: editPhone,
      guestCount: Number(editGuests),
      needsClubRent: editClubRent,
      rentedClubs: finalClubsArray, 
      needsInstructor: editInstructor
    });
    setIsEditMode(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-sm bg-[#f8faf8] rounded-3xl sm:rounded-[2.5rem] border-[3px] border-emerald-700/25 overflow-hidden shadow-2xl text-slate-800 text-left">
        
        {/* ส่วนหัวแสดงเลนซ้อมและเวลา */}
        <div className="bg-gradient-to-r from-[#064e3b] via-emerald-700 to-emerald-600 py-4 text-center border-b-2 border-emerald-900/10">
          <h3 className="text-lg font-extrabold text-white">เลนที่ {focusedCellInfo.laneNumber} รอบ {focusedCellInfo.slot}</h3>
        </div>
        
        {/* บล็อกเนื้อหา */}
        <div className="p-4 sm:p-6 space-y-4 max-h-none sm:max-h-[75vh] overflow-y-auto bg-[#f8faf8]">
          {focusedCellInfo.status !== 'maintenance' ? (
            <div className="space-y-3">
              
              {!isEditMode ? (
                // ==================================================
                // [โหมดโชว์ข้อมูลปกติ]
                // ==================================================
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อผู้ใช้งาน</label>
                    <div className="w-full bg-white p-3 rounded-xl font-bold text-sm shadow-sm">{editName || "ไม่ระบุชื่อ"}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                    <div className="w-full bg-white p-3 rounded-xl font-bold text-sm shadow-sm">{editPhone || "ไม่มีเบอร์โทร"}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">จำนวนผู้เข้าใช้งาน</label>
                    <div className="w-full bg-white p-3 rounded-xl font-bold text-sm shadow-sm">{editGuests} ท่าน</div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 pt-1">
                    {editClubRent ? (
                      <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl text-xs font-bold text-emerald-800 shadow-sm">
                        <p className="font-extrabold text-emerald-900 mb-1.5">รายการไม้กอล์ฟที่เช่าไว้ :</p>
                        <div className="flex flex-col gap-1 bg-white p-2 rounded-lg border border-slate-200">
                          {selectedClubs.length > 0 ? (
                            selectedClubs.map((club, i) => (
                              <div key={i} className="flex justify-between items-center bg-slate-50 p-1.5 rounded text-slate-700 font-bold">
                                <span>✓ {club.Club_Name}</span>
                                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-black">{club.qty} ชิ้น</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-400 italic font-normal">เช่าอุปกรณ์ แต่ยังไม่ได้เลือกไม้</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-100 border border-slate-300 p-2 rounded-xl text-xs font-bold text-slate-500">ไม่ได้เช่าชุดไม้กอล์ฟ</div>
                    )}
                    
                    {editInstructor ? (
                      <div className="bg-emerald-50 border border-emerald-300 p-2 rounded-xl text-xs font-bold text-emerald-800">ต้องการผู้สอนพื้นฐานการเล่นกอล์ฟ</div>
                    ) : (
                      <div className="bg-slate-100 border border-slate-300 p-2 rounded-xl text-xs font-bold text-slate-500">ไม่ต้องการผู้สอนพื้นฐานการเล่นกอล์ฟ</div>
                    )}
                  </div>
                </>
              ) : (
                // ==================================================
                // [โหมดแก้ไขข้อมูล]
                // ==================================================
                <>
                  <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-xs font-bold text-emerald-800 text-center mb-1">
                    ฟอร์มแก้ไขข้อมูลคิวซ้อมกอล์ฟ
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อผู้ใช้งาน</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-white p-3 rounded-xl font-bold text-sm border focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                    <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full bg-white p-3 rounded-xl font-bold text-sm border focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">จำนวนผู้เข้าใช้งาน (ท่าน)</label>
                    <input type="number" min="1" value={editGuests} onChange={(e) => setEditGuests(e.target.value)} className="w-full bg-white p-3 rounded-xl font-bold text-sm border focus:outline-none focus:border-emerald-500" />
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-slate-300">
                    <div>
                      <p className="text-xs font-bold text-slate-600 mb-1">เช่าชุดอุปกรณ์ไม้กอล์ฟหรือไม่?</p>
                      <div className="flex flex-col sm:flex-row gap-2 mb-2">
                        <button type="button" onClick={() => setEditClubRent(true)} className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${editClubRent ? 'bg-emerald-100 border-emerald-400 text-emerald-800 shadow-sm' : 'bg-white text-slate-400 border-slate-300'}`}>เช่าอุปกรณ์</button>
                        <button type="button" onClick={() => setEditClubRent(false)} className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${!editClubRent ? 'bg-rose-100 border-rose-300 text-rose-800 shadow-sm' : 'bg-white text-slate-400 border-slate-300'}`}>ไม่เช่า</button>
                      </div>

                      {editClubRent && (
                        <div className="animate-fadeIn bg-white p-3 rounded-xl border border-emerald-300 space-y-1.5">
                          <label className="block text-xs font-black text-emerald-800 mb-1">ปรับจำนวนชิ้นไม้กอล์ฟประจำคิวซ้อม :</label>
                          {loadingClubs ? (
                            <div className="text-xs text-slate-400 animate-pulse py-1">กำลังเรียกข้อมูลสต็อกไม้กอล์ฟ...</div>
                          ) : (
                            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                              {dbClubs.map((club) => {
                                const cartItem = selectedClubs.find(item => item.clubId === club.id);
                                const currentQty = cartItem ? cartItem.qty : 0;
                                return (
                                  <div key={club.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                                    <div className="flex flex-col">
                                      <span className="truncate max-w-[140px]">{club.name}</span>
                                      <span className="text-[10px] text-slate-400 font-bold">
                                        {currentBooking?.status === 'occupied' 
                                          ? `พร้อมให้ยืมหน้าตู้: ${club.available} ชิ้น` 
                                          : `คลังรวมทั้งหมดร้าน: ${club.available} ชิ้น`}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        type="button"
                                        onClick={() => handleUpdateClubQty(club, -1)} 
                                        className="w-6 h-6 bg-red-100 text-red-700 hover:bg-red-200 font-black rounded flex items-center justify-center border border-red-300"
                                      >
                                        -
                                      </button>
                                      <span className="w-5 text-center text-sm font-black text-slate-800">{currentQty}</span>
                                      <button 
                                        type="button"
                                        onClick={() => handleUpdateClubQty(club, 1)} 
                                        className="w-6 h-6 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-black rounded flex items-center justify-center border border-emerald-300"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-600 mb-1">ต้องการผู้สอนพื้นฐานการเล่นกอล์ฟหรือไม่?</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button type="button" onClick={() => setEditInstructor(true)} className={`flex-1 py-2 text-xs font-black rounded-xl border transition-all ${editInstructor ? 'bg-emerald-100 border-emerald-400 text-emerald-800 shadow-sm' : 'bg-white text-slate-400'}`}>ต้องการ</button>
                        <button type="button" onClick={() => setEditInstructor(false)} className={`flex-1 py-2 text-xs font-black rounded-xl border transition-all ${!editInstructor ? 'bg-rose-100 border-rose-300 text-rose-800 shadow-sm' : 'bg-white text-slate-400'}`}>ไม่ต้องการ</button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              
            </div>
          ) : (
            <div className="bg-red-50 text-red-800 p-4 rounded-xl text-center font-bold text-sm border border-red-200">
              เลนซ้อมช่วงเวลานี้ปิดปรับปรุงระบบ
            </div>
          )}

          {/* ส่วนปุ่มแอกชันควบคุมและปุ่มลบข้อมูลด้านล่างสุด */}
          <div className="space-y-2 pt-2">
            {!isEditMode ? (
              <>
                {focusedCellInfo.status === 'booked' && <button onClick={onCheckIn} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-base shadow transition-all">ยืนยันเริ่มเข้าใช้งาน</button>}
                {focusedCellInfo.status === 'occupied' && <button onClick={() => onClearToAvailable('checkout')} className="w-full border border-slate-300 bg-slate-700 py-3 rounded-xl font-black text-base text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95">สิ้นสุดเวลาใช้งาน</button>}
                {focusedCellInfo.status === 'maintenance' && <button onClick={() => onClearToAvailable('open')} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-black text-base shadow transition-all">เปิดหน้าเลนทำงานปกติ / คืนตารางว่าง</button>}
                
                {/* ปุ่มแก้ไขข้อมูลการจอง (เพิ่มเงื่อนไขไม่ให้แสดงปุ่มแก้ไขหากเช็คอินแล้ว) */}
                {focusedCellInfo.status !== 'maintenance' && currentBooking && (
                  <button 
                    onClick={() => setIsEditMode(true)}
                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 py-2.5 rounded-xl font-bold text-sm border border-emerald-200 transition-all shadow-sm"
                  >
                    แก้ไขข้อมูลการจอง
                  </button>
                )}

                {/* ปุ่มลบรายการจองถาวร */}
                {focusedCellInfo.status !== 'maintenance' && currentBooking && (
                  <button 
                    onClick={() => onDeleteBooking(currentBooking.id)}
                    className="w-full border border-rose-200 bg-rose-50 py-2.5 rounded-xl font-black text-sm text-rose-700 transition-all shadow-sm hover:bg-rose-100 active:scale-95"
                  >
                    ลบข้อมูลการจองถาวร
                  </button>
                )}

                <button onClick={onClose} className="w-full bg-white hover:bg-slate-100 py-2 rounded-xl font-bold text-xs border border-slate-300 text-slate-600">ปิดหน้าต่าง</button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={() => setIsEditMode(false)} className="flex-1 bg-white hover:bg-slate-100 py-2.5 rounded-xl font-bold text-xs border border-slate-300 text-slate-600 transition-all">ยกเลิก</button>
                <button type="button" onClick={handleSubmitEdit} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-black text-xs shadow transition-all">
                  <span className="flex items-center justify-center gap-1.5">
                    <SaveIcon className="h-3.5 w-3.5" />
                    <span>บันทึกการแก้ไข</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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

export default BookingDetailModal;
