import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";

function AdminDashboard() {
  const [clubName, setClubName] = useState('');
  const [clubs, setClubs] = useState([]);

  // ฟังก์ชันดึงข้อมูลไม้กอล์ฟทั้งหมด
  const fetchClubs = async () => {
    const data = await getDocs(collection(db, "golf_clubs"));
    setClubs(data.docs.map(doc => ({ ...doc.data(), id: doc.id })));
  };

  useEffect(() => { fetchClubs(); }, []);

  // ฟังก์ชัน "เพิ่มไม้กอล์ฟอัตโนมัติ" [cite: 74]
  const handleAddClub = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "golf_clubs"), {
      clubType: clubName,
      status: "available", // ตั้งค่าว่างอัตโนมัติ [cite: 176]
      rentalPrice: 20,      // ค่าเช่า 20 บาท ตามที่ระบุในบทที่ 2 
      createdAt: new Date()
    });
    setClubName('');
    fetchClubs();
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-green-800 mb-6">แผงควบคุมผู้ดูแลระบบ [cite: 70]</h1>

      {/* ส่วนจัดการไม้กอล์ฟ [cite: 74] */}
      <section className="bg-white p-4 sm:p-6 rounded-xl shadow-sm mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">เพิ่มอุปกรณ์ไม้กอล์ฟ</h2>
        <form onSubmit={handleAddClub} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <input 
            type="text" 
            placeholder="ชื่อรุ่นไม้กอล์ฟ (เช่น Iron 7, Driver)" 
            className="border p-2 rounded-lg flex-1 min-w-0"
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            required
          />
          <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 w-full sm:w-auto">
            เพิ่มอัตโนมัติ
          </button>
        </form>
      </section>

      {/* ตารางแสดงอุปกรณ์ [cite: 74] */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clubs.map(club => (
          <div key={club.id} className="bg-white p-4 rounded-lg border flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <p className="font-medium">{club.clubType}</p>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">สถานะ: {club.status}</span>
            </div>
            <button className="text-red-500 text-sm">ลบ</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminDashboard;
