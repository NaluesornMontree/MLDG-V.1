import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { theme } from '../styles/theme';
import IntegerStepperInput from './IntegerStepperInput';
import QuantityAdjuster from './QuantityAdjuster';
import { toWholeNumber } from '../utils/numberUtils';

function Checkout({ userId }) {
  // 1. สร้าง State สำหรับเก็บราคาที่ดึงมาจากฐานข้อมูล
  const [pricing, setPricing] = useState({ 
    ballPrice: 30, 
    clubPrice: 20, 
    damageFee: 100, 
    pointRate: 10 
  });
  
  const [ballCount, setBallCount] = useState(1);
  const [clubCount, setClubCount] = useState(0);
  const [isDamaged, setIsDamaged] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);

  const s = theme.checkout;

  // 2. ดึงราคาจากระบบ และแต้มของผู้ใช้
  useEffect(() => {
    const fetchData = async () => {
      // ดึงราคาตั้งค่าระบบ (จากรูป image_12c0a1.png)
      const priceSnap = await getDoc(doc(db, "system_settings", "prices"));
      if (priceSnap.exists()) {
        setPricing(priceSnap.data());
      }

      // ดึงแต้มลูกค้า (จากรูป image_00645e.png)
      if (userId) {
        const userSnap = await getDoc(doc(db, "users", userId));
        if (userSnap.exists()) setUserPoints(userSnap.data().totalPoints || 0);
      }
    };
    fetchData();
  }, [userId]);

  // 3. คำนวณยอดเงินโดยใช้ราคาจากฐานข้อมูล (Pricing State)
  const safeBallCount = Math.max(0, toWholeNumber(ballCount));
  const safeClubCount = Math.max(0, toWholeNumber(clubCount));
  const grossTotal = (safeBallCount * pricing.ballPrice) + (safeClubCount * pricing.clubPrice) + (isDamaged ? pricing.damageFee : 0);
  const safePointsToUse = Math.min(
    Math.max(0, toWholeNumber(pointsToUse)),
    Math.floor(Number(userPoints) || 0)
  );
  const discount = Math.floor(safePointsToUse / pricing.pointRate); 
  const netTotal = Math.max(0, grossTotal - discount);
  const earnedPoints = Math.floor(netTotal / pricing.pointRate);

  const handlePayment = async () => {
    try {
      await setDoc(doc(db, "users", userId), {
        totalPoints: increment(earnedPoints - safePointsToUse),
        lastUpdate: serverTimestamp()
      }, { merge: true });
      window.appAlert(`ชำระเงินสำเร็จ!\nยอดสุทธิ: ฿${netTotal}\nได้รับแต้มใหม่: +${earnedPoints} แต้ม`);
      setUserPoints(prev => prev + (earnedPoints - safePointsToUse));
      setPointsToUse(0);
    } catch (err) { window.appAlert(err.message); }
  };

  return (
    <div className={s.container}>
      <h3 className="text-xl font-black text-slate-800 text-center mb-8 uppercase tracking-tighter">Muang Loei Golf Bill</h3>
      
      <div className="space-y-1 mb-6">
        <h4 className={s.sectionTitle}>รายการบริการ (ราคาปัจจุบัน)</h4>
        
        {/* รายการลูกกอล์ฟ - แสดงราคาตามฐานข้อมูล */}
        <div className={s.row}>
          <span className={s.label}>ลูกกอล์ฟ ({pricing.ballPrice}.-/ถาด)</span>
          <QuantityAdjuster value={ballCount} onChange={setBallCount} min={0} ariaLabel="จำนวนถาดลูกกอล์ฟ" />
        </div>

        {/* รายการเช่าไม้ - แสดงราคาตามฐานข้อมูล */}
        <div className={s.row}>
          <span className={s.label}>เช่าไม้กอล์ฟ ({pricing.clubPrice}.-/รอบ)</span>
          <QuantityAdjuster value={clubCount} onChange={setClubCount} min={0} ariaLabel="จำนวนไม้กอล์ฟ" />
        </div>

        {/* ค่าปรับ - แสดงราคาตามฐานข้อมูล */}
        <div className={s.row}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isDamaged} onChange={(e)=>setIsDamaged(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-emerald-600" />
            <span className={`${s.label} ${isDamaged ? 'text-red-500' : ''}`}>อุปกรณ์ชำรุด (ปรับ {pricing.damageFee}.-)</span>
          </label>
        </div>
      </div>

      {/* ส่วนลดและแต้มสะสม */}
      <div className={s.pointsBox}>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase">แต้มสะสมปัจจุบัน</p>
            <p className="text-2xl font-black text-emerald-800">{userPoints} PTS</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">ใช้แต้ม (ทุก {pricing.pointRate} แต้ม = ฿1)</p>
            <IntegerStepperInput className="ml-auto w-28" compact value={safePointsToUse} onChange={setPointsToUse} min={0} max={Math.floor(Number(userPoints) || 0)} ariaLabel="จำนวนแต้มที่ใช้" />
          </div>
        </div>
      </div>

      <div className={s.totalCard}>
        <div className="flex justify-between items-center text-emerald-700">
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Net Total</span>
          <span className="text-4xl font-black tracking-tighter">฿{netTotal}</span>
        </div>
      </div>

      <button onClick={handlePayment} className={s.btnPay}>CONFIRM PAYMENT</button>
      <p className="text-center text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-widest">
        ชำระครั้งนี้จะได้รับ: +{earnedPoints} Points
      </p>
    </div>
  );
}

export default Checkout;
