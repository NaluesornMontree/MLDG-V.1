// 1. นำเข้าฟังก์ชันที่จำเป็น
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 2. Config ของคุณ (ถูกต้องแล้วครับ)
const firebaseConfig = {
  apiKey: "AIzaSyBLoeMsabyHYLwG5axZ1pvOg3d3oxBtHlc",
  authDomain: "muangloeigolf.firebaseapp.com",
  projectId: "muangloeigolf",
  storageBucket: "muangloeigolf.firebasestorage.app",
  messagingSenderId: "62676532771",
  appId: "1:62676532771:web:36b5a94e8afc9ab76ffb96",
  measurementId: "G-G927NZXVR8"
};

// 1. เริ่มต้น Firebase App หลัก
const app = initializeApp(firebaseConfig);

// 2. เริ่มต้น Firebase App สำรอง (สำหรับสร้างพนักงานใหม่โดย Admin ไม่หลุดจากระบบ)
const secondaryApp = initializeApp(firebaseConfig, "Secondary"); 

// 3. สร้างตัวแปรส่งออก (Export) โดยประกาศเพียงครั้งเดียว
export const db = getFirestore(app);
export const auth = getAuth(app); // ตัวหลักสำหรับ Login/Logout ทั่วไป
export const secondaryAuth = getAuth(secondaryApp); // ตัวรองสำหรับฟังก์ชันเพิ่มพนักงาน