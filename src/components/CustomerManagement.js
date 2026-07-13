import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { theme } from '../styles/theme';
import Popup from './Popup';

function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editForm, setEditForm] = useState({ FullName: '', PhoneNumber: '' });
  const [alertPopup, setAlertPopup] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null
  });

  const s = theme.admin;
  const m = theme.modal;
  const actionButtonSize = '!px-4 !py-2 !text-xs !rounded-xl whitespace-nowrap';

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const customerList = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rawRole = data.Role || data.role || '';
        if (rawRole.trim().toLowerCase() === 'customer') {
          customerList.push({
            id: docSnap.id,
            Email: data.Email || data.email || '',
            FullName: data.FullName || data.displayName || '',
            PhoneNumber: data.PhoneNumber || data.phone || '',
            Is_Active: data.Is_Active ?? data.isActive ?? true
          });
        }
      });
      setCustomers(customerList);
    } catch (error) {
      console.error('Error fetching customers: ', error);
      setAlertPopup({
        isOpen: true,
        type: 'danger',
        title: 'เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้า',
        onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false }))
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleEditClick = (customer) => {
    setEditingCustomer(customer.id);
    setEditForm({
      FullName: customer.FullName || '',
      PhoneNumber: customer.PhoneNumber || ''
    });
  };

  const handleUpdate = async () => {
    try {
      const customerRef = doc(db, 'users', editingCustomer);
      await updateDoc(customerRef, {
        FullName: editForm.FullName,
        PhoneNumber: editForm.PhoneNumber
      });
      setAlertPopup({
        isOpen: true,
        type: 'info',
        title: 'บันทึกสำเร็จ',
        message: 'อัปเดตข้อมูลลูกค้าสำเร็จ',
        onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false }))
      });
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error) {
      console.error('Error updating customer: ', error);
      setAlertPopup({
        isOpen: true,
        type: 'danger',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถแก้ไขข้อมูลได้',
        onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false }))
      });
    }
  };

  const handleToggleActive = async (customer) => {
    const currentStatus = customer.Is_Active !== false;
    const actionText = currentStatus ? 'ระงับการใช้งาน' : 'เปิดใช้งาน';

    setAlertPopup({
      isOpen: true,
      type: 'warning',
      title: `ยืนยัน${actionText}`,
      message: `ยืนยัน${actionText}สำหรับลูกค้า ${customer.Email || customer.FullName || 'รายการนี้'} ?`,
      onConfirm: async () => {
        try {
          const customerRef = doc(db, 'users', customer.id);
          await updateDoc(customerRef, {
            Is_Active: !currentStatus
          });
          setAlertPopup({
            isOpen: true,
            type: 'info',
            title: 'สำเร็จ',
            message: 'ปรับสถานะบัญชีลูกค้าสำเร็จ',
            onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false }))
          });
          fetchCustomers();
        } catch (error) {
          console.error('Error toggling active status: ', error);
          setAlertPopup({
            isOpen: true,
            type: 'danger',
            title: 'เกิดข้อผิดพลาด',
            message: 'ไม่สามารถเปลี่ยนสถานะข้อมูลได้',
            onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false }))
          });
        }
      }
    });
  };

  const handleDelete = async (id) => {
    setAlertPopup({
      isOpen: true,
      type: 'danger',
      title: 'ยืนยันการลบข้อมูล',
      message: 'ยืนยันการลบข้อมูลลูกค้าแบบถาวร?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', id));
          setAlertPopup({
            isOpen: true,
            type: 'info',
            title: 'ลบสำเร็จ',
            message: 'ลบข้อมูลลูกค้าเรียบร้อยแล้ว',
            onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false }))
          });
          fetchCustomers();
        } catch (error) {
          console.error('Error deleting customer: ', error);
          setAlertPopup({
            isOpen: true,
            type: 'danger',
            title: 'เกิดข้อผิดพลาด',
            message: 'ไม่สามารถลบข้อมูลได้',
            onConfirm: () => setAlertPopup((prev) => ({ ...prev, isOpen: false }))
          });
        }
      }
    });
  };

  const normalizeText = (value) => value.toString().toLowerCase().trim();
  const normalizePhone = (value) => value.toString().replace(/\D/g, '');

  const getCustomerName = (customer) => (
    customer.FullName || customer.Email || customer.PhoneNumber || ''
  ).toString().trim();

  const filteredCustomers = customers
    .filter((customer) => {
      const keyword = normalizeText(searchTerm);
      const phoneKeyword = normalizePhone(searchTerm);
      if (!keyword) return true;

      const fullName = customer.FullName || '';
      const email = customer.Email || '';
      const phone = customer.PhoneNumber || '';

      return (
        normalizeText(fullName).includes(keyword) ||
        normalizeText(email).includes(keyword) ||
        normalizeText(phone).includes(keyword) ||
        (phoneKeyword && normalizePhone(phone).includes(phoneKeyword))
      );
    })
    .sort((a, b) => getCustomerName(a).localeCompare(getCustomerName(b), ['en', 'th'], {
      numeric: true,
      sensitivity: 'base'
    }));

  if (loading) {
    return (
      <div className={s.card}>
        <div className="text-center py-10 font-bold text-slate-500">กำลังโหลดข้อมูลลูกค้า...</div>
      </div>
    );
  }

  return (
    <div className={s.card}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-10 gap-4">
        <div>
          <h2 className={s.title + ' !mb-1'}>จัดการข้อมูลลูกค้า</h2>
        </div>
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-black px-4 py-2 rounded-2xl">
          ทั้งหมด {customers.length} คน
        </span>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหา"
          className={s.input + ' !py-2.5 text-sm bg-white'}
        />
      </div>

      <div className="hidden lg:grid grid-cols-4 px-8 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
        <div className="col-span-2 ml-16 text-[15px]">ข้อมูลลูกค้า</div>
        <div className="text-center text-[15px]">สถานะบัญชี</div>
        <div className="text-right mr-8 text-[15px]">การจัดการ</div>
      </div>

      <div className="space-y-3">
        {filteredCustomers.map((customer) => {
          const isAccountActive = customer.Is_Active !== false;

          return (
            <div key={customer.id} className={!isAccountActive ? s.itemCardDisabled : s.itemCard}>
              <div className="grid grid-cols-1 lg:grid-cols-4 w-full items-start lg:items-center gap-4">
                <div className="lg:col-span-2 flex items-center gap-3 sm:gap-5 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[10px] font-black uppercase tracking-tight ${
                      !isAccountActive
                        ? 'bg-slate-200 text-slate-400'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}
                  >
                    CUST
                  </div>

                  <div className="flex flex-col text-left min-w-0">
                    <span className={`font-black break-words ${!isAccountActive ? 'text-slate-400' : 'text-slate-700'}`}>
                      {customer.FullName || 'ไม่ระบุชื่อ'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold break-all">
                      {customer.Email || 'ไม่มีอีเมล'} | {customer.PhoneNumber || 'ไม่มีเบอร์โทร'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-start lg:justify-center">
                  <span
                    className={`px-4 py-1.5 rounded-xl text-[11px] font-black border ${
                      isAccountActive
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-rose-50 text-rose-500 border-rose-100'
                    }`}
                  >
                    {isAccountActive ? 'พร้อมใช้งาน' : 'ระงับการใช้งาน'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row justify-stretch lg:justify-end gap-2 lg:pr-4">
                  {isAccountActive && (
                    <button
                      onClick={() => handleEditClick(customer)}
                      className={`${s.btnAmber} ${actionButtonSize} w-full sm:w-auto`}
                    >
                      แก้ไข
                    </button>
                  )}

                  <button
                    onClick={() => handleToggleActive(customer)}
                    className={`${!isAccountActive ? s.btnRestore : s.btnCancelAction} ${actionButtonSize} w-full sm:w-auto`}
                  >
                    {!isAccountActive ? 'เปิดใช้งาน' : 'ระงับสิทธิ์'}
                  </button>

                  <button
                    onClick={() => handleDelete(customer.id)}
                    className={`bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white font-black transition-all w-full sm:w-auto ${actionButtonSize}`}
                  >
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredCustomers.length === 0 && (
          <p className="text-slate-400 font-bold italic py-4 text-center">
            {searchTerm.trim() ? 'ไม่พบข้อมูลลูกค้าที่ตรงกับคำค้นหา' : 'ไม่มีข้อมูลลูกค้าในระบบ'}
          </p>
        )}
      </div>

      {editingCustomer && (
        <div className={m.overlay}>
          <div className={m.card + ' !max-w-lg'}>
            <h3 className={m.title}>แก้ไขข้อมูลลูกค้า</h3>
            <div className="space-y-4 mb-8 text-left">
              <div>
                <label className={s.inputLabel}>ชื่อจริง-นามสกุล</label>
                <input
                  type="text"
                  value={editForm.FullName}
                  onChange={(e) => setEditForm({ ...editForm, FullName: e.target.value })}
                  className={s.input}
                  required
                />
              </div>
              <div>
                <label className={s.inputLabel}>เบอร์โทรศัพท์ (10 หลัก)</label>
                <input
                  type="text"
                  value={editForm.PhoneNumber}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, '');
                    setEditForm({ ...editForm, PhoneNumber: onlyNums });
                  }}
                  className={s.input}
                  maxLength={10}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleUpdate} className={m.btnConfirm}>บันทึกการแก้ไข</button>
              <button onClick={() => setEditingCustomer(null)} className={m.btnCancel}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <Popup
        isOpen={alertPopup.isOpen}
        type={alertPopup.type}
        title={alertPopup.title}
        message={alertPopup.message}
        onConfirm={alertPopup.onConfirm}
        onCancel={() => setAlertPopup((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default CustomerManagement;
