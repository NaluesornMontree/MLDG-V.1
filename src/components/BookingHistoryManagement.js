import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { theme } from '../styles/theme';
import { NavIcon } from './DashboardNav';

const STATUS_STYLES = {
  pending: 'bg-slate-100 text-slate-600 border-slate-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  occupied: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
  maintenance: 'bg-slate-200 text-slate-600 border-slate-300'
};

const STATUS_LABELS = {
  pending: 'รอตรวจสอบ',
  confirmed: 'ยืนยันแล้ว',
  occupied: 'กำลังใช้งาน',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
  maintenance: 'ปิดปรับปรุง'
};

const BOOKING_TYPE_LABELS = {
  'phone-reservation': 'จองล่วงหน้า',
  'member-lane-activation': 'สมาชิกหน้าร้าน',
  'walk-in': 'Walk-in',
  default: 'ออนไลน์'
};

function getCurrentMonthValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function getMonthLabel(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric'
  });
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || 'ไม่ระบุสถานะ';
}

function getBookingTypeLabel(type) {
  return BOOKING_TYPE_LABELS[type] || BOOKING_TYPE_LABELS.default;
}

function getRowCustomerName(booking) {
  return booking.customerName || booking.FullName || 'ไม่ระบุชื่อ';
}

function getCashierLabel(payment) {
  const name = payment?.Cashier_Name || payment?.cashierName || payment?.Processed_By_Name || '';
  const role = payment?.Cashier_Role || payment?.cashierRole || payment?.Processed_By_Role || '';
  if (!payment) return 'ยังไม่มีข้อมูลการชำระเงิน';
  if (!name && !role) return 'ไม่ระบุผู้รับชำระ';
  return `${name || 'ไม่ระบุชื่อ'}${role ? ` (${String(role).toUpperCase()})` : ''}`;
}

function formatCreatedAt(createdAt) {
  if (!createdAt) return 'ไม่มีเวลาบันทึก';

  try {
    if (typeof createdAt === 'string') {
      const parsed = new Date(createdAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }

    if (createdAt?.toDate) {
      return createdAt.toDate().toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch (error) {
    console.error('Error formatting createdAt:', error);
  }

  return 'ไม่มีเวลาบันทึก';
}

function escapeReceiptText(value) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatReceiptMoney(value) {
  return `${Number(value || 0).toLocaleString()} บาท`;
}

function BookingHistoryManagement() {
  const s = theme.admin;
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [paymentsByBookingId, setPaymentsByBookingId] = useState({});

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const [snapshot, paymentSnapshot] = await Promise.all([
          getDocs(collection(db, 'bookings')),
          getDocs(collection(db, 'payments'))
        ]);
        const bookingList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        const paymentMap = {};
        paymentSnapshot.docs.forEach((paymentDoc) => {
          const payment = { id: paymentDoc.id, ...paymentDoc.data() };
          const bookingId = payment.Booking_ID || payment.bookingId;
          if (!bookingId) return;

          const current = paymentMap[bookingId];
          const paymentTime = payment.Payment_Date?.toDate
            ? payment.Payment_Date.toDate().getTime()
            : new Date(payment.Payment_Date || 0).getTime();
          const currentTime = current?.Payment_Date?.toDate
            ? current.Payment_Date.toDate().getTime()
            : new Date(current?.Payment_Date || 0).getTime();

          if (!current || paymentTime > currentTime) {
            paymentMap[bookingId] = payment;
          }
        });

        bookingList.sort((a, b) => {
          const dateCompare = (b.bookingDate || '').localeCompare(a.bookingDate || '');
          if (dateCompare !== 0) return dateCompare;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });

        setBookings(bookingList);
        setPaymentsByBookingId(paymentMap);
      } catch (error) {
        console.error('Error fetching booking history:', error);
      }
      setLoading(false);
    };

    fetchBookings();
  }, []);

  const monthOptions = useMemo(() => {
    const uniqueMonths = new Set();

    bookings.forEach((booking) => {
      if (booking.bookingDate && booking.bookingDate.length >= 7) {
        uniqueMonths.add(booking.bookingDate.slice(0, 7));
      }
    });

    uniqueMonths.add(getCurrentMonthValue());

    return ['all', ...Array.from(uniqueMonths).sort((a, b) => b.localeCompare(a))];
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const keyword = appliedSearch.trim().toLowerCase();

    return bookings.filter((booking) => {
      const monthMatch =
        selectedMonth === 'all' ||
        (booking.bookingDate || '').startsWith(selectedMonth);

      if (!monthMatch) return false;
      if (!keyword) return true;

      const haystack = [
        booking.customerName,
        booking.customerEmail,
        booking.customerPhone,
        booking.laneNumber,
        Array.isArray(booking.selectedLanes) ? booking.selectedLanes.join(', ') : '',
        booking.bookingDate,
        booking.status,
        booking.bookingType,
        paymentsByBookingId[booking.id]?.Cashier_Name,
        paymentsByBookingId[booking.id]?.Cashier_Role
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [appliedSearch, bookings, paymentsByBookingId, selectedMonth]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setAppliedSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
  };

  const selectedBookingPayment = selectedBooking ? paymentsByBookingId[selectedBooking.id] : null;

  const handleSaveReceipt = () => {
    if (!selectedBooking) return;
    if (!selectedBookingPayment || selectedBookingPayment.status === 'cancelled') {
      alert('ยังไม่สามารถบันทึกใบเสร็จได้ เนื่องจากรายการนี้ยังไม่ได้รับการชำระเงิน');
      return;
    }

    const receiptWindow = window.open('', '_blank', 'width=900,height=900');
    if (!receiptWindow) {
      alert('ไม่สามารถเปิดหน้าบันทึกใบเสร็จได้ กรุณาอนุญาต popup ในเบราว์เซอร์');
      return;
    }

    const laneLabel = selectedBooking.selectedLanes?.length
      ? `เลน ${selectedBooking.selectedLanes.join(', ')}`
      : `เลน ${selectedBooking.laneNumber || '-'}`;
    const timeLabel = Array.isArray(selectedBooking.timeSlots) && selectedBooking.timeSlots.length > 0
      ? selectedBooking.timeSlots.join(', ')
      : '-';
    const rentedClubsHtml = Array.isArray(selectedBooking.rentedClubs) && selectedBooking.rentedClubs.length > 0
      ? selectedBooking.rentedClubs.map((club) => `
          <tr>
            <td>${escapeReceiptText(club.Club_Name || '-')}</td>
            <td>${escapeReceiptText(club.Club_Type || '-')}</td>
            <td class="right">${Number(club.qty || 0).toLocaleString()} ชิ้น</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3" class="muted center">ไม่มีรายการเช่าไม้กอล์ฟ</td></tr>';
    const paymentItemsHtml = Array.isArray(selectedBookingPayment.Items_List) && selectedBookingPayment.Items_List.length > 0
      ? selectedBookingPayment.Items_List.map((item) => `
          <tr>
            <td>${escapeReceiptText(item.item_name || item.name || '-')}</td>
            <td class="right">${Number(item.qty || 0).toLocaleString()}</td>
            <td class="right">${formatReceiptMoney(item.total || item.price || 0)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3" class="muted center">ยังไม่มีรายการชำระเงิน</td></tr>';

    receiptWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Booking Receipt - ${escapeReceiptText(selectedBooking.id)}</title>
          <style>
            * { box-sizing: border-box; }
            @page { size: A4; margin: 8mm; }
            body { margin: 0; padding: 10px; color: #0f172a; font-family: Arial, Tahoma, sans-serif; background: #f8fafc; }
            .receipt { max-width: 780px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
            .header { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
            .eyebrow { color: #059669; font-size: 9px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
            h1 { margin: 3px 0 0; font-size: 18px; }
            .muted { color: #64748b; }
            .content { padding: 12px 16px; }
            .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }
            .box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 8px; background: #f8fafc; min-height: 42px; }
            .label { color: #64748b; font-size: 9px; font-weight: 800; margin-bottom: 2px; }
            .value { font-size: 11px; font-weight: 900; word-break: break-word; line-height: 1.25; }
            h2 { font-size: 12px; margin: 10px 0 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 4px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; font-size: 10px; text-align: left; line-height: 1.25; }
            th { color: #475569; background: #f8fafc; font-size: 9px; text-transform: uppercase; }
            .right { text-align: right; }
            .center { text-align: center; }
            .total { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; row-gap: 2px; margin-top: 10px; border: 1px solid #d1fae5; background: #ecfdf5; border-radius: 10px; padding: 8px 10px; }
            .row { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; font-size: 10px; font-weight: 700; line-height: 1.25; }
            .net { grid-column: 1 / -1; border-top: 1px solid #bbf7d0; margin-top: 4px; padding-top: 6px; font-size: 14px; font-weight: 900; color: #047857; }
            .footer { padding: 8px 16px 10px; color: #64748b; font-size: 9px; text-align: center; }
            @media print {
              body { padding: 0; background: #fff; }
              .receipt { width: 100%; max-width: none; border-radius: 0; border: none; }
              h2, table, .total, .grid { page-break-inside: avoid; break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <main class="receipt">
            <section class="header">
              <div class="eyebrow">Muang Loei Golf</div>
              <h1>ใบเสร็จรายละเอียดการจอง</h1>
              <div class="muted">เลขที่รายการ: ${escapeReceiptText(selectedBooking.id)}</div>
            </section>
            <section class="content">
              <div class="grid">
                <div class="box"><div class="label">วันที่เข้าใช้</div><div class="value">${escapeReceiptText(selectedBooking.bookingDate || '-')}</div></div>
                <div class="box"><div class="label">สถานะ</div><div class="value">${escapeReceiptText(getStatusLabel(selectedBooking.status))}</div></div>
                <div class="box"><div class="label">ชื่อผู้จอง</div><div class="value">${escapeReceiptText(getRowCustomerName(selectedBooking))}</div></div>
                <div class="box"><div class="label">เบอร์โทรศัพท์</div><div class="value">${escapeReceiptText(selectedBooking.customerPhone || '-')}</div></div>
                <div class="box"><div class="label">อีเมล</div><div class="value">${escapeReceiptText(selectedBooking.customerEmail || '-')}</div></div>
                <div class="box"><div class="label">สร้างรายการเมื่อ</div><div class="value">${escapeReceiptText(formatCreatedAt(selectedBooking.createdAt))}</div></div>
                <div class="box"><div class="label">เลนซ้อม</div><div class="value">${escapeReceiptText(laneLabel)}</div></div>
                <div class="box"><div class="label">ช่วงเวลาที่จอง</div><div class="value">${escapeReceiptText(timeLabel)}</div></div>
                <div class="box"><div class="label">บริการเสริม</div><div class="value">ผู้สอนพื้นฐานการเล่นกอล์ฟ: ${selectedBooking.needsInstructor ? 'ต้องการ' : 'ไม่ต้องการ'} | เช่าไม้: ${selectedBooking.needsClubRent ? 'ต้องการ' : 'ไม่ต้องการ'}</div></div>
              </div>
              <h2>รายการไม้กอล์ฟที่เลือกเช่า</h2>
              <table><thead><tr><th>รายการ</th><th>ประเภท</th><th class="right">จำนวน</th></tr></thead><tbody>${rentedClubsHtml}</tbody></table>
              <h2>รายการชำระเงิน</h2>
              <table><thead><tr><th>รายการ</th><th class="right">จำนวน</th><th class="right">ยอดเงิน</th></tr></thead><tbody>${paymentItemsHtml}</tbody></table>
              <div class="total">
                <div class="row"><span>ยอดรวม</span><span>${formatReceiptMoney(selectedBookingPayment.Total_Amount || 0)}</span></div>
                <div class="row"><span>ส่วนลดจากแต้ม</span><span>${formatReceiptMoney(selectedBookingPayment.Point_Discount || 0)}</span></div>
                <div class="row"><span>แต้มที่ใช้</span><span>${Number(selectedBookingPayment.Used_Points || 0).toLocaleString()} PTS</span></div>
                <div class="row"><span>แต้มที่ได้รับ</span><span>+${Number(selectedBookingPayment.Earned_Points || 0).toLocaleString()} PTS</span></div>
                <div class="row"><span>วิธีชำระเงิน</span><span>${escapeReceiptText(selectedBookingPayment.Payment_Method || '-')}</span></div>
                <div class="row"><span>ผู้รับชำระเงิน</span><span>${escapeReceiptText(getCashierLabel(selectedBookingPayment))}</span></div>
                <div class="row net"><span>ยอดสุทธิที่ชำระ</span><span>${formatReceiptMoney(selectedBookingPayment.Net_Amount || 0)}</span></div>
              </div>
            </section>
            <section class="footer">เอกสารนี้สร้างจากระบบ Muang Loei Golf เมื่อ ${new Date().toLocaleString('th-TH')}</section>
          </main>
          <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };

  if (loading) {
    return (
      <div className={s.card}>
        <div className="py-16 text-center text-slate-400 font-black">กำลังโหลดประวัติการจอง...</div>
      </div>
    );
  }

  return (
    <div className={s.card}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <h2 className={s.title + ' !mb-2'}>ประวัติการจองทั้งหมด</h2>
          <p className="text-sm font-bold text-slate-400">
            ตรวจสอบรายการจองย้อนหลังทั้งหมดของร้าน พร้อมค้นหาและกรองตามเดือน
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
          ทั้งหมด {filteredBookings.length} รายการ
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-3 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <NavIcon name="history" className="w-4 h-4" />
            </span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้า, อีเมล, เบอร์โทร"
              className="w-full rounded-2xl border-2 border-slate-200 bg-white pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2 sm:w-auto">
            <button
              type="submit"
              className="flex-1 sm:flex-none rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-emerald-700"
            >
              ค้นหา
            </button>
            <button
              type="button"
              onClick={handleClearSearch}
              className="flex-1 sm:flex-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-100"
            >
              ล้าง
            </button>
          </div>
        </form>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <NavIcon name="calendar" className="w-4 h-4" />
          </span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full appearance-none rounded-2xl border-2 border-slate-200 bg-white pl-11 pr-10 py-3 text-sm font-black text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="all">ทุกเดือน</option>
            {monthOptions
              .filter((option) => option !== 'all')
              .map((monthValue) => (
                <option key={monthValue} value={monthValue}>
                  {getMonthLabel(monthValue)}
                </option>
              ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▼</span>
        </div>
      </div>

      <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-100 bg-white">
        <table className="w-full min-w-[900px] table-fixed text-left border-collapse">
          <colgroup>
            <col className="w-[60px]" />
            <col className="w-[125px]" />
            <col />
            <col className="w-[190px]" />
            <col className="w-[125px]" />
            <col className="w-[115px]" />
            <col className="w-[150px]" />
          </colgroup>
          <thead className="bg-slate-50">
            <tr className="text-xs font-black uppercase tracking-wider text-slate-400">
              <th className="px-3 py-3 whitespace-nowrap">ลำดับ</th>
              <th className="px-3 py-3 whitespace-nowrap">วันที่จอง</th>
              <th className="px-3 py-3">ลูกค้า</th>
              <th className="px-3 py-3">เลน / เวลา</th>
              <th className="px-3 py-3 whitespace-nowrap">รูปแบบการจอง</th>
              <th className="px-3 py-3 whitespace-nowrap">สถานะ</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">รายละเอียด</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-5 py-16 text-center text-sm font-black text-slate-400">
                  ไม่พบประวัติการจองตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              filteredBookings.map((booking, index) => (
                <tr key={booking.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                  <td className="px-3 py-3">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600">
                      {filteredBookings.length - index}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-black text-slate-800">{booking.bookingDate || '-'}</div>
                    <div className="text-[11px] font-bold text-slate-400 mt-1 leading-4 truncate">{formatCreatedAt(booking.createdAt)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-black text-slate-800 truncate leading-5" title={getRowCustomerName(booking)}>{getRowCustomerName(booking)}</div>
                    <div className="text-[11px] font-bold text-slate-400 mt-1 truncate leading-4" title={`${booking.customerEmail || 'ไม่มีอีเมล'} | ${booking.customerPhone || 'ไม่มีเบอร์โทร'}`}>
                      {booking.customerEmail || 'ไม่มีอีเมล'} | {booking.customerPhone || 'ไม่มีเบอร์โทร'}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-black text-emerald-700">เลน {booking.selectedLanes?.join(', ') || booking.laneNumber || '-'}</div>
                    <div className="text-[11px] font-bold text-slate-500 mt-1 truncate leading-4" title={Array.isArray(booking.timeSlots) && booking.timeSlots.length > 0 ? booking.timeSlots.join(', ') : '-'}>
                      {Array.isArray(booking.timeSlots) && booking.timeSlots.length > 0 ? booking.timeSlots.join(', ') : '-'}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="inline-flex whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-black text-slate-600">
                      {getBookingTypeLabel(booking.bookingType)}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`inline-flex whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-[11px] font-black ${STATUS_STYLES[booking.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {getStatusLabel(booking.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedBooking(booking)}
                      className="inline-flex whitespace-nowrap items-center rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-sm shadow-emerald-900/10 transition-all hover:border-emerald-700 hover:bg-emerald-700"
                    >
                      ตรวจสอบรายละเอียด
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {filteredBookings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm font-black text-slate-400">
            ไม่พบประวัติการจองตามเงื่อนไขที่เลือก
          </div>
        ) : (
          filteredBookings.map((booking, index) => (
            <div key={booking.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600">
                    {filteredBookings.length - index}
                  </div>
                  <div className="min-w-0">
                  <div className="text-base font-black text-slate-800 break-words leading-6">{getRowCustomerName(booking)}</div>
                  <div className="text-sm font-bold text-slate-400 mt-1">{booking.bookingDate || '-'}</div>
                  </div>
                </div>
                <span className={`shrink-0 inline-flex rounded-xl border px-3 py-1.5 text-[11px] font-black ${STATUS_STYLES[booking.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {getStatusLabel(booking.status)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 text-sm font-bold">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <span className="block text-[11px] font-black text-slate-400 mb-1">เลน / เวลา</span>
                  <span className="text-emerald-700">เลน {booking.selectedLanes?.join(', ') || booking.laneNumber || '-'}</span>
                  <span className="block text-xs text-slate-500 mt-1">
                    {Array.isArray(booking.timeSlots) && booking.timeSlots.length > 0 ? booking.timeSlots.join(', ') : '-'}
                  </span>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <span className="block text-[11px] font-black text-slate-400 mb-1">ข้อมูลติดต่อ</span>
                  <span className="block text-slate-700 break-words">{booking.customerEmail || 'ไม่มีอีเมล'}</span>
                  <span className="block text-xs text-slate-500 mt-1">{booking.customerPhone || 'ไม่มีเบอร์โทร'}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-600">
                    {getBookingTypeLabel(booking.bookingType)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBooking(booking)}
                  className="mt-2 inline-flex w-full items-center justify-center whitespace-nowrap rounded-2xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-sm shadow-emerald-900/10 transition-all hover:border-emerald-700 hover:bg-emerald-700"
                >
                  ตรวจสอบรายละเอียด
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-[#fcfcfb] border border-slate-200 shadow-2xl overflow-hidden">
            <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-black text-slate-800">ใบเสร็จรายละเอียดการจอง</h3>
                  <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-slate-400">
                    วันที่จอง: {selectedBooking.bookingDate || '-'} | สร้างเมื่อ {formatCreatedAt(selectedBooking.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="h-8 w-8 shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-base font-black text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.55fr)_260px]">
              <div className="space-y-3">
                <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Booking Info</p>
                  <h4 className="mt-0.5 text-sm font-black text-slate-800">ข้อมูลการจอง</h4>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="text-[10px] font-black text-slate-400 mb-1">ชื่อลูกค้า</div>
                      <div className="text-sm font-black text-slate-800 break-words">{getRowCustomerName(selectedBooking)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="text-[10px] font-black text-slate-400 mb-1">รูปแบบการจอง</div>
                      <div className="text-sm font-black text-slate-800">{getBookingTypeLabel(selectedBooking.bookingType)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="text-[10px] font-black text-slate-400 mb-1">อีเมล</div>
                      <div className="text-sm font-black text-slate-800 break-words">{selectedBooking.customerEmail || 'ไม่มีอีเมล'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="text-[10px] font-black text-slate-400 mb-1">เบอร์โทรศัพท์</div>
                      <div className="text-sm font-black text-slate-800">{selectedBooking.customerPhone || 'ไม่มีเบอร์โทร'}</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Lane Schedule</p>
                  <h4 className="mt-0.5 text-sm font-black text-slate-800">เลนและช่วงเวลาใช้งาน</h4>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                      <div className="text-[10px] font-black text-emerald-500 mb-1">เลนซ้อม</div>
                      <div className="text-sm font-black text-emerald-700">เลน {selectedBooking.selectedLanes?.join(', ') || selectedBooking.laneNumber || '-'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="text-[10px] font-black text-slate-400 mb-1">จำนวนผู้เข้าใช้</div>
                      <div className="text-sm font-black text-slate-800">{selectedBooking.guestCount || 1} ท่าน</div>
                    </div>
                    <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="text-[10px] font-black text-slate-400 mb-1">ช่วงเวลาซ้อม</div>
                      <div className="text-sm font-black text-slate-800 break-words">
                        {Array.isArray(selectedBooking.timeSlots) && selectedBooking.timeSlots.length > 0 ? selectedBooking.timeSlots.join(', ') : '-'}
                      </div>
                    </div>
                  </div>
                </section>

                {Array.isArray(selectedBooking.rentedClubs) && selectedBooking.rentedClubs.length > 0 && (
                  <section className="rounded-2xl border border-emerald-100 bg-white p-3 sm:p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-500">Rental Clubs</p>
                    <h4 className="mt-0.5 text-sm font-black text-slate-800">รายการไม้กอล์ฟที่เลือกเช่า</h4>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedBooking.rentedClubs.map((club, index) => (
                        <div key={`${club.Club_Name || 'club'}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                          <div className="min-w-0 text-sm font-black text-emerald-800 break-words">{club.Club_Name || 'ไม่ระบุชื่อไม้กอล์ฟ'}</div>
                          <div className="shrink-0 rounded-lg bg-white/90 px-2.5 py-1 text-xs font-black text-emerald-700 border border-emerald-200">
                            {club.qty || 0} ชิ้น
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="space-y-3">
                <aside className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Status</p>
                  <h4 className="mt-0.5 text-sm font-black text-slate-800">สรุปสถานะการจอง</h4>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="text-[10px] font-black text-slate-400 mb-1">สถานะปัจจุบัน</div>
                      <span className={`inline-flex rounded-xl border px-3 py-1.5 text-xs font-black ${STATUS_STYLES[selectedBooking.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {getStatusLabel(selectedBooking.status)}
                      </span>
                    </div>
                    <div className={`rounded-xl border px-3 py-2.5 ${selectedBooking.needsInstructor ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="text-[10px] font-black text-slate-400 mb-1">ผู้สอนพื้นฐานการเล่นกอล์ฟ</div>
                      <div className={`text-sm font-black ${selectedBooking.needsInstructor ? 'text-indigo-700' : 'text-slate-500'}`}>
                        {selectedBooking.needsInstructor ? 'ต้องการ' : 'ไม่ต้องการ'}
                      </div>
                    </div>
                    <div className={`rounded-xl border px-3 py-2.5 ${selectedBooking.needsClubRent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="text-[10px] font-black text-slate-400 mb-1">เช่าไม้กอล์ฟ</div>
                      <div className={`text-sm font-black ${selectedBooking.needsClubRent ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {selectedBooking.needsClubRent ? 'ต้องการ' : 'ไม่ต้องการ'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="text-[10px] font-black text-slate-400 mb-1">ผู้รับชำระเงิน</div>
                      <div className="text-sm font-black text-slate-800 break-words">{getCashierLabel(selectedBookingPayment)}</div>
                    </div>
                  </div>
                </aside>

                <aside className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Payment Summary</p>
                  <h4 className="mt-0.5 text-sm font-black text-slate-800">รายการชำระเงินและสรุปยอด</h4>
                  {!selectedBookingPayment ? (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">
                      ยังไม่มีข้อมูลการชำระเงินสำหรับรายการนี้
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex justify-between text-sm font-bold text-slate-600">
                        <span>ยอดรวม</span>
                        <span>{Number(selectedBookingPayment.Total_Amount || 0).toLocaleString()} บาท</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-slate-600">
                        <span>ส่วนลดจากแต้ม</span>
                        <span>{Number(selectedBookingPayment.Point_Discount || 0).toLocaleString()} บาท</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="rounded-xl bg-white px-3 py-2">
                          <div className="text-[10px] font-black text-slate-400">แต้มที่ได้รับ</div>
                          <div className="text-sm font-black text-emerald-800">+{Number(selectedBookingPayment.Earned_Points || 0).toLocaleString()} PTS</div>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-slate-600">
                        <span>วิธีชำระเงิน</span>
                        <span>{selectedBookingPayment.Payment_Method || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                        <span className="text-base font-black text-slate-800">ยอดสุทธิที่ชำระ</span>
                        <span className="text-xl font-black text-emerald-700">{Number(selectedBookingPayment.Net_Amount || 0).toLocaleString()} บาท</span>
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleSaveReceipt}
                disabled={!selectedBookingPayment || selectedBookingPayment.status === 'cancelled'}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {!selectedBookingPayment || selectedBookingPayment.status === 'cancelled' ? 'รอรับชำระเงิน' : 'บันทึกใบเสร็จ'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-5 py-2 rounded-xl text-xs transition-all"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookingHistoryManagement;
