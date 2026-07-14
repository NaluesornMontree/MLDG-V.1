import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { theme } from '../styles/theme';
import Popup from './Popup';

function PlusIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShopClosureManagement() {
  const [closedDates, setClosedDates] = useState([]);
  const [newClosedDate, setNewClosedDate] = useState({ date: '', reason: '' });
  const [loading, setLoading] = useState(true);
  const [alertPopup, setAlertPopup] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  const s = theme.admin;
  const EMPTY_REASON_LABEL = 'ไม่ระบุหมายเหตุ';

  const formatThaiDate = (dateInput) => {
    if (!dateInput) return '';
    const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const fetchClosedDates = async () => {
    setLoading(true);
    try {
      const closureSnap = await getDocs(collection(db, 'shop_closures'));
      const closureList = closureSnap.docs.map((closureDoc) => ({
        id: closureDoc.id,
        ...closureDoc.data()
      }));

      closureList.sort((a, b) => {
        const aTime = a.date?.seconds || 0;
        const bTime = b.date?.seconds || 0;
        return aTime - bTime;
      });

      setClosedDates(closureList);
    } catch (error) {
      console.error('Error fetching closures:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosedDates();
  }, []);

  const handleAddClosureDate = async () => {
    if (!newClosedDate.date) {
      setAlertPopup({
        isOpen: true,
        type: 'danger',
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาเลือกวันที่ต้องการปิดร้านก่อนบันทึก',
        onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false }))
      });
      return;
    }

    try {
      const targetDate = new Date(newClosedDate.date);
      targetDate.setHours(0, 0, 0, 0);

      await addDoc(collection(db, 'shop_closures'), {
        date: Timestamp.fromDate(targetDate),
        reason: newClosedDate.reason.trim(),
        status: 'active',
        createdAt: Timestamp.now(),
        reopenedAt: null
      });

      setNewClosedDate({ date: '', reason: '' });
      setAlertPopup({
        isOpen: true,
        type: 'info',
        title: 'บันทึกสำเร็จ',
        message: 'บันทึกวันปิดร้านล่วงหน้าเรียบร้อยแล้ว',
        onConfirm: () => {
          setAlertPopup((prev) => ({ ...prev, isOpen: false }));
          fetchClosedDates();
        }
      });
    } catch (error) {
      setAlertPopup({
        isOpen: true,
        type: 'danger',
        title: 'เกิดข้อผิดพลาด',
        message: `ไม่สามารถบันทึกวันปิดร้านได้: ${error.message}`,
        onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false }))
      });
    }
  };

  const handleReopenClosureDate = (id, firestoreTimestamp) => {
    const formattedDate = formatThaiDate(firestoreTimestamp);

    setAlertPopup({
      isOpen: true,
      type: 'danger',
      title: 'เปิดให้บริการปกติ?',
      message: `ต้องการเปลี่ยนรายการวันที่ ${formattedDate} ให้กลับมาเปิดบริการตามปกติหรือไม่`,
      onCancel: () => setAlertPopup((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'shop_closures', id), {
            status: 'reopened',
            reopenedAt: Timestamp.now()
          });

          setAlertPopup({
            isOpen: true,
            type: 'info',
            title: 'ดำเนินการสำเร็จ',
            message: 'เปลี่ยนสถานะเป็นเปิดให้บริการปกติแล้ว และเก็บประวัติรายการนี้ไว้เรียบร้อย',
            onConfirm: () => {
              setAlertPopup((prev) => ({ ...prev, isOpen: false }));
              fetchClosedDates();
            }
          });
        } catch (error) {
          setAlertPopup({
            isOpen: true,
            type: 'danger',
            title: 'เกิดข้อผิดพลาด',
            message: error.message,
            onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false }))
          });
        }
      }
    });
  };

  if (loading) {
    return <div className="py-10 text-center font-bold text-slate-500">กำลังโหลดข้อมูลวันปิดร้าน...</div>;
  }

  return (
    <div className="relative w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left font-sans shadow-sm sm:p-8">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">
          ตั้งวันปิดร้านล่วงหน้า
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          กำหนดวันหยุดของสนามเพื่อป้องกันไม่ให้ระบบเปิดรับการจองในวันที่ปิดบริการ
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">เลือกวันที่</label>
          <input
            type="date"
            value={newClosedDate.date}
            onChange={(e) => setNewClosedDate({ ...newClosedDate, date: e.target.value })}
            className={s.input + ' !py-2.5 text-base'}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">หมายเหตุ / เหตุผลการปิดร้าน</label>
          <input
            type="text"
            placeholder="เช่น ปรับปรุงพรมช่องไดร์ฟ..."
            value={newClosedDate.reason}
            onChange={(e) => setNewClosedDate({ ...newClosedDate, reason: e.target.value })}
            className={s.input + ' !py-2.5 text-base'}
          />
        </div>
        <div className="flex items-end">
          <button onClick={handleAddClosureDate} className={s.btnEmerald + ' w-full !py-3 text-base font-black'}>
            <span className="flex items-center justify-center gap-2">
              <PlusIcon className="h-4 w-4" />
              <span>บันทึกวันปิดร้าน</span>
            </span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-400">
              <th className="p-4">วันที่ปิดบริการ</th>
              <th className="p-4">หมายเหตุ</th>
              <th className="p-4">สถานะ</th>
              <th className="p-4 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="text-sm font-medium text-slate-600">
            {closedDates.map((item) => {
              const isActive = (item.status || 'active') === 'active';
              const hasReason = Boolean((item.reason || '').trim());

              return (
                <tr key={item.id} className="border-b border-slate-100 transition-all hover:bg-slate-50/50">
                  <td className="p-4 font-bold text-slate-800">{formatThaiDate(item.date)}</td>
                  <td className="p-4 text-slate-500">
                    {hasReason ? (
                      item.reason
                    ) : (
                      <span className="text-slate-400 line-through">{EMPTY_REASON_LABEL}</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                        isActive
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isActive ? 'ปิดบริการอยู่' : 'เปิดบริการแล้ว'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {isActive ? (
                      <button
                        onClick={() => handleReopenClosureDate(item.id, item.date)}
                        className="rounded-lg bg-red-50 px-3 py-1 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
                      >
                        เปิดให้บริการปกติ
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">
                        เปิดกลับเมื่อ {formatThaiDate(item.reopenedAt || item.date)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {closedDates.length === 0 && (
              <tr>
                <td colSpan="4" className="py-8 text-center italic text-slate-400">
                  ยังไม่มีการตั้งวันปิดร้านล่วงหน้า
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

export default ShopClosureManagement;
