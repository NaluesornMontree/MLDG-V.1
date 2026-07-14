import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { CheckIcon, UserIcon } from './AppIcons';

function OtherIncomeModal({ isOpen, onClose, setAlert, cashierInfo = null }) {
  const [customerForm, setCustomerForm] = useState({
    customerName: '',
    customerPhone: '',
    guestCount: '1',
    description: '',
    method: 'เงินสด'
  });

  const [services, setServices] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [manualSelectedSlots, setManualSelectedSlots] = useState({});
  const [loadingServices, setLoadingServices] = useState(true);

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
    }
  }, [isOpen]);

  const handleSlotClick = (laneNum, slot) => {
    const laneKey = `lane_${laneNum}`;
    const current = manualSelectedSlots[laneKey] || [];
    if (current.includes(slot)) {
      const updated = current.filter(s => s !== slot);
      if (updated.length === 0) {
        const copy = { ...manualSelectedSlots }; delete copy[laneKey]; setManualSelectedSlots(copy);
      } else { setManualSelectedSlots({ ...manualSelectedSlots, [laneKey]: updated }); }
    } else { setManualSelectedSlots({ ...manualSelectedSlots, [laneKey]: [...current, slot] }); }
  };

  const getSlotsCount = () => Object.values(manualSelectedSlots).reduce((acc, curr) => acc + curr.length, 0);

  // ระบบคำนวณสล็อตเวลาสัมพันธ์กับค่าบริการเลนอัตโนมัติ
  useEffect(() => {
    const slotsCount = getSlotsCount();
    setQuantities(prev => {
      const updated = { ...prev };
      services.forEach(service => {
        const name = service.Service_Name || "";
        if (name.includes("เลน") || name.includes("ชั่วโมง")) {
          updated[service.id] = slotsCount;
        }
      });
      return updated;
    });
  }, [manualSelectedSlots, services]);

  const handleQuantityChange = (serviceId, change) => {
    setQuantities(prev => ({
      ...prev,
      [serviceId]: Math.max(0, (prev[serviceId] || 0) + change)
    }));
  };

  const totalAmount = services.reduce((sum, service) => {
    const qty = quantities[service.id] || 0;
    const rate = Number(service.Price_Rate || 0);
    return sum + (qty * rate);
  }, 0);

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

    try {
      const selectedLanes = Object.keys(manualSelectedSlots).map(key => parseInt(key.replace('lane_', ''))).sort((a, b) => a - b);
      
      const itemsList = [];
      services.forEach(service => {
        const qty = quantities[service.id] || 0;
        if (qty > 0) {
          itemsList.push({
            item_name: service.Service_Name,
            qty: qty,
            price: qty * Number(service.Price_Rate || 0),
            unit: service.Unit || 'หน่วย'
          });
        }
      });

      await addDoc(collection(db, 'payments'), {
        Booking_ID: 'manual_income_' + Date.now(),
        User_ID: 'walk-in',
        FullName: customerForm.customerName,
        Customer_Phone: customerForm.customerPhone,
        Guest_Count: Number(customerForm.guestCount),
        Description: customerForm.description.trim(), // บันทึกหมายเหตุลงฐานข้อมูล
        Payment_Date: serverTimestamp(),
        Cashier_ID: cashierInfo?.id || '',
        Cashier_Name: cashierInfo?.name || 'ไม่ระบุชื่อผู้รับชำระ',
        Cashier_Role: cashierInfo?.role || '',
        Cashier_Email: cashierInfo?.email || '',
        Total_Amount: totalAmount,
        Used_Points: 0,
        Point_Discount: 0,
        Net_Amount: totalAmount,
        Payment_Method: customerForm.method,
        Lane_Code: selectedLanes.length > 0 ? `เลน ${selectedLanes.join(', ')}` : 'เบ็ดเตล็ดหน้าร้าน',
        status: 'active',
        Items_List: itemsList
      });

      onClose();
      setAlert({
        isOpen: true,
        type: 'info',
        title: 'บันทึกสำเร็จ',
        message: `ระบบบันทึกยอดรายได้เบ็ดเตล็ดคุณ ${customerForm.customerName} จำนวน ${totalAmount} บาท เรียบร้อยแล้ว`,
        onConfirm: () => setAlert(p => ({ ...p, isOpen: false }))
      });
    } catch (err) { 
      alert("เกิดข้อผิดพลาด: " + err.message); 
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-xs flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-6xl bg-white p-4 sm:p-6 rounded-3xl sm:rounded-[2.5rem] shadow-2xl border text-left flex flex-col max-h-none sm:max-h-[94vh] overflow-visible sm:overflow-hidden">
        
        <div className="border-b pb-3 mb-4 flex justify-between items-start gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-800">บันทึกรายได้เบ็ดเตล็ดหน้าร้าน (ดึงจากผังเวลาและค่าบริการจริง)</h3>
            <p className="text-xs text-slate-400 mt-0.5">ระบุข้อมูลผู้ใช้บริการ เลือกช่องเวลาตาราง หรือคลิกเลือกสินค้าเพื่อคำนวณเงินสด/โอนสุทธิ</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 overflow-visible sm:overflow-hidden flex-1 w-full">
          
          {/* ผังกระดานตารางหมากรุกพิกัดเวลาเลนซ้อม 1-15 ด้านซ้าย */}
          <div className="lg:col-span-2 border rounded-2xl p-3 sm:p-4 bg-slate-50 overflow-auto h-full">
            <p className="text-xs font-black text-indigo-600 mb-3">
              คลิกจิ้มเลือกช่องตารางเลนซ้อม <span className="text-red-500 font-extrabold">* (จำเป็นต้องเลือกอย่างน้อย 1 ช่องเวลา)</span> :
            </p>
            <table className="w-full min-w-[650px] border-collapse text-center text-xs">
              <thead>
                <tr className="bg-slate-200 border-b text-slate-700">
                  <th className="p-2 font-black sticky left-0 bg-slate-300 z-10 w-20">เลนซ้อม</th>
                  {TIME_SLOTS.map(slot => (
                    <th key={slot} className="p-2 font-bold border-r text-[10px]">{slot.split('-')[0]}</th>
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
                        <td key={slot} onClick={() => handleSlotClick(num, slot)} className={`p-2 border-r cursor-pointer font-bold select-none text-[11px] transition-all h-9 ${isSel ? 'bg-amber-400 text-amber-950 border border-amber-500 shadow-inner' : 'text-transparent hover:bg-slate-200 border-slate-200'}`}>
                          {isSel ? <CheckIcon className="mx-auto h-3.5 w-3.5" /> : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ฟอร์มกรอกข้อมูลลูกค้าและรายการคิดเงินไดนามิกด้านขวา */}
          <div className="lg:col-span-1 bg-white border border-slate-200 p-3 sm:p-5 rounded-2xl flex flex-col justify-between h-full overflow-visible sm:overflow-hidden">
            
            <div className="space-y-4 overflow-y-auto flex-1 pr-1 pb-4">
              {/* ข้อมูลส่วนตัวผู้ใช้บริการ */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                <span className="flex items-center gap-1.5 text-xs font-black text-slate-700 border-b pb-1">
                  <UserIcon className="h-3.5 w-3.5" />
                  <span>ข้อมูลส่วนตัวผู้ใช้บริการ</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  <input type="number" min="1" value={customerForm.guestCount} onChange={e => setCustomerForm({ ...customerForm, guestCount: e.target.value })} className="w-full bg-white border p-2 rounded-lg text-xs font-bold focus:outline-none text-center" />
                </div>
                
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
                      const rate = Number(service.Price_Rate || 0);
                      const isLaneService = service.Service_Name.includes("เลน") || service.Service_Name.includes("ชั่วโมง");

                      return (
                        <div key={service.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 text-[11px] font-bold">
                          <div className="text-left flex-1 truncate pr-1">
                            <span className="text-slate-800 block truncate">{service.Service_Name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{rate} ฿ / {service.Unit}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button type="button" onClick={() => handleQuantityChange(service.id, -1)} disabled={isLaneService} className={`w-5 h-5 rounded flex items-center justify-center font-black text-white ${isLaneService ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-400'}`}>-</button>
                            <span className="w-4 text-center text-slate-800 text-xs">{qty}</span>
                            <button type="button" onClick={() => handleQuantityChange(service.id, 1)} disabled={isLaneService} className={`w-5 h-5 rounded flex items-center justify-center font-black text-white ${isLaneService ? 'bg-slate-300 cursor-not-allowed' : 'bg-green-400'}`}>+</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ยอดสรุปจำนวนเงินสุทธิ */}
              <div className="border-t pt-2 flex justify-between items-center text-slate-800">
                <span className="text-sm font-black"> ยอดรวมชำระสุทธิ:</span>
                <span className="text-xl font-black text-emerald-700">{totalAmount} บาท</span>
              </div>

              {/* เมนูช่องทางการชำระเงิน */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1">ช่องทางรับชำระเงิน</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {['เงินสด', 'เงินโอน', 'รวมทั้งสอง'].map(m => (
                    <button key={m} type="button" onClick={() => setCustomerForm({ ...customerForm, method: m })} className={`py-2 text-[11px] font-black rounded-xl border transition-all truncate ${customerForm.method === m ? 'bg-emerald-100 border-emerald-400 text-emerald-800 shadow-xs' : 'bg-slate-50 text-slate-400'}`}>{m}</button>
                  ))}
                </div>
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
