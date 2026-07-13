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

function BookingHistoryManagement() {
  const s = theme.admin;
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, 'bookings'));
        const bookingList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        bookingList.sort((a, b) => {
          const dateCompare = (b.bookingDate || '').localeCompare(a.bookingDate || '');
          if (dateCompare !== 0) return dateCompare;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });

        setBookings(bookingList);
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
        booking.bookingType
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [appliedSearch, bookings, selectedMonth]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setAppliedSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
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
              placeholder="ค้นหาชื่อลูกค้า, อีเมล, เบอร์โทร, เลน, สถานะ..."
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
                  <h3 className="text-lg sm:text-xl font-black text-slate-800">รายละเอียดการจอง</h3>
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
                      <div className="text-[10px] font-black text-slate-400 mb-1">ผู้สอนพื้นฐาน</div>
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
                  </div>
                </aside>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-5 flex justify-end">
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
