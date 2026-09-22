import React, { useState, useEffect } from 'react';
import { db, secondaryAuth } from '../firebase'; 
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, deleteUser, fetchSignInMethodsForEmail, signOut } from "firebase/auth";
import { theme } from '../styles/theme';
import Popup from './Popup';
import {
  findUserByEmail,
  getDuplicateEmailMessage,
  isValidEmailFormat,
  normalizeEmail,
  normalizePhoneNumber
} from '../utils/userPhoneUtils';
import {
  assertEmailAvailableForSignup,
  assertPhoneAvailableForSignup,
  isContactError,
  saveUserProfileWithContactRegistry
} from '../utils/contactRegistryUtils';
import PasswordStrengthMeter, { getPasswordStrength } from './PasswordStrengthMeter';
import { getFirebaseAuthErrorMessage } from '../utils/firebaseErrorMessages';
import PasswordInput from './PasswordInput';

function StaffManagement() {
  const [staffs, setStaffs] = useState([]);
  const [staffRoleFilter, setStaffRoleFilter] = useState('owner');
  const [staffSearch, setStaffSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [weakPasswordConfirmOpen, setWeakPasswordConfirmOpen] = useState(false);

  // เพิ่ม Role ในการสร้างบัญชีใหม่ (เผื่ออนาคตต้องการเลือกสร้างทั้ง Owner หรือ Staff)
  const [newStaff, setNewStaff] = useState({ FullName: '', Email: '', PhoneNumber: '', Password: '', ConfirmPassword: '', Role: 'staff' });
  const [editData, setEditData] = useState({ FullName: '', Email: '', PhoneNumber: '', Role: 'staff' });
  const [modal, setModal] = useState({ isOpen: false, id: null, status: null, email: '' });
  
  const s = theme.admin;
  const m = theme.modal; 

  const fetchStaff = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      const allUsers = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      
      const filteredStaffs = allUsers.filter(user => {
        const userRole = user.Role || user.role || '';
        const roleClean = userRole.toString().trim().toLowerCase();
        return roleClean === 'staff' || roleClean === 'owner';
      });
      
      setStaffs(filteredStaffs);
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleAddStaff = async (allowWeakPassword = false) => {
    try {
      const normalizedPhone = normalizePhoneNumber(newStaff.PhoneNumber);
      const normalizedEmail = normalizeEmail(newStaff.Email);
      const missingFields = [];

      if (!newStaff.FullName.trim()) missingFields.push('ชื่อ-นามสกุล');
      if (!normalizedEmail) missingFields.push('อีเมล');
      if (!newStaff.Password) missingFields.push('รหัสผ่าน');
      if (!newStaff.ConfirmPassword) missingFields.push('ยืนยันรหัสผ่าน');
      if (!normalizedPhone) missingFields.push('เบอร์โทรศัพท์');

      if (missingFields.length > 0) {
        window.appAlert(`สร้างบัญชีไม่สำเร็จ เพราะกรอกข้อมูลไม่ครบ: ${missingFields.join(', ')}`);
        return;
      }

      if (!isValidEmailFormat(normalizedEmail)) {
        window.appAlert("สร้างบัญชีไม่สำเร็จ เพราะรูปแบบอีเมลไม่ถูกต้อง กรุณากรอกอีเมลให้ครบถ้วน เช่น name@example.com");
        return;
      }
      if (normalizedPhone.length !== 10) {
        window.appAlert("สร้างบัญชีไม่สำเร็จ เพราะเบอร์โทรศัพท์ต้องมี 10 หลัก");
        return;
      }
      if (newStaff.Password !== newStaff.ConfirmPassword) {
        window.appAlert("สร้างบัญชีไม่สำเร็จ เพราะรหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
        return;
      }
      if (newStaff.Password.length < 8) {
        window.appAlert("สร้างบัญชีไม่สำเร็จ เพราะรหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
        return;
      }

      await assertPhoneAvailableForSignup(db, normalizedPhone);

      const duplicateEmailUser = await findUserByEmail(db, normalizedEmail);
      if (duplicateEmailUser) {
        window.appAlert(getDuplicateEmailMessage(normalizedEmail));
        return;
      }
      await assertEmailAvailableForSignup(db, normalizedEmail);
      const existingSignInMethods = await fetchSignInMethodsForEmail(secondaryAuth, normalizedEmail);
      if (existingSignInMethods.length > 0) {
        window.appAlert(getDuplicateEmailMessage(normalizedEmail));
        return;
      }

      if (!allowWeakPassword && !getPasswordStrength(newStaff.Password).isAcceptable) {
        setWeakPasswordConfirmOpen(true);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        normalizedEmail,
        newStaff.Password
      );
      const user = userCredential.user;

      try {
        await saveUserProfileWithContactRegistry(db, user.uid, {
          User_ID: user.uid,
          FullName: newStaff.FullName,
          Email: normalizedEmail,
          PhoneNumber: normalizedPhone,
          Role: newStaff.Role, // บันทึก Role ตามที่เลือก
          Is_Active: true,
          CreatedAt: new Date()
        }, { merge: false });
      } catch (profileError) {
        try {
          await deleteUser(user);
        } catch (deleteError) {
          // Show the useful profile error instead of a cleanup error.
        }

        throw profileError;
      }

      await signOut(secondaryAuth);

      setNewStaff({ FullName: '', Email: '', PhoneNumber: '', Password: '', ConfirmPassword: '', Role: 'staff' });
      setIsAddModalOpen(false);
      fetchStaff();
      window.appAlert("เพิ่มสมาชิกในทีมและสร้างบัญชีเข้าใช้งานเรียบร้อยแล้ว");
    } catch (err) {
      if (isContactError(err)) {
        window.appAlert(err.message);
        return;
      }
      window.appAlert(`สร้างบัญชีไม่สำเร็จ: ${getFirebaseAuthErrorMessage(err, 'กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง')}`);
    }
  };

  const handleUpdate = async () => {
    if (!editData.FullName || !editData.Email) {
      window.appAlert("กรุณากรอกชื่อและอีเมลให้ครบถ้วน");
      return;
    }
    
    try {
      const normalizedPhone = normalizePhoneNumber(editData.PhoneNumber);
      const normalizedEmail = normalizeEmail(editData.Email);
      if (!isValidEmailFormat(normalizedEmail)) {
        window.appAlert("รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกอีเมลให้ครบถ้วน เช่น name@example.com");
        return;
      }
      if (normalizedPhone.length !== 10) {
        window.appAlert("กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก");
        return;
      }

      const duplicateEmailUser = await findUserByEmail(db, normalizedEmail, editingId);
      if (duplicateEmailUser) {
        window.appAlert(getDuplicateEmailMessage(normalizedEmail));
        return;
      }

      await saveUserProfileWithContactRegistry(db, editingId, {
        FullName: editData.FullName,
        Email: normalizedEmail,
        PhoneNumber: normalizedPhone,
        Role: editData.Role // อัปเดตบทบาทได้ด้วย
      });
      setIsEditModalOpen(false);
      setEditingId(null);
      fetchStaff();
      window.appAlert("แก้ไขข้อมูลสมาชิกในทีมสำเร็จ");
    } catch (error) {
      console.error("Error updating team member:", error);
      if (isContactError(error)) {
        window.appAlert(error.message);
        return;
      }
      window.appAlert("ไม่สามารถอัปเดตข้อมูลได้");
    }
  };

  const toggleStaffStatus = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, "users", id), { Is_Active: !currentStatus });
      setModal({ ...modal, isOpen: false });
      fetchStaff();
    } catch (error) {
      console.error("Error toggling status:", error);
      window.appAlert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะบัญชี");
    }
  };

  const normalizeText = (value) => value.toString().toLowerCase().trim();
  const normalizePhone = (value) => value.toString().replace(/\D/g, '');
  const getStaffName = (staff) => (
    staff.FullName || staff.fullName || staff.displayName || staff.Email || staff.email || ''
  ).toString().trim();

  const sortedStaffs = staffs
    .filter((staff) => {
      const role = (staff.Role || staff.role || '').toString().trim().toLowerCase();
      return role === staffRoleFilter;
    })
    .filter((staff) => {
      const keyword = normalizeText(staffSearch);
      const phoneKeyword = normalizePhone(staffSearch);
      if (!keyword) return true;

      const fullName = staff.FullName || staff.fullName || '';
      const email = staff.Email || staff.email || '';
      const phone = staff.PhoneNumber || staff.phone || '';

      return (
        normalizeText(fullName).includes(keyword) ||
        normalizeText(email).includes(keyword) ||
        normalizeText(phone).includes(keyword) ||
        (phoneKeyword && normalizePhone(phone).includes(phoneKeyword))
      );
    })
    .sort((a, b) => getStaffName(a).localeCompare(getStaffName(b), ['en', 'th'], {
      numeric: true,
      sensitivity: 'base'
    }));

  return (
    <div className={s.card}>
      {/* ส่วนหัวปรับเปลี่ยนเป็น "จัดการบุคลากร" */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-10 gap-4">
        <h2 className={s.title + " !mb-0"}>จัดการบุคลากร</h2>
        <button onClick={() => setIsAddModalOpen(true)} className={s.btnEmerald + " !py-3 !px-6 text-sm w-full sm:w-auto"}>
          เพิ่มสมาชิกในทีม
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
        <input
          type="search"
          value={staffSearch}
          onChange={(e) => setStaffSearch(e.target.value)}
          placeholder="ค้นหา"
          className={s.input + " !py-2.5 text-sm bg-white"}
        />
        <select
          value={staffRoleFilter}
          onChange={(e) => setStaffRoleFilter(e.target.value)}
          className={s.input + " !py-2.5 text-sm bg-white w-full"}
        >
          <option value="owner">Owner</option>
          <option value="staff">Staff</option>
        </select>
      </div>

      <div className="hidden lg:grid grid-cols-4 px-8 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
        <div className="col-span-2 ml-16 text-[15px]">ข้อมูลสมาชิก</div>
        <div className="text-center text-[15px]">บทบาท/ระดับสิทธิ์</div>
        <div className="text-right mr-8 text-[15px]">การจัดการการเข้าถึง</div>
      </div>

      <div className="space-y-3">
        {sortedStaffs.map(staff => {
          const rawRole = staff.Role || staff.role || '';
          const isOwner = rawRole.toString().trim().toLowerCase() === 'owner';
          const isAccountActive = staff.Is_Active ?? staff.isActive ?? true;

          return (
            <div key={staff.id} className={!isAccountActive ? s.itemCardDisabled : s.itemCard}>
              <div className="grid grid-cols-1 lg:grid-cols-4 w-full items-start lg:items-center gap-4">
                <div className="lg:col-span-2 flex items-center gap-3 sm:gap-5 min-w-0">
                  
                  {/* แสดงสัญลักษณ์ประเภทสมาชิก */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[10px] font-black uppercase tracking-tighter ${
                    !isAccountActive 
                      ? 'bg-slate-200 text-slate-400' 
                      : isOwner 
                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}>
                    {isOwner ? 'OWNER' : 'STAFF'}
                  </div>
                  
                  <div className="flex flex-col text-left min-w-0">
                    <span className={`font-black ${!isAccountActive ? 'text-slate-400' : 'text-slate-700'}`}>
                      {staff.FullName || staff.fullName || 'ไม่ระบุชื่อ'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold break-all">
                      {staff.Email || staff.email} | {staff.PhoneNumber || staff.phone || 'ไม่มีเบอร์โทร'}
                    </span>
                  </div>
                </div>
                
                {/* แสดง Badge บทบาทที่อ่านง่ายขึ้น */}
                <div className="flex justify-start lg:justify-center">
                  <span className={`px-4 py-1.5 rounded-xl text-[11px] font-black ${
                    isOwner 
                      ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}>
                    {isOwner ? 'เจ้าของร้าน (Owner)' : 'พนักงาน (Staff)'}
                  </span>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-stretch lg:justify-end gap-2 lg:pr-4">
                  {/* เจ้าของร้านสามารถกดแก้ไขได้ หรือถ้าต้องการล็อกไว้สำหรับ Owner คนอื่นก็สามารถเปิดเงื่อนไขได้ */}
                  {isAccountActive && (
                    <button 
                      onClick={() => { 
                        setEditingId(staff.id); 
                        setEditData({ 
                          FullName: staff.FullName || staff.fullName || '', 
                          Email: staff.Email || staff.email || '', 
                          PhoneNumber: staff.PhoneNumber || staff.phone || '',
                          Role: rawRole.toString().toLowerCase()
                        });
                        setIsEditModalOpen(true);
                      }} 
                      className={s.btnAmber + " !px-5 w-full sm:w-auto"}
                    >
                      แก้ไข
                    </button>
                  )}
                  
                  {/* ป้องกันไม่ให้ปิดใช้งาน (Disable) บัญชีของ Owner เองเพื่อความปลอดภัย */}
                  {!isOwner && (
                    <button 
                      onClick={() => setModal({ 
                        isOpen: true, 
                        id: staff.id, 
                        status: isAccountActive, 
                        email: staff.Email || staff.email, 
                        title: isAccountActive ? "ระงับสิทธิ์การใช้งาน" : "เปิดใช้งานสิทธิ์", 
                        message: `ยืนยันการเปลี่ยนสถานะการเข้าถึงระบบของ ${staff.Email || staff.email}` 
                      })} 
                      className={`${!isAccountActive ? s.btnRestore : s.btnCancelAction} w-full sm:w-auto`}
                    >
                      {!isAccountActive ? "เปิดใช้งานสิทธิ์" : "ระงับสิทธิ์"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ฟอร์มแก้ไขข้อมูลสมาชิกในทีม */}
      {isEditModalOpen && (
        <div className={`${m.overlay} modal-overlay-transition`}>
          <div className={`${m.card} !max-w-lg modal-card-transition`}>
            <h3 className={m.title}>แก้ไขข้อมูลสมาชิกในทีม</h3>
            <div className="space-y-4 mb-8 text-left">
              <div>
                <label className={s.inputLabel}>ชื่อจริง-นามสกุล</label>
                <input value={editData.FullName} onChange={(e) => setEditData({...editData, FullName: e.target.value})} className={s.input} />
              </div>
              <div>
                <label className={s.inputLabel}>อีเมล (Email)</label>
                <input type="email" value={editData.Email} onChange={(e) => setEditData({...editData, Email: e.target.value})} className={s.input} />
              </div>
              <div>
                <label className={s.inputLabel}>เบอร์โทรศัพท์ (10 หลัก)</label>
                <input 
                  type="text" 
                  value={editData.PhoneNumber} 
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, '');
                    setEditData({...editData, PhoneNumber: onlyNums});
                  }} 
                  className={s.input} 
                  maxLength={10}
                />
              </div>
              <div>
                <label className={s.inputLabel}>บทบาทในระบบ</label>
                <select value={editData.Role} onChange={(e) => setEditData({...editData, Role: e.target.value})} className={s.input}>
                  <option value="staff">พนักงาน (Staff)</option>
                  <option value="owner">เจ้าของร้าน (Owner)</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleUpdate} className={m.btnConfirm}>บันทึกการแก้ไข</button>
              <button onClick={() => { setIsEditModalOpen(false); setEditingId(null); }} className={m.btnCancel}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ฟอร์มเพิ่มสมาชิกใหม่ */}
      {isAddModalOpen && (
        <div className={`${m.overlay} modal-overlay-transition`}>
          <div className={`${m.card} !max-w-lg modal-card-transition`}>
            <h3 className={m.title}>เพิ่มสมาชิกใหม่ในทีม</h3>
            <div className="space-y-4 mb-8 text-left">
              <div>
                <label className={s.inputLabel}>ชื่อจริง-นามสกุล</label>
                <input value={newStaff.FullName} onChange={(e) => setNewStaff({...newStaff, FullName: e.target.value})} className={s.input} />
              </div>
              <div>
                <label className={s.inputLabel}>อีเมล (Email)</label>
                <input type="email" value={newStaff.Email} onChange={(e) => setNewStaff({...newStaff, Email: e.target.value})} className={s.input} />
              </div>
              <div>
                <label className={s.inputLabel}>เบอร์โทรศัพท์ (10 หลัก)</label>
                <input 
                  type="text" 
                  value={newStaff.PhoneNumber} 
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, '');
                    setNewStaff({...newStaff, PhoneNumber: onlyNums});
                  }} 
                  className={s.input} 
                  maxLength={10}
                />
              </div>
              <div>
                <label className={s.inputLabel}>กำหนดบทบาทการใช้งาน</label>
                <select value={newStaff.Role} onChange={(e) => setNewStaff({...newStaff, Role: e.target.value})} className={s.input}>
                  <option value="staff">พนักงาน (Staff)</option>
                  <option value="owner">เจ้าของร้าน (Owner)</option>
                </select>
              </div>
              <div>
                <label className={s.inputLabel}>รหัสผ่าน (Password)</label>
                <PasswordInput value={newStaff.Password} onChange={(e) => setNewStaff({...newStaff, Password: e.target.value})} className={s.input} autoComplete="new-password" />
              </div>
              <div>
                <label className={s.inputLabel}>ยืนยันรหัสผ่าน</label>
                <PasswordInput value={newStaff.ConfirmPassword} onChange={(e) => setNewStaff({...newStaff, ConfirmPassword: e.target.value})} className={s.input} autoComplete="new-password" />
                <PasswordStrengthMeter password={newStaff.Password} className="mt-2" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleAddStaff(false)} className={m.btnConfirm}>ยืนยันการเพิ่มสมาชิก</button>
              <button onClick={() => setIsAddModalOpen(false)} className={m.btnCancel}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <Popup 
        isOpen={modal.isOpen} 
        type={modal.status === false ? 'info' : 'danger'} 
        title={modal.title} 
        message={modal.message} 
        onConfirm={() => toggleStaffStatus(modal.id, modal.status)} 
        onCancel={() => setModal({ ...modal, isOpen: false })} 
      />
      <Popup
        isOpen={weakPasswordConfirmOpen}
        type="warning"
        title="รหัสผ่านนี้ยังค่อนข้างง่าย"
        message="รหัสผ่านที่ตั้งยังเดาง่ายกว่าที่แนะนำ คุณมั่นใจกับรหัสผ่านนี้แล้วใช่ไหม?"
        confirmLabel="ใช่ ใช้รหัสนี้"
        cancelLabel="กลับไปแก้ไข"
        onConfirm={() => {
          setWeakPasswordConfirmOpen(false);
          handleAddStaff(true);
        }}
        onCancel={() => setWeakPasswordConfirmOpen(false)}
      />
    </div>
  );
}

export default StaffManagement;
