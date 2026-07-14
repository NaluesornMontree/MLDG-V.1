import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
// เพิ่ม query และ where เพื่อคัดกรองประวัติการเช่าไม้ตามวันที่เลือกดู
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from "firebase/firestore";
import { theme } from '../styles/theme';
import Popup from './Popup';
import { getClubType, normalizeClubTypeDisplay, sortGolfClubsLikeInventory } from '../utils/golfClubUtils';

function ClubManagement() {
  const clubTypeOptions = ['Driver', 'Iron', 'Putter', 'Wedge', 'Wood', 'อื่น ๆ'];
  // เพิ่ม State เลือกวันที่สำหรับดูสถานะคลัง (เริ่มต้นที่วันที่ปัจจุบัน)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  });

  const [clubs, setClubs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newClub, setNewClub] = useState({ Club_Name: '', Club_Type: '', Quantity_Total: 0, Repair_Club_Total: 0 });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ Club_Name: '', Club_Type: '', Quantity_Total: 0, Repair_Club_Total: 0 });

  const [modal, setModal] = useState({ isOpen: false, id: null, status: null, name: '' });

  const s = theme.admin;
  const m = theme.modal;

  // ปรับปรุงฟังก์ชันการโหลดและคำนวณจำนวนไม้กอล์ฟว่างให้ผันแปรตามวันที่เลือก
  const fetchClubsAndCalculateAvail = async () => {
    try {
      // 1. ดึงข้อมูลไม้กอล์ฟทั้งหมดจากฐานข้อมูลหลัก
      const clubSnap = await getDocs(collection(db, "golf_clubs"));
      const baseClubs = clubSnap.docs.map(d => ({ ...d.data(), id: d.id }));

      // 2. ดึงข้อมูลใบจองทั้งหมดที่มีการระบุเช่าไม้กอล์ฟในวันที่เลือกดู
      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef, 
        where("bookingDate", "==", selectedDate),
        where("status", "in", ["pending", "confirmed", "occupied"]) // คิดเฉพาะใบจองที่มีผลใช้งานอยู่
      );
      const bookingSnap = await getDocs(q);

      // 3. สร้าง Map สรุปจำนวนไม้กอล์ฟที่ถูกดึงไปใช้ในวันนั้น
      const rentedQtyMap = {};
      bookingSnap.forEach(doc => {
        const data = doc.data();
        if (data && data.rentedClubs && Array.isArray(data.rentedClubs)) {
          data.rentedClubs.forEach(item => {
            const qty = Number(item.qty || 0);
            rentedQtyMap[item.clubId] = (rentedQtyMap[item.clubId] || 0) + qty;
          });
        }
      });

      // 4. ผสมข้อมูล: คำนวณค่า Quantity_Avail ใหม่ตามสูตร (จำนวนทั้งหมด - จำนวนที่ถูกเช่าในวันนั้น)
      const finalClubsData = baseClubs.map(club => {
        const total = Number(club.Quantity_Total || 0);
        const rented = rentedQtyMap[club.id] || 0;
        const repairTotal = Number(club.Repair_Club_Total || 0);
        
        return {
          ...club,
          // จำนวนที่พร้อมใช้งานจะถูกคำนวณใหม่แบบไดนามิกตามวันที่เลือกดูเสมอ!
          Quantity_Avail: Math.max(0, total - rented - repairTotal) 
        };
      });

      setClubs(finalClubsData);
    } catch (err) {
      console.error("Error fetching or processing clubs inventory:", err);
    }
  };

  // ให้ระบบโหลดข้อมูลใหม่ทุกครั้งที่แอดมินทำการสลับปฏิทินดูวันที่
  useEffect(() => { 
    fetchClubsAndCalculateAvail(); 
  }, [selectedDate]);

  const handleAddClub = async () => {
    if (!newClub.Club_Name) return;
    try {
      const clubName = newClub.Club_Name.trim();
      const clubType = newClub.Club_Type.trim();
      const total = Number(newClub.Quantity_Total);
      const repairTotal = Number(newClub.Repair_Club_Total || 0);

      const existingClub = clubs.find((club) =>
        normalizeClubField(club.Club_Name) === normalizeClubField(clubName) &&
        normalizeClubField(getClubTypeLabel(club)) === normalizeClubField(clubType)
      );

      if (existingClub) {
        const updatedTotal = Number(existingClub.Quantity_Total || 0) + total;
        const updatedRepairTotal = Number(existingClub.Repair_Club_Total || 0) + repairTotal;

        await updateDoc(doc(db, "golf_clubs", existingClub.id), {
          Club_Name: existingClub.Club_Name || clubName,
          Club_Type: getClubTypeLabel(existingClub) || clubType,
          Quantity_Total: updatedTotal,
          Repair_Club_Total: updatedRepairTotal,
          Quantity_Avail: Math.max(0, updatedTotal - updatedRepairTotal)
        });
      } else {
        await addDoc(collection(db, "golf_clubs"), {
          Club_Name: clubName,
          Club_Type: clubType,
          Quantity_Total: total,
          Repair_Club_Total: repairTotal,
          Quantity_Avail: Math.max(0, total - repairTotal), 
          Is_Active: true,
          createdAt: new Date()
        });
      }

      setNewClub({ Club_Name: '', Club_Type: '', Quantity_Total: 0, Repair_Club_Total: 0 });
      setIsAddModalOpen(false);
      fetchClubsAndCalculateAvail();
    } catch (err) {
      console.error("Error adding club:", err);
    }
  };

  const handleUpdateInfo = async () => {
    try {
      const total = Number(editData.Quantity_Total);
      const repairTotal = Number(editData.Repair_Club_Total || 0);
      await updateDoc(doc(db, "golf_clubs", editingId), { 
        Club_Name: editData.Club_Name, 
        Club_Type: editData.Club_Type,
        Quantity_Total: total,
        Repair_Club_Total: repairTotal,
        Quantity_Avail: Math.max(0, total - repairTotal)
      });
      setIsEditModalOpen(false);
      fetchClubsAndCalculateAvail();
    } catch (err) {
      console.error("Error updating club:", err);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    await updateDoc(doc(db, "golf_clubs", id), { Is_Active: !currentStatus });
    setModal({ ...modal, isOpen: false });
    fetchClubsAndCalculateAvail();
  };

  const getClubTypeLabel = (club) => getClubType(club);

  const normalizeClubField = (value) => {
    const normalized = normalizeClubTypeDisplay(value || '').trim().toLowerCase();
    return normalized === 'อื่นๆ' ? 'อื่น ๆ' : normalized;
  };

  const getClubTypeSelectOptions = (currentValue = '') => {
    const normalized = normalizeClubTypeDisplay(currentValue).trim();
    return normalized && !clubTypeOptions.includes(normalized)
      ? [...clubTypeOptions.slice(0, -1), normalized, 'อื่น ๆ']
      : clubTypeOptions;
  };

  const clubTypeFilterOptions = [
    ...new Set([
      ...clubTypeOptions,
      ...clubs.map(club => getClubTypeLabel(club)).filter(Boolean).map(normalizeClubTypeDisplay)
    ])
  ];

  const getClubTypeIcon = (club) => {
    const lowerType = getClubTypeLabel(club).toLowerCase();

    if (lowerType.includes('driver') || lowerType.includes('wood')) {
      return 'M5 18l8-8m0 0 5-5 2 2-5 5m-2-2 4 4m-4-4L9 6l2-2 4 4';
    }

    if (lowerType.includes('wedge')) {
      return 'M6 18l7-7m0 0 4-4 3 3-4 4m-3-3 5 5m-5-5L10 5l2-2 5 5';
    }

    if (lowerType.includes('putter')) {
      return 'M6 6h8m-4 0v12m0 0h5';
    }

    return 'M5 18l8-8m0 0 6-6m-6 6 4 4';
  };

  const filteredClubs = clubs.filter(c => {
    const clubType = getClubTypeLabel(c);
    const matchesSearch = `${c.Club_Name || ''} ${clubType}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || normalizeClubField(clubType) === normalizeClubField(typeFilter);
    return matchesSearch && matchesType;
  });

  const sortedClubs = sortGolfClubsLikeInventory(filteredClubs);

  return (
    <div className={s.card}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h2 className={s.title + " !mb-0"}>จัดการคลังไม้กอล์ฟ</h2>
          <p className="text-xs font-black text-indigo-600 mt-1">
            สต็อกที่แสดงถูกคำนวณตามรายการจองของวันที่: {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/*  เพิ่มกล่องปฏิทินด้านบนแถบควบคุมเพื่อให้ระบุวันที่ต้องการดูคลังได้ */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-indigo-50 border border-indigo-100 p-2 rounded-xl w-full sm:w-auto">
            <label className="text-xs font-black text-indigo-700 uppercase tracking-wider pl-1">วันที่ตรวจสอบคลัง:</label>
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-indigo-200 p-1 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
            />
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)} 
            className={s.btnEmerald + " !py-2.5 !px-5 text-sm !rounded-xl md:ml-auto w-full sm:w-auto"}
          >
             เพิ่มไม้กอล์ฟใหม่
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="text-left">
          <label className="mb-1 ml-1 block text-xs font-black text-slate-500">
            ค้นหาไม้กอล์ฟ
          </label>
          <input
            placeholder="ค้นหาชื่อไม้กอล์ฟ..."
            className="h-14 w-full rounded-2xl border-2 border-slate-100 bg-white px-5 text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="text-left">
          <label className="mb-1 ml-1 block text-xs font-black text-slate-500">
            แยกตามประเภทไม้
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-14 w-full rounded-2xl border-2 border-slate-100 bg-white px-5 text-sm font-bold text-slate-700 outline-none transition-all focus:border-emerald-500"
          >
            <option value="all">ทุกประเภทไม้</option>
            {clubTypeFilterOptions.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {sortedClubs.map(club => (
          <div key={club.id} className={club.Is_Active === false ? s.itemCardDisabled : s.itemCard}>
            <div className="flex items-start sm:items-center gap-4 sm:gap-6 flex-1 text-left min-w-0">
              <div className={`w-14 h-14 rounded-3xl flex items-center justify-center ${club.Is_Active === false ? 'bg-slate-200 text-slate-400' : 'bg-emerald-50 text-emerald-700'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-7 h-7">
                  <path d={getClubTypeIcon(club)} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`font-black text-base sm:text-lg break-words ${club.Is_Active === false ? 'text-slate-400' : 'text-slate-800'}`}>{club.Club_Name}</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {getClubTypeLabel(club) && (
                    <span className="text-[13px] font-black text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg w-fit">
                      ประเภท: {getClubTypeLabel(club)}
                    </span>
                  )}
                  <span className="text-[15px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg w-fit">
                    ทั้งหมด: {club.Quantity_Total}
                  </span>
                  <span className="text-[15px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg w-fit">
                    ชำรุด: {club.Repair_Club_Total || 0}
                  </span>
                  <span className={`text-[15px] font-black px-2 py-0.5 rounded-lg w-fit ${club.Quantity_Avail === 0 ? 'text-rose-600 bg-rose-50' : 'text-blue-600 bg-blue-50'}`}>
                    ว่างประจำวันนี้: {club.Quantity_Avail}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {club.Is_Active !== false && (
                <button 
                  onClick={() => {
                    setEditingId(club.id);
                    setEditData({
                      Club_Name: club.Club_Name,
                      Club_Type: getClubTypeLabel(club),
                      Quantity_Total: club.Quantity_Total,
                      Repair_Club_Total: club.Repair_Club_Total || 0
                    });
                    setIsEditModalOpen(true);
                  }}
                  className={s.btnAmber + " !px-6 w-full sm:w-auto"}
                >
                  แก้ไข
                </button>
              )}
              <button 
                onClick={() => setModal({ isOpen: true, id: club.id, status: club.Is_Active, name: club.Club_Name })}
                className={`${club.Is_Active === false ? s.btnRestore : s.btnCancelAction} w-full sm:w-auto`}
              >
                {club.Is_Active === false ? "เปิดใช้งาน" : "ปิดใช้งาน"}
              </button>
            </div>
          </div>
        ))}
        {filteredClubs.length === 0 && <p className="text-slate-400 font-bold italic py-4">ไม่พบข้อมูลรายการไม้กอล์ฟที่ค้นหาหรือประเภทที่เลือก</p>}
      </div>

      {/* Popup สำหรับเพิ่มไม้ */}
      {isAddModalOpen && (
        <div className={m.overlay}>
          <div className={m.card + " !max-w-sm"}>
            <h3 className={m.title}> เพิ่มไม้กอล์ฟ</h3>
            <div className="space-y-5 mb-8 text-left">
              <div>
                <label className={s.inputLabel}>ชื่อไม้กอล์ฟ (Club Name)</label>
                <input 
                  value={newClub.Club_Name} 
                  onChange={(e) => setNewClub({...newClub, Club_Name: e.target.value})} 
                  className={s.input} 
                  placeholder="ระบุชื่อไม้..."
                />
              </div>
              <div>
                <label className={s.inputLabel}>ประเภทไม้กอล์ฟ (Club Type)</label>
                <select
                  value={newClub.Club_Type}
                  onChange={(e) => setNewClub({...newClub, Club_Type: e.target.value})}
                  className={s.input}
                >
                  <option value="">เลือกประเภทไม้</option>
                  {clubTypeOptions.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={s.inputLabel}>จำนวนทั้งหมด (Quantity Total)</label>
                <input 
                  type="number" 
                  value={newClub.Quantity_Total} 
                  onChange={(e) => setNewClub({...newClub, Quantity_Total: e.target.value})} 
                  className={s.input + " text-center"} 
                />
              </div>
              <div>
                <label className={s.inputLabel}>จำนวนทั้งหมดที่ชำรุด (Repair Club Total)</label>
                <input
                  type="number"
                  min="0"
                  value={newClub.Repair_Club_Total}
                  onChange={(e) => setNewClub({...newClub, Repair_Club_Total: e.target.value})}
                  className={s.input + " text-center"}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleAddClub} className={m.btnConfirm}>บันทึกเข้าคลัง</button>
              <button onClick={() => setIsAddModalOpen(false)} className={m.btnCancel}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup สำหรับแก้ไขไม้ */}
      {isEditModalOpen && (
        <div className={m.overlay}>
          <div className={m.card + " !max-w-sm"}>
            <h3 className={m.title}>แก้ไขข้อมูล</h3>
            <div className="space-y-5 mb-8 text-left">
              <div>
                <label className={s.inputLabel}>ชื่อไม้กอล์ฟ</label>
                <input value={editData.Club_Name} onChange={(e) => setEditData({...editData, Club_Name: e.target.value})} className={s.input} />
              </div>
              <div>
                <label className={s.inputLabel}>ประเภทไม้กอล์ฟ</label>
                <select value={editData.Club_Type} onChange={(e) => setEditData({...editData, Club_Type: e.target.value})} className={s.input}>
                  <option value="">เลือกประเภทไม้</option>
                  {getClubTypeSelectOptions(editData.Club_Type).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={s.inputLabel}>จำนวนสต็อกทั้งหมด</label>
                <input type="number" value={editData.Quantity_Total} onChange={(e) => setEditData({...editData, Quantity_Total: e.target.value})} className={s.input + " text-center"} />
              </div>
              <div>
                <label className={s.inputLabel}>จำนวนทั้งหมดที่ชำรุด</label>
                <input
                  type="number"
                  min="0"
                  value={editData.Repair_Club_Total}
                  onChange={(e) => setEditData({...editData, Repair_Club_Total: e.target.value})}
                  className={s.input + " text-center"}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleUpdateInfo} className={m.btnConfirm}>บันทึกการแก้ไข</button>
              <button onClick={() => { setIsEditModalOpen(false); setEditingId(null); }} className={m.btnCancel}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <Popup 
        isOpen={modal.isOpen} 
        type={modal.status === false ? 'info' : 'danger'} 
        title={modal.status === false ? 'เปิดใช้งาน?' : 'ปิดใช้งานข้อมูล?'} 
        message={`ยืนยันการเปลี่ยนสถานะของไม้ "${modal.name}"`} 
        onConfirm={() => toggleStatus(modal.id, modal.status)} 
        onCancel={() => setModal({ ...modal, isOpen: false })} 
      />
    </div>
  );
}

export default ClubManagement;
