import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, addDoc, setDoc, getDoc } from "firebase/firestore";
import { theme } from '../styles/theme';
import Popup from './Popup';
import IntegerStepperInput from './IntegerStepperInput';
import { normalizeWholeNumberInput, toWholeNumber } from '../utils/numberUtils';

function SystemSettings() {
  const [services, setServices] = useState([]);
  const [serviceSortBy, setServiceSortBy] = useState('newest');
  const [pointSettings, setPointSettings] = useState(null);
  const [bookingPolicyHours, setBookingPolicyHours] = useState('2');

  const [isEditServiceOpen, setIsEditServiceOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editServiceData, setEditServiceData] = useState({
    Service_Name: '', Price_Rate: '', Service_Unit: '', Start_Date: '', End_Date: ''
  });

  const [newService, setNewService] = useState({
    Service_Name: '', Price_Rate: '', Service_Unit: '', Start_Date: '', End_Date: ''
  });

  const [tempEarn, setTempEarn] = useState({ baht: '', points: '' });
  const [tempRedeem, setTempRedeem] = useState({ points: '', baht: '' });

  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

  const s = theme.admin;
  const m = theme.modal;

  const formatTimestampForInput = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const tzoffset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 10);
  };

  const formatDateDisplay = (timestamp) => {
    if (!timestamp) return 'ไม่ระบุ';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const normalizeWholeHours = (value) => String(value || '').replace(/\D/g, '');

  const fetchData = async () => {
    const serviceSnap = await getDocs(collection(db, "service_settings"));
    setServices(serviceSnap.docs.map((d) => ({ ...d.data(), id: d.id })));

    const pointDocRef = doc(db, "Point_Settings", "config_01");
    const pointSnap = await getDoc(pointDocRef);

    if (pointSnap.exists()) {
      const data = pointSnap.data();
      setPointSettings({ ...data, id: pointSnap.id });
      setTempEarn({ baht: data.Earning_Rate_Amount || '', points: data.Earning_Rate_Points || '' });
      setTempRedeem({ points: data.RDT_Rate_Points || '', baht: data.RDT_Rate_Discount || '' });
    }

    const bookingPolicyRef = doc(db, "system_settings", "booking_policy");
    const bookingPolicySnap = await getDoc(bookingPolicyRef);
    if (bookingPolicySnap.exists()) {
      const hours = Number(bookingPolicySnap.data().Modify_Limit_Hours);
      setBookingPolicyHours(Number.isFinite(hours) ? String(Math.max(0, Math.trunc(hours))) : '2');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddService = async () => {
    if (!newService.Service_Name || !newService.Price_Rate || !newService.Service_Unit) {
      setModal({
        isOpen: true,
        type: 'danger',
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกชื่อรายการ ราคา และหน่วยค่าบริการให้ครบก่อนเพิ่มรายการ',
        onConfirm: () => setModal((prev) => ({ ...prev, isOpen: false }))
      });
      return;
    }

    await addDoc(collection(db, "service_settings"), {
      Service_Name: newService.Service_Name,
      Price_Rate: toWholeNumber(newService.Price_Rate),
      Service_Unit: newService.Service_Unit,
      Start_Date: newService.Start_Date ? new Date(newService.Start_Date) : null,
      End_Date: newService.End_Date ? new Date(newService.End_Date) : null,
      Created_At: new Date(),
      Is_Active: true
    });

    setNewService({ Service_Name: '', Price_Rate: '', Service_Unit: '', Start_Date: '', End_Date: '' });
    await fetchData();
    setModal({
      isOpen: true,
      type: 'info',
      title: 'เพิ่มข้อมูลเสร็จสิ้น',
      message: `เพิ่มรายการค่าบริการ "${newService.Service_Name}" เข้าระบบเรียบร้อยแล้ว`,
      onConfirm: () => setModal((prev) => ({ ...prev, isOpen: false }))
    });
  };

  const handleUpdateService = async () => {
    if (!editServiceData.Service_Name || !editServiceData.Price_Rate || !editServiceData.Service_Unit) {
      setModal({
        isOpen: true,
        type: 'danger',
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกชื่อรายการ ราคา และหน่วยค่าบริการให้ครบก่อนบันทึกการแก้ไข',
        onConfirm: () => setModal((prev) => ({ ...prev, isOpen: false }))
      });
      return;
    }

    await updateDoc(doc(db, "service_settings", editingServiceId), {
      Service_Name: editServiceData.Service_Name,
      Price_Rate: toWholeNumber(editServiceData.Price_Rate),
      Service_Unit: editServiceData.Service_Unit,
      Start_Date: editServiceData.Start_Date ? new Date(editServiceData.Start_Date) : null,
      End_Date: editServiceData.End_Date ? new Date(editServiceData.End_Date) : null
    });

    setIsEditServiceOpen(false);
    setEditingServiceId(null);
    await fetchData();
    setModal({
      isOpen: true,
      type: 'info',
      title: 'แก้ไขข้อมูลเสร็จสิ้น',
      message: `แก้ไขข้อมูลค่าบริการ "${editServiceData.Service_Name}" เรียบร้อยแล้ว`,
      onConfirm: () => setModal((prev) => ({ ...prev, isOpen: false }))
    });
  };

  const getServiceSortTime = (service) => {
    const dateValue = service.Created_At || service.Start_Date || service.End_Date;
    if (!dateValue) return 0;
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    return date.getTime();
  };

  const sortedServices = [...services].sort((a, b) => {
    if (serviceSortBy === 'name') {
      return (a.Service_Name || '').localeCompare(b.Service_Name || '', ['th', 'en'], {
        sensitivity: 'base',
        numeric: true
      });
    }

    if (serviceSortBy === 'priceHigh') {
      return toWholeNumber(b.Price_Rate || 0) - toWholeNumber(a.Price_Rate || 0);
    }

    return getServiceSortTime(b) - getServiceSortTime(a);
  });

  const savePointRule = async (pointType) => {
    const pointDocRef = doc(db, "Point_Settings", "config_01");
    let updateData = {};

    if (pointType === 'earn') {
      updateData = {
        Earning_Rate_Amount: toWholeNumber(tempEarn.baht),
        Earning_Rate_Points: toWholeNumber(tempEarn.points),
        Earning_Is_Active: true
      };
    } else {
      updateData = {
        RDT_Rate_Points: toWholeNumber(tempRedeem.points),
        RDT_Rate_Discount: toWholeNumber(tempRedeem.baht),
        Redemption_Is_Active: true
      };
    }

    await setDoc(pointDocRef, updateData, { merge: true });
    fetchData();
    setModal({
      isOpen: true,
      type: 'info',
      title: 'บันทึกสำเร็จ',
      message: 'อัปเดตข้อมูลเกณฑ์แต้มเรียบร้อยแล้ว',
      onConfirm: () => setModal((prev) => ({ ...prev, isOpen: false }))
    });
  };

  const saveBookingPolicy = async () => {
    const normalizedHours = normalizeWholeHours(bookingPolicyHours);
    const hours = Number(normalizedHours);
    if (!normalizedHours || !Number.isInteger(hours) || hours < 0) {
      setModal({
        isOpen: true,
        type: 'danger',
        title: 'ข้อมูลไม่ถูกต้อง',
        message: 'กรุณากรอกจำนวนชั่วโมงเป็นเลขจำนวนเต็ม 0 ขึ้นไป',
        onConfirm: () => setModal((prev) => ({ ...prev, isOpen: false }))
      });
      return;
    }

    await setDoc(doc(db, "system_settings", "booking_policy"), {
      Modify_Limit_Hours: hours,
      Updated_At: new Date()
    }, { merge: true });
    setBookingPolicyHours(String(hours));

    setModal({
      isOpen: true,
      type: 'info',
      title: 'บันทึกสำเร็จ',
      message: 'อัปเดตเวลาที่อนุญาตให้สมาชิกแก้ไขหรือยกเลิกการจองเรียบร้อยแล้ว',
      onConfirm: () => setModal((prev) => ({ ...prev, isOpen: false }))
    });
  };

  const askToggleStatus = (id, currentStatus, label, type) => {
    setModal({
      isOpen: true,
      type: 'danger',
      title: currentStatus ? 'ยืนยันการปิดใช้งาน?' : 'เปิดใช้งานอีกครั้ง?',
      message: `คุณต้องการเปลี่ยนสถานะ "${label}" ใช่หรือไม่?`,
      onConfirm: async () => {
        if (type === 'service') {
          await updateDoc(doc(db, "service_settings", id), { Is_Active: !currentStatus });
        } else if (type === 'earn') {
          await updateDoc(doc(db, "Point_Settings", id), { Earning_Is_Active: !currentStatus });
        } else if (type === 'redeem') {
          await updateDoc(doc(db, "Point_Settings", id), { Redemption_Is_Active: !currentStatus });
        }
        setModal((prev) => ({ ...prev, isOpen: false }));
        fetchData();
      }
    });
  };

  const openEditService = (item) => {
    setEditingServiceId(item.id);
    setEditServiceData({
      Service_Name: item.Service_Name,
      Price_Rate: item.Price_Rate,
      Service_Unit: item.Service_Unit || '',
      Start_Date: formatTimestampForInput(item.Start_Date),
      End_Date: formatTimestampForInput(item.End_Date)
    });
    setIsEditServiceOpen(true);
  };

  return (
    <div className={s.card}>
      <div className="mb-6 sm:mb-10">
        <div>
          <h2 className={s.title + ' !mb-1'}>ตั้งค่าระบบบริหารจัดการ</h2>
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-800">ตั้งค่าเวลาแก้ไขหรือยกเลิกการจองของสมาชิก</h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                สมาชิกจะแก้ไขหรือยกเลิกการจองได้เฉพาะก่อนถึงเวลาเริ่มจองตามจำนวนชั่วโมงที่กำหนด
              </p>
            </div>
            <div className="w-full lg:w-[360px] rounded-2xl border border-slate-100 bg-white p-4">
              <label className={s.inputLabel}>จำนวนชั่วโมงก่อนถึงเวลาเริ่มจอง</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <IntegerStepperInput
                  className="flex-1"
                  value={bookingPolicyHours}
                  onChange={setBookingPolicyHours}
                  min={0}
                  ariaLabel="จำนวนชั่วโมงก่อนถึงเวลาเริ่มจอง"
                  placeholder="เช่น 2"
                />
                <button
                  type="button"
                  onClick={saveBookingPolicy}
                  className={s.btnPrimary + ' !px-5 !py-2.5 text-sm whitespace-nowrap'}
                >
                  บันทึก
                </button>
              </div>
              <p className="mt-2 text-[11px] font-bold text-slate-400">
                ค่าปัจจุบัน: {bookingPolicyHours || 0} ชั่วโมง
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-800">จัดการรายการค่าบริการ</h3>
              <p className="text-xs font-bold text-slate-400 mt-1">เพิ่ม แก้ไข และเปิดปิดการใช้งานรายการบริการของร้าน</p>
            </div>
            <div className="w-full lg:w-[260px]">
              <label className="text-xs font-black text-slate-500 block mb-2 ml-1">เรียงลำดับรายการ</label>
              <select
                value={serviceSortBy}
                onChange={(e) => setServiceSortBy(e.target.value)}
                className={s.input + ' !py-2.5 text-sm bg-white'}
              >
                <option value="newest">ข้อมูลใหม่ไปเก่า</option>
                <option value="name">ลำดับตัวอักษร</option>
                <option value="priceHigh">ราคาจากมากไปน้อย</option>
              </select>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-4 sm:p-6 mb-6">
            <div className="text-sm font-black text-slate-700 mb-4">เพิ่มรายการบริการใหม่</div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="text-left">
                <label className={s.inputLabel}>ชื่อบริการ</label>
                <input
                  placeholder="เช่น ค่าไม้กอล์ฟ"
                  value={newService.Service_Name}
                  onChange={(e) => setNewService({ ...newService, Service_Name: e.target.value })}
                  className={s.input + ' !py-2.5 text-sm'}
                />
              </div>
              <div className="text-left">
                <label className={s.inputLabel}>ราคา (บาท)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={newService.Price_Rate}
                  onChange={(e) => setNewService({ ...newService, Price_Rate: normalizeWholeNumberInput(e.target.value) })}
                  className={s.input + ' !py-2.5 text-sm'}
                />
              </div>
              <div className="text-left">
                <label className={s.inputLabel}>หน่วยค่าบริการ</label>
                <input
                  placeholder="เช่น ต่อลูก, ต่อชั่วโมง"
                  value={newService.Service_Unit}
                  onChange={(e) => setNewService({ ...newService, Service_Unit: e.target.value })}
                  className={s.input + ' !py-2.5 text-sm'}
                />
              </div>
              <div className="text-left">
                <label className={s.inputLabel}>วันที่เริ่มใช้งาน</label>
                <input
                  type="date"
                  value={newService.Start_Date}
                  onChange={(e) => setNewService({ ...newService, Start_Date: e.target.value })}
                  className={s.input + ' !py-2.5 !text-sm text-slate-600'}
                />
              </div>
              <div className="text-left">
                <label className={s.inputLabel}>วันที่สิ้นสุด</label>
                <input
                  type="date"
                  value={newService.End_Date}
                  onChange={(e) => setNewService({ ...newService, End_Date: e.target.value })}
                  className={s.input + ' !py-2.5 !text-sm text-slate-600'}
                />
              </div>
              <div className="flex items-end">
                <button onClick={handleAddService} className={s.btnEmerald + ' w-full !py-3 text-sm'}>
                  เพิ่มรายการ
                </button>
              </div>
            </div>
          </div>

          <div className="hidden lg:grid grid-cols-4 px-8 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
            <div className="col-span-2 ml-16 text-[15px]">ข้อมูลค่าบริการ</div>
            <div className="text-center text-[15px]">ช่วงวันที่ใช้งาน</div>
            <div className="text-right mr-8 text-[15px]">การจัดการ</div>
          </div>

          <div className="space-y-3">
            {sortedServices.length === 0 ? (
              <p className="text-slate-400 font-bold italic py-6 text-center">ไม่มีข้อมูลรายการค่าบริการ</p>
            ) : (
              sortedServices.map((item) => {
                const isActive = item.Is_Active !== false;
                return (
                  <div key={item.id} className={!isActive ? s.itemCardDisabled : s.itemCard}>
                    <div className="grid grid-cols-1 lg:grid-cols-4 w-full items-start lg:items-center gap-4">
                      <div className="lg:col-span-2 flex items-center gap-3 sm:gap-5 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[10px] font-black uppercase tracking-tight ${
                            !isActive
                              ? 'bg-slate-200 text-slate-400'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}
                        >
                          FEE
                        </div>

                        <div className="flex flex-col text-left min-w-0">
                          <span className={`font-black break-words ${!isActive ? 'text-slate-400' : 'text-slate-700'}`}>
                            {item.Service_Name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-bold break-words">
                            {toWholeNumber(item.Price_Rate || 0).toLocaleString('th-TH')} บาท{item.Service_Unit ? ` / ${item.Service_Unit}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-start lg:justify-center">
                        <div className="flex flex-col gap-1">
                          <span className={`px-4 py-1.5 rounded-xl text-[11px] font-black border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 text-left lg:text-center">
                            {formatDateDisplay(item.Start_Date)} - {formatDateDisplay(item.End_Date)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-stretch lg:justify-end gap-2 lg:pr-4">
                        {isActive && (
                          <button
                            onClick={() => openEditService(item)}
                            className={s.btnAmber + ' !px-5 w-full sm:w-auto'}
                          >
                            แก้ไข
                          </button>
                        )}
                        <button
                          onClick={() => askToggleStatus(item.id, item.Is_Active, item.Service_Name, 'service')}
                          className={`${isActive ? s.btnCancelAction : s.btnRestore} w-full sm:w-auto`}
                        >
                          {isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4 sm:p-6">
          <div className="mb-6">
            <h3 className="text-lg sm:text-xl font-black text-slate-800">กำหนดเกณฑ์ระบบแต้มสะสม</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">จัดการเงื่อนไขการได้รับแต้มและการแลกส่วนลดในหน้าเดียว</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            <div className={`rounded-3xl border p-5 sm:p-6 ${
              pointSettings?.Earning_Is_Active ? 'bg-white border-emerald-100 shadow-sm' : 'bg-slate-100/80 border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div>
                  <h4 className="text-base font-black text-slate-800">เกณฑ์การได้รับแต้ม</h4>
                  <p className="text-xs font-bold text-slate-400 mt-1">กำหนดยอดใช้จ่ายต่อจำนวนแต้มที่ได้รับ</p>
                </div>
                <span className={`px-4 py-1.5 rounded-xl text-[11px] font-black border ${
                  pointSettings?.Earning_Is_Active
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}>
                  {pointSettings?.Earning_Is_Active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  placeholder="ยอดใช้จ่าย (บาท)"
                  value={tempEarn.baht}
                  onChange={(e) => setTempEarn({ ...tempEarn, baht: normalizeWholeNumberInput(e.target.value) })}
                  className={s.input + ' !py-2.5 text-center text-sm'}
                />
                <span className="text-sm font-black text-slate-400 text-center">ได้รับ</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="แต้มที่ได้รับ"
                  value={tempEarn.points}
                  onChange={(e) => setTempEarn({ ...tempEarn, points: normalizeWholeNumberInput(e.target.value) })}
                  className={s.input + ' !py-2.5 text-center text-sm'}
                />
              </div>

              <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <span className="inline-flex w-full sm:w-auto items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm sm:text-base font-black text-orange-700 shadow-sm">
                  ปัจจุบัน: {pointSettings?.Earning_Rate_Amount || 0} บ. = {pointSettings?.Earning_Rate_Points || 0} แต้ม
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => savePointRule('earn')} className={s.btnEmerald + ' !px-5 !py-2.5 text-sm'}>
                    บันทึก
                  </button>
                  {pointSettings && (
                    <button
                      onClick={() => askToggleStatus(pointSettings.id, pointSettings.Earning_Is_Active, 'เกณฑ์สะสมแต้ม', 'earn')}
                      className={`${pointSettings.Earning_Is_Active ? s.btnCancelAction : s.btnRestore} !px-5 !py-2.5 text-sm`}
                    >
                      {pointSettings.Earning_Is_Active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={`rounded-3xl border p-5 sm:p-6 ${
              pointSettings?.Redemption_Is_Active ? 'bg-white border-emerald-100 shadow-sm' : 'bg-slate-100/80 border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div>
                  <h4 className="text-base font-black text-slate-800">เกณฑ์การแลกส่วนลด</h4>
                  <p className="text-xs font-bold text-slate-400 mt-1">กำหนดจำนวนแต้มต่อยอดส่วนลดที่ลูกค้าใช้ได้</p>
                </div>
                <span className={`px-4 py-1.5 rounded-xl text-[11px] font-black border ${
                  pointSettings?.Redemption_Is_Active
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}>
                  {pointSettings?.Redemption_Is_Active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="ใช้แต้ม"
                  value={tempRedeem.points}
                  onChange={(e) => setTempRedeem({ ...tempRedeem, points: normalizeWholeNumberInput(e.target.value) })}
                  className={s.input + ' !py-2.5 text-center text-sm'}
                />
                <span className="text-sm font-black text-slate-400 text-center">แลกได้</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  placeholder="ส่วนลด (บาท)"
                  value={tempRedeem.baht}
                  onChange={(e) => setTempRedeem({ ...tempRedeem, baht: normalizeWholeNumberInput(e.target.value) })}
                  className={s.input + ' !py-2.5 text-center text-sm'}
                />
              </div>

              <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <span className="inline-flex w-full sm:w-auto items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm sm:text-base font-black text-orange-700 shadow-sm">
                  ปัจจุบัน: {pointSettings?.RDT_Rate_Points || 0} แต้ม = {pointSettings?.RDT_Rate_Discount || 0} บ.
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => savePointRule('redeem')} className={s.btnEmerald + ' !px-5 !py-2.5 text-sm'}>
                    บันทึก
                  </button>
                  {pointSettings && (
                    <button
                      onClick={() => askToggleStatus(pointSettings.id, pointSettings.Redemption_Is_Active, 'เกณฑ์แลกแต้ม', 'redeem')}
                      className={`${pointSettings.Redemption_Is_Active ? s.btnCancelAction : s.btnRestore} !px-5 !py-2.5 text-sm`}
                    >
                      {pointSettings.Redemption_Is_Active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {isEditServiceOpen && (
        <div className={`${m.overlay} modal-overlay-transition`}>
          <div className={`${m.card} !max-w-lg modal-card-transition`}>
            <h3 className={m.title}>แก้ไขข้อมูลค่าบริการ</h3>
            <div className="space-y-4 mb-8 text-left">
              <div>
                <label className={s.inputLabel}>ชื่อรายการ</label>
                <input
                  value={editServiceData.Service_Name}
                  onChange={(e) => setEditServiceData({ ...editServiceData, Service_Name: e.target.value })}
                  className={s.input}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={s.inputLabel}>ราคา (บาท)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editServiceData.Price_Rate}
                    onChange={(e) => setEditServiceData({ ...editServiceData, Price_Rate: normalizeWholeNumberInput(e.target.value) })}
                    className={s.input}
                  />
                </div>
                <div>
                  <label className={s.inputLabel}>หน่วยค่าบริการ</label>
                  <input
                    value={editServiceData.Service_Unit}
                    onChange={(e) => setEditServiceData({ ...editServiceData, Service_Unit: e.target.value })}
                    className={s.input}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={s.inputLabel}>วันที่เริ่มใช้งาน</label>
                  <input
                    type="date"
                    value={editServiceData.Start_Date}
                    onChange={(e) => setEditServiceData({ ...editServiceData, Start_Date: e.target.value })}
                    className={s.input}
                  />
                </div>
                <div>
                  <label className={s.inputLabel}>วันที่สิ้นสุด</label>
                  <input
                    type="date"
                    value={editServiceData.End_Date}
                    onChange={(e) => setEditServiceData({ ...editServiceData, End_Date: e.target.value })}
                    className={s.input}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleUpdateService} className={m.btnConfirm}>บันทึกการแก้ไข</button>
              <button onClick={() => { setIsEditServiceOpen(false); setEditingServiceId(null); }} className={m.btnCancel}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <Popup
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onCancel={modal.type === 'danger' ? () => setModal((prev) => ({ ...prev, isOpen: false })) : null}
      />
    </div>
  );
}

export default SystemSettings;
