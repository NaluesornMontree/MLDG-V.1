import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { NavIcon } from './DashboardNav';
import { toWholeNumber } from '../utils/numberUtils';

const todayKey = () => new Date().toISOString().split('T')[0];

const toDate = (value) => {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getNumericPaymentField = (payment, fieldNames = []) => {
  for (const fieldName of fieldNames) {
    const value = payment?.[fieldName];
    if (value !== undefined && value !== null && value !== '') {
      return toWholeNumber(value);
    }
  }
  return null;
};

const getPaymentAmount = (payment) => {
  const netAmount = getNumericPaymentField(payment, ['Net_Amount', 'netAmount']);
  if (netAmount !== null) return netAmount;

  const cashAmount = getNumericPaymentField(payment, ['Cash_Amount', 'cashAmount']) || 0;
  const transferAmount = getNumericPaymentField(payment, ['Transfer_Amount', 'transferAmount']) || 0;
  if (cashAmount + transferAmount > 0) return cashAmount + transferAmount;

  return getNumericPaymentField(payment, ['Total_Amount', 'totalAmount']) || 0;
};

const getPaymentBreakdown = (payment) => {
  const cash = getNumericPaymentField(payment, ['Cash_Amount', 'cashAmount']) || 0;
  const transfer = getNumericPaymentField(payment, ['Transfer_Amount', 'transferAmount']) || 0;
  if (cash + transfer > 0) return { cash, transfer, total: cash + transfer };
  const total = getPaymentAmount(payment);
  const method = String(payment?.Payment_Method || payment?.paymentMethod || '').toLowerCase();
  return {
    cash: method.includes('cash') || method.includes('สด') ? total : 0,
    transfer: method.includes('transfer') || method.includes('โอน') ? total : 0,
    total
  };
};

const MONTH_LABELS_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const buildRevenueReport = (payments = [], year = new Date().getFullYear()) => {
  const monthly = MONTH_LABELS_TH.map((label, index) => ({
    label,
    month: index,
    total: 0,
    cash: 0,
    transfer: 0,
    count: 0
  }));

  payments.forEach((payment) => {
    const paymentDate = getPaymentDate(payment);
    if (!paymentDate || paymentDate.getFullYear() !== year || payment.status === 'cancelled') return;

    const monthIndex = paymentDate.getMonth();
    const breakdown = getPaymentBreakdown(payment);
    monthly[monthIndex].total += breakdown.total;
    monthly[monthIndex].cash += breakdown.cash;
    monthly[monthIndex].transfer += breakdown.transfer;
    monthly[monthIndex].count += 1;
  });

  const yearTotal = monthly.reduce((sum, month) => sum + month.total, 0);
  const cashTotal = monthly.reduce((sum, month) => sum + month.cash, 0);
  const transferTotal = monthly.reduce((sum, month) => sum + month.transfer, 0);
  const bestMonth = monthly.reduce((best, month) => (
    month.total > best.total ? month : best
  ), monthly[0]);

  return {
    year,
    monthly,
    yearTotal,
    cashTotal,
    transferTotal,
    bestMonth,
    averageMonthly: yearTotal / 12
  };
};

const formatPoints = (value) => toWholeNumber(value).toLocaleString();

const getTimeValue = (date) => date?.getTime?.() || 0;

const getBookingCreatedDate = (booking) => (
  toDate(booking.createdAt || booking.Created_At || booking.Booking_Created_At || booking.updatedAt)
);

const getPaymentDate = (payment) => (
  toDate(payment.Payment_Date || payment.createdAt || payment.Created_At || payment.updatedAt)
);

const getReportRange = (
  range,
  month = new Date().getMonth(),
  year = new Date().getFullYear(),
  customStart,
  customEnd
) => {
  const today = new Date();
  const end = range === 'custom' && customEnd
    ? new Date(`${customEnd}T23:59:59.999`)
    : range === 'month'
    ? new Date(year, month + 1, 0, 23, 59, 59, 999)
    : range === 'year'
      ? new Date(year, 11, 31, 23, 59, 59, 999)
      : new Date(today);
  const start = range === 'custom' && customStart
    ? new Date(`${customStart}T00:00:00`)
    : range === 'month'
    ? new Date(year, month, 1, 0, 0, 0, 0)
    : range === 'year'
      ? new Date(year, 0, 1, 0, 0, 0, 0)
      : new Date(end);
  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (range === '7days') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
};

const buildFilteredRevenueReport = (payments = [], range = 'year', month, year, customStart, customEnd) => {
  const { start, end } = getReportRange(range, month, year, customStart, customEnd);
  const filteredPayments = payments.filter((payment) => {
    const date = getPaymentDate(payment);
    return date && date >= start && date <= end;
  });
  const daily = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);
  while (cursor <= lastDay && daily.length < 366) {
    const dayKey = cursor.toISOString().split('T')[0];
    const dayPayments = filteredPayments.filter((payment) => getPaymentDate(payment)?.toISOString().split('T')[0] === dayKey);
    const totals = dayPayments.reduce((summary, payment) => {
      const breakdown = getPaymentBreakdown(payment);
      return {
        cash: summary.cash + breakdown.cash,
        transfer: summary.transfer + breakdown.transfer,
        total: summary.total + breakdown.total
      };
    }, { cash: 0, transfer: 0, total: 0 });
    daily.push({
      key: dayKey,
      label: cursor.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      ...totals
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  const weekly = [];
  for (let index = 0; index < daily.length; index += 7) {
    const days = daily.slice(index, index + 7);
    weekly.push(days.reduce((summary, day) => ({
      key: days[0].key,
      label: days.length > 1 ? `${days[0].label} - ${days[days.length - 1].label}` : days[0].label,
      cash: summary.cash + day.cash,
      transfer: summary.transfer + day.transfer,
      total: summary.total + day.total
    }), { cash: 0, transfer: 0, total: 0 }));
  }
  return { ...buildRevenueReport(filteredPayments, end.getFullYear()), daily, weekly, dayCount: daily.length };
};

const getReviewDate = (review) => (
  toDate(review.createdAt || review.Review_Date || review.reviewDate || review.updatedAt)
);

const getReviewBookingId = (review) => (
  review.bookingId || review.Booking_ID || review.BookingId || review.booking_id || ''
);

const getBookingStartDate = (booking) => {
  const bookingDate = booking.bookingDate || booking.Booking_Date;
  if (!bookingDate) return getBookingCreatedDate(booking);
  const firstSlot = Array.isArray(booking.timeSlots) && booking.timeSlots.length > 0
    ? [...booking.timeSlots].sort()[0]
    : booking.Time_Slot || booking.timeSlot || '';
  const startTime = String(firstSlot).split('-')[0] || '00:00';
  const date = new Date(`${bookingDate}T${startTime}:00`);
  return Number.isNaN(date.getTime()) ? getBookingCreatedDate(booking) : date;
};

const getCustomerEmailVariants = (user, userData) => {
  const emails = [user?.email, userData?.Email, userData?.email]
    .filter(Boolean)
    .map((email) => String(email).trim())
    .filter(Boolean);
  return [...new Set(emails.flatMap((email) => [email, email.toLowerCase()]))];
};

const fetchCustomerBookings = async (user, userData) => {
  if (!user?.uid) return [];

  const bookingQueries = [
    query(collection(db, 'bookings'), where('User_ID', '==', user.uid)),
    query(collection(db, 'bookings'), where('userId', '==', user.uid)),
    query(collection(db, 'bookings'), where('uid', '==', user.uid))
  ];

  getCustomerEmailVariants(user, userData).forEach((email) => {
    ['customerEmail', 'Email', 'email', 'Customer_Email', 'memberEmail'].forEach((fieldName) => {
      bookingQueries.push(query(collection(db, 'bookings'), where(fieldName, '==', email)));
    });
  });

  const snapshots = await Promise.all(
    bookingQueries.map((bookingQuery) => getDocs(bookingQuery).catch(() => ({ docs: [] })))
  );
  const bookingsById = new Map();

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((bookingDoc) => {
      bookingsById.set(bookingDoc.id, { id: bookingDoc.id, ...bookingDoc.data() });
    });
  });

  return [...bookingsById.values()];
};

const getBookingStatusLabel = (status) => {
  const statusMap = {
    pending: 'รอตรวจสอบ',
    confirmed: 'ยืนยันแล้ว',
    occupied: 'กำลังใช้งาน',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก',
    booking: 'รายการจอง'
  };
  return statusMap[status] || status || 'รายการจอง';
};

function StatCard({ label, value, hint, tone = 'slate', icon = 'dashboard', onClick, active = false }) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100'
  }[tone] || 'bg-slate-50 text-slate-700 border-slate-100';
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition-all ${
        active
          ? 'border-emerald-300 ring-4 ring-emerald-50'
          : 'border-slate-200'
      } ${onClick ? 'hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md' : ''}`}
    >
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border ${toneClass}`}>
        <NavIcon name={icon} className="h-5 w-5" />
      </div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <div className="mt-1 text-sm font-black text-slate-700">{label}</div>
      {hint && <div className="mt-1 text-xs font-bold text-slate-400">{hint}</div>}
    </Component>
  );
}

function QuickAction({ label, description, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
        <NavIcon name={icon} className="h-5 w-5" />
      </div>
      <div className="text-sm font-black text-slate-800 group-hover:text-emerald-700">{label}</div>
      <div className="mt-1 text-xs font-bold leading-relaxed text-slate-400">{description}</div>
    </button>
  );
}

const getBookingCustomer = (booking) => (
  booking.customerName || booking.FullName || booking.Customer_Name || 'ไม่ระบุชื่อลูกค้า'
);

const getBookingLane = (booking) => {
  if (Array.isArray(booking.selectedLanes) && booking.selectedLanes.length > 0) {
    return booking.selectedLanes.join(', ');
  }
  return booking.Lane_Code || booking.laneNumber || booking.laneCode || 'ไม่ระบุเลน';
};

const getBookingTime = (booking) => {
  if (Array.isArray(booking.timeSlots) && booking.timeSlots.length > 0) {
    return booking.timeSlots.join(', ');
  }
  return booking.Time_Slot || booking.timeSlot || '-';
};

const getBookingPhone = (booking) => (
  booking.customerPhone || booking.PhoneNumber || booking.phone || booking.Customer_Phone || 'ไม่ระบุเบอร์โทร'
);

const getBookingGuestCount = (booking) => Number(booking.guestCount || booking.Member_Count || booking.memberCount || 1);

const getYesNoText = (value) => (value ? 'ต้องการ' : 'ไม่ต้องการ');

const getBookingDetails = (booking) => ([
  `เบอร์โทร: ${getBookingPhone(booking)}`,
  `จำนวนผู้เข้าใช้งาน: ${getBookingGuestCount(booking)} ท่าน`,
  `ผู้สอนพื้นฐานการเล่นกอล์ฟ: ${getYesNoText(Boolean(booking.needsInstructor || booking.Needs_Instructor))}`,
  `เช่าไม้: ${getYesNoText(Boolean(booking.needsClubRent || booking.Needs_Club_Rent || (Array.isArray(booking.rentedClubs) && booking.rentedClubs.length > 0)))}`
]);

function SummaryRow({ title, meta, value, tone = 'slate', details = [] }) {
  const valueClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100'
  }[tone] || 'bg-slate-50 text-slate-700 border-slate-100';

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-black text-slate-800 break-words">{title}</div>
        {meta && <div className="mt-1 max-w-2xl whitespace-pre-wrap break-words text-xs font-black leading-relaxed text-slate-600">{meta}</div>}
        {details.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {details.map((detail) => (
              <span
                key={detail}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600"
              >
                {detail}
              </span>
            ))}
          </div>
        )}
      </div>
      {value && (
        <div className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-black ${valueClass}`}>
          {value}
        </div>
      )}
    </div>
  );
}

function DashboardSummaryPanel({ selected, stats, sortMode, onSortModeChange }) {
  const summaries = {
    bookingsToday: {
      title: 'ข้อมูลสรุปการจองวันนี้',
      empty: 'ยังไม่มีรายการจองสำหรับวันนี้',
      sortable: true,
      allowUpcomingSort: true,
      rows: stats.bookingsTodayList.map((booking) => ({
        title: getBookingCustomer(booking),
        meta: `${getBookingLane(booking)} | ${getBookingTime(booking)}`,
        value: getBookingStatusLabel(booking.status || 'booking'),
        tone: 'emerald',
        createdAt: getBookingCreatedDate(booking),
        startAt: getBookingStartDate(booking),
        details: getBookingDetails(booking)
      }))
    },
    activeLanes: {
      title: 'ข้อมูลสรุปเลนที่กำลังใช้งาน',
      empty: 'ยังไม่มีเลนที่กำลังใช้งาน',
      rows: stats.activeLaneList.map((booking) => ({
        title: getBookingLane(booking),
        meta: `${getBookingCustomer(booking)} | ${getBookingTime(booking)}`,
        value: 'กำลังใช้งาน',
        tone: 'amber',
        createdAt: getBookingCreatedDate(booking),
        startAt: getBookingStartDate(booking),
        details: getBookingDetails(booking)
      }))
    },
    pendingBookings: {
      title: 'ข้อมูลสรุปรายการรอเช็กอิน',
      empty: 'ไม่มีรายการที่รอเช็กอิน',
      sortable: true,
      allowUpcomingSort: true,
      rows: stats.pendingBookingList.map((booking) => ({
        title: getBookingCustomer(booking),
        meta: `${booking.bookingDate || '-'} | ${getBookingLane(booking)} | ${getBookingTime(booking)}`,
        value: 'รอเช็กอิน',
        tone: 'blue',
        createdAt: getBookingCreatedDate(booking),
        startAt: getBookingStartDate(booking),
        details: getBookingDetails(booking)
      }))
    },
    revenueToday: {
      title: 'ข้อมูลสรุปยอดชำระวันนี้',
      empty: 'ยังไม่มีรายการชำระเงินวันนี้',
      sortable: true,
      allowUpcomingSort: false,
      rows: stats.paymentsTodayList.map((payment) => ({
        title: payment.FullName || payment.Customer_Name || 'ไม่ระบุชื่อลูกค้า',
        meta: payment.Payment_Method ? `ช่องทางชำระเงิน: ${payment.Payment_Method}` : 'ไม่ระบุช่องทางชำระเงิน',
        value: `${getPaymentAmount(payment).toLocaleString()} บาท`,
        tone: 'slate',
        createdAt: getPaymentDate(payment)
      }))
    },
    shopRating: {
      title: 'ข้อมูลสรุปคะแนนของร้าน',
      empty: 'ยังไม่มีรีวิวจากลูกค้า',
      rows: stats.reviewsList.map((review) => ({
        title: review.Customer_Name || review.customerName || 'ไม่ระบุชื่อลูกค้า',
        meta: review.Comment || review.comment || 'ไม่มีความคิดเห็นเพิ่มเติม',
        value: `${Number(review.Rating || review.rating || 0).toFixed(1)} คะแนน`,
        tone: 'amber',
        createdAt: getReviewDate(review)
      }))
    },
    memberPoints: {
      title: 'ข้อมูลสรุปแต้มสะสม',
      empty: 'ยังไม่มีข้อมูลแต้มสะสม',
      rows: [{
        title: 'แต้มสะสมปัจจุบัน',
        meta: 'แต้มที่สามารถใช้แลกส่วนลดได้ตามเงื่อนไขของร้าน',
        value: `${formatPoints(stats.pointsBalance)} PTS`,
        tone: 'amber',
        createdAt: new Date(),
        details: [
          `รายการจองทั้งหมด: ${stats.totalBookings} รายการ`,
          `รีวิวและการให้คะแนน: ${stats.reviewCount} รายการ`
        ]
      }]
    },
    memberBookings: {
      title: 'ข้อมูลสรุปรายการจองทั้งหมด',
      empty: 'ยังไม่มีรายการจองในบัญชีนี้',
      sortable: true,
      allowUpcomingSort: true,
      rows: stats.memberBookingList.map((booking) => ({
        title: getBookingCustomer(booking),
        meta: `${booking.bookingDate || '-'} | เลน ${getBookingLane(booking)} | ${getBookingTime(booking)}`,
        value: getBookingStatusLabel(booking.status || 'booking'),
        tone: booking.status === 'completed' ? 'emerald' : booking.status === 'pending' ? 'blue' : booking.status === 'cancelled' ? 'rose' : 'slate',
        createdAt: getBookingCreatedDate(booking),
        startAt: getBookingStartDate(booking),
        details: getBookingDetails(booking)
      }))
    },
    memberReviews: {
      title: 'ข้อมูลสรุปรีวิวและการให้คะแนนของฉัน',
      empty: 'ยังไม่มีรีวิวหรือคะแนนจากบัญชีนี้',
      sortable: true,
      rows: stats.memberReviewList.map((review) => ({
        title: review.Booking_Date || review.bookingDate ? `วันที่ใช้บริการ ${review.Booking_Date || review.bookingDate}` : 'รีวิวการใช้บริการ',
        meta: review.Comment || review.comment || 'ไม่มีความคิดเห็นเพิ่มเติม',
        value: `${Number(review.Rating || review.rating || 0).toFixed(1)} คะแนน`,
        tone: 'amber',
        createdAt: getReviewDate(review),
        details: [
          review.Review_Status === 'voided_payment' || review.reviewStatus === 'voided_payment'
            ? 'รายการนี้ถูกยกเลิกบิลและไม่นับรวมกับคะแนนร้าน'
            : 'นับรวมตามสถานะรีวิวปัจจุบัน'
        ]
      }))
    },
    memberPendingReviews: {
      title: 'รายการที่ยังไม่ได้ให้คะแนนและรีวิว',
      empty: 'ไม่มีรายการที่รอให้คะแนนและรีวิว',
      sortable: true,
      allowUpcomingSort: true,
      rows: stats.memberPendingReviewList.map((booking) => ({
        title: getBookingCustomer(booking),
        meta: `${booking.bookingDate || '-'} | เลน ${getBookingLane(booking)} | ${getBookingTime(booking)}`,
        value: 'ยังไม่ได้รีวิว',
        tone: 'amber',
        createdAt: getBookingCreatedDate(booking),
        startAt: getBookingStartDate(booking),
        details: getBookingDetails(booking)
      }))
    }
  };

  if (!selected) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <div className="text-sm font-black text-slate-700">เลือกบล็อกด้านบนเพื่อดูข้อมูลสรุป</div>
        <div className="mt-1 text-xs font-bold text-slate-400">ข้อมูลจะแสดงเฉพาะหัวข้อที่กดเลือก</div>
      </section>
    );
  }

  const summary = summaries[selected];
  const sortOptions = [
    { value: 'newest', label: 'เรียงจากใหม่ไปเก่า' },
    { value: 'oldest', label: 'เรียงจากเก่าไปใหม่' },
    ...(summary?.allowUpcomingSort ? [{ value: 'upcoming', label: 'เวลาที่ใกล้มาถึง' }] : [])
  ];
  const rows = [...(summary?.rows || [])].sort((a, b) => {
    if (sortMode === 'oldest') {
      return getTimeValue(a.createdAt || a.startAt) - getTimeValue(b.createdAt || b.startAt);
    }
    if (sortMode === 'upcoming' && summary?.allowUpcomingSort) {
      return getTimeValue(a.startAt || a.createdAt) - getTimeValue(b.startAt || b.createdAt);
    }
    return getTimeValue(b.createdAt || b.startAt) - getTimeValue(a.createdAt || a.startAt);
  });

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="mt-1 text-base font-black text-slate-800">{summary?.title}</h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {summary?.sortable && (
            <select
              value={summary.allowUpcomingSort || sortMode !== 'upcoming' ? sortMode : 'newest'}
              onChange={(e) => onSortModeChange?.(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 shadow-sm outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2 text-xs font-black text-slate-500">
            {rows.length} รายการ
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
          {summary?.empty}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 8).map((row, index) => (
            <SummaryRow
              key={`${selected}-${index}`}
              {...row}
              details={selected === 'memberPoints'
                ? []
                : selected === 'memberReviews'
                  ? []
                  : row.details}
            />
          ))}
          {rows.length > 8 && (
            <div className="pt-2 text-center text-xs font-bold text-slate-400">
              แสดง 8 รายการล่าสุดจากทั้งหมด {rows.length} รายการ
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function OwnerRevenueOverview({
  report,
  range = 'year',
  month,
  year,
  customStart,
  customEnd,
  onRangeChange,
  onMonthChange,
  onYearChange,
  onCustomStartChange,
  onCustomEndChange
}) {
  if (!report) return null;

  const rangeLabel = range === 'today'
      ? 'วันนี้'
      : range === '7days'
        ? 'ย้อนหลัง 7 วัน'
        : range === 'custom'
          ? customStart && customEnd ? `${customStart} ถึง ${customEnd}` : 'กำหนดช่วงเวลาเอง'
        : range === 'month'
        ? `รายเดือน ${MONTH_LABELS_TH[month]} ${year + 543}`
        : `รายปี ${year + 543}`;
  const averageLabel = range === 'year' ? 'เฉลี่ยต่อเดือน' : 'เฉลี่ยต่อวัน';
  const averageDivisor = range === 'year' ? 12 : range === '7days' ? 7 : 1;
  const isCustomSingleDay = range === 'custom' && report.dayCount === 1;
  const isDailyBars = range === '7days' || (range === 'custom' && report.dayCount > 1 && report.dayCount <= 7);
  const isDonut = range === 'today' || range === 'month' || range === 'custom' || isCustomSingleDay;
  const showRangeTotal = range === 'custom';
  const showAverage = range === 'custom' || range === '7days' || range === 'year';
  const showBestMonth = range === 'year';
  const visibleReportCards = 2 + Number(showRangeTotal) + Number(showAverage) + Number(showBestMonth);
  const reportGridColumns = visibleReportCards === 5
    ? 'xl:grid-cols-5'
    : visibleReportCards === 4
      ? 'xl:grid-cols-4'
      : visibleReportCards === 3
        ? 'xl:grid-cols-3'
        : 'xl:grid-cols-2';
  const donutTotal = report.cashTotal + report.transferTotal;
  const cashPercent = donutTotal ? (report.cashTotal / donutTotal) * 100 : 0;
  const chartData = range === 'year' ? report.monthly : isDailyBars ? report.daily : report.weekly;
  const maxChartTotal = Math.max(...chartData.map((item) => Math.max(item.cash, item.transfer)), 1);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">OWNER REVENUE</div>
          <h3 className="mt-1 text-lg font-black text-slate-900">กราฟรายได้{rangeLabel}</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">สรุปรายได้จากรายการชำระเงินที่ปิดยอดแล้ว และไม่รวมรายการที่ถูกยกเลิกบิล</p>
        </div>
        <div className="flex flex-col items-end gap-3 lg:ml-auto">
          <div className="flex flex-wrap justify-end gap-2">
            <select
              value={range}
              onChange={(event) => onRangeChange?.(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
              aria-label="ช่วงเวลารายงานรายได้"
            >
              <option value="today">วันนี้</option>
              <option value="7days">ย้อนหลัง 7 วัน</option>
              <option value="month">รายเดือน</option>
              <option value="year">รายปี</option>
              <option value="custom">กำหนดช่วงเวลาเอง</option>
            </select>
            {range === 'custom' && (
              <>
                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-500">
                  ตั้งแต่
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd}
                    onChange={(event) => onCustomStartChange?.(event.target.value)}
                    className="min-w-0 bg-transparent text-xs font-black text-slate-700 outline-none"
                    aria-label="วันที่เริ่มต้นรายงาน"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-500">
                  ถึง
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    onChange={(event) => onCustomEndChange?.(event.target.value)}
                    className="min-w-0 bg-transparent text-xs font-black text-slate-700 outline-none"
                    aria-label="วันที่สิ้นสุดรายงาน"
                  />
                </label>
              </>
            )}
            {(range === 'month' || range === 'year') && (
              <div className="flex flex-wrap justify-end gap-2">
              {range === 'month' && (
                <select
                  value={month}
                  onChange={(event) => onMonthChange?.(Number(event.target.value))}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  aria-label="เลือกเดือนรายงาน"
                >
                  {MONTH_LABELS_TH.map((label, index) => (
                    <option key={label} value={index}>{label}</option>
                  ))}
                </select>
              )}
              <select
                value={year}
                onChange={(event) => onYearChange?.(Number(event.target.value))}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                aria-label="เลือกปีรายงาน"
              >
                {Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index).map((optionYear) => (
                  <option key={optionYear} value={optionYear}>{optionYear + 543}</option>
                ))}
              </select>
            </div>
            )}
          </div>
          <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${reportGridColumns}`}>
          {showRangeTotal && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div className="text-[10px] font-black text-emerald-700">รายได้รวมช่วงที่เลือก</div>
            <div className="mt-1 text-lg font-black text-emerald-900">{report.yearTotal.toLocaleString()} บาท</div>
           </div>
          )}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="text-[10px] font-black text-blue-700">เงินสด</div>
            <div className="mt-1 text-lg font-black text-blue-900">{report.cashTotal.toLocaleString()} บาท</div>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
            <div className="text-[10px] font-black text-violet-700">เงินโอน</div>
            <div className="mt-1 text-lg font-black text-violet-900">{report.transferTotal.toLocaleString()} บาท</div>
           </div>
          {showAverage && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-black text-slate-500">{averageLabel}</div>
            <div className="mt-1 text-lg font-black text-slate-800">{Math.round(report.yearTotal / averageDivisor).toLocaleString()} บาท</div>
           </div>
          )}
          {showBestMonth && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div className="text-[10px] font-black text-amber-700">เดือนสูงสุด</div>
            <div className="mt-1 text-lg font-black text-amber-900">{report.bestMonth.label} {report.bestMonth.total.toLocaleString()} บาท</div>
           </div>
          )}
          </div>
        </div>
      </div>

      {isDonut ? (
        <div className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-slate-100 bg-slate-50 px-5 py-8 sm:flex-row sm:gap-10">
          <div
            className="relative flex h-48 w-48 shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(#60a5fa 0 ${cashPercent}%, #a78bfa ${cashPercent}% 100%)` }}
          >
            <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
              <span className="text-[11px] font-black text-slate-400">ยอดรวม</span>
              <span className="mt-1 text-xl font-black text-slate-900">{report.yearTotal.toLocaleString()}</span>
              <span className="text-[11px] font-bold text-slate-400">บาท</span>
            </div>
          </div>
          <div className="grid w-full max-w-sm gap-3">
            <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-black text-blue-800"><span className="h-3 w-3 rounded-full bg-blue-400" />เงินสด</span>
              <span className="text-sm font-black text-blue-900">{report.cashTotal.toLocaleString()} บาท</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-black text-violet-800"><span className="h-3 w-3 rounded-full bg-violet-400" />เงินโอน</span>
              <span className="text-sm font-black text-violet-900">{report.transferTotal.toLocaleString()} บาท</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={`grid items-end gap-2 overflow-x-auto rounded-3xl border border-slate-100 bg-slate-50 px-3 pb-4 pt-6 sm:gap-3 sm:px-5 ${range === 'year' ? 'grid-cols-12' : 'grid-cols-7'}`}>
          {chartData.map((item) => (
            <div key={item.key || item.label} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <div
                  className="w-full max-w-4 rounded-t-lg border border-blue-200 bg-blue-400/80 transition-all"
                  style={{ height: `${Math.max(item.cash ? 8 : 0, Math.round((item.cash / maxChartTotal) * 150))}px` }}
                  title={`${item.label} เงินสด: ${item.cash.toLocaleString()} บาท`}
                />
                <div
                  className="w-full max-w-4 rounded-t-lg border border-violet-200 bg-violet-400/80 transition-all"
                  style={{ height: `${Math.max(item.transfer ? 8 : 0, Math.round((item.transfer / maxChartTotal) * 150))}px` }}
                  title={`${item.label} เงินโอน: ${item.transfer.toLocaleString()} บาท`}
                />
              </div>
              <div className="text-center text-[10px] font-black text-slate-500">{item.label}</div>
              <div className="text-[10px] font-bold leading-tight text-slate-500">{item.total ? item.total.toLocaleString() : '-'}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardHome({ role = 'customer', user, userData, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [selectedSummary, setSelectedSummary] = useState('');
  const [summarySortMode, setSummarySortMode] = useState('newest');
  const [reportRange, setReportRange] = useState('year');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [customReportStart, setCustomReportStart] = useState(todayKey());
  const [customReportEnd, setCustomReportEnd] = useState(todayKey());
  const [stats, setStats] = useState({
    bookingsToday: 0,
    activeLanes: 0,
    pendingBookings: 0,
    revenueToday: 0,
    cashRevenueToday: 0,
    transferRevenueToday: 0,
    shopRating: 0,
    reviewCount: 0,
    bookingsTodayList: [],
    activeLaneList: [],
    pendingBookingList: [],
    paymentsTodayList: [],
    reviewsList: [],
    memberBookingList: [],
    memberReviewList: [],
    memberPendingReviewList: [],
    totalBookings: 0,
    pointsBalance: 0,
    upcomingBookings: 0,
    completedBookings: 0,
    latestBooking: null,
    revenueReport: buildRevenueReport([]),
    revenuePayments: []
  });

  const displayName = userData?.FullName || userData?.fullName || user?.displayName || 'ผู้ใช้งาน';
  const isOwner = role === 'owner';
  const isStaff = role === 'staff';
  const isCustomer = role === 'customer';

  useEffect(() => {
    if (selectedSummary === 'revenueToday' && summarySortMode === 'upcoming') {
      setSummarySortMode('newest');
    }
  }, [selectedSummary, summarySortMode]);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        if (isCustomer && user?.uid) {
          const [bookings, reviewSnap] = await Promise.all([
            fetchCustomerBookings(user, userData),
            getDocs(query(collection(db, 'reviews'), where('User_ID', '==', user.uid))).catch(() => ({ docs: [] }))
          ]);
          const memberReviews = reviewSnap.docs.map((reviewDoc) => ({ id: reviewDoc.id, ...reviewDoc.data() }));
          const reviewedBookingIds = new Set(memberReviews.map(getReviewBookingId).filter(Boolean));
          const pendingReviewBookings = bookings.filter((booking) => (
            booking.status === 'completed' && !reviewedBookingIds.has(booking.id)
          ));
          const pointsBalance = Number(userData?.Points_Balance ?? userData?.points_balance ?? 0);
          const now = new Date();
          const upcoming = bookings.filter((booking) => {
            const bookingDate = booking.bookingDate ? new Date(`${booking.bookingDate}T00:00:00`) : toDate(booking.createdAt);
            return ['pending', 'confirmed', 'occupied'].includes(booking.status) && (!bookingDate || bookingDate >= new Date(now.toDateString()));
          });
          const latest = [...bookings].sort((a, b) => {
            const aDate = toDate(a.createdAt)?.getTime() || 0;
            const bDate = toDate(b.createdAt)?.getTime() || 0;
            return bDate - aDate;
          })[0] || null;

          setStats({
            bookingsToday: bookings.filter((booking) => booking.bookingDate === todayKey()).length,
            activeLanes: bookings.filter((booking) => booking.status === 'occupied').length,
            pendingBookings: bookings.filter((booking) => booking.status === 'pending').length,
            revenueToday: 0,
            cashRevenueToday: 0,
            transferRevenueToday: 0,
            shopRating: 0,
            reviewCount: pendingReviewBookings.length,
            bookingsTodayList: bookings.filter((booking) => booking.bookingDate === todayKey()),
            activeLaneList: bookings.filter((booking) => booking.status === 'occupied'),
            pendingBookingList: bookings.filter((booking) => booking.status === 'pending'),
            paymentsTodayList: [],
            reviewsList: [],
            memberBookingList: bookings,
            memberReviewList: memberReviews,
            memberPendingReviewList: pendingReviewBookings,
            totalBookings: bookings.length,
            pointsBalance,
            upcomingBookings: upcoming.length,
            completedBookings: bookings.filter((booking) => booking.status === 'completed').length,
            latestBooking: latest,
            revenueReport: buildRevenueReport([]),
            revenuePayments: []
          });
          return;
        }

        const [bookingSnap, paymentSnap, reviewSnap] = await Promise.all([
          getDocs(collection(db, 'bookings')),
          getDocs(collection(db, 'payments')),
          (isOwner || isStaff) ? getDocs(collection(db, 'reviews')) : Promise.resolve({ docs: [] })
        ]);

        const bookings = bookingSnap.docs.map((bookingDoc) => ({ id: bookingDoc.id, ...bookingDoc.data() }));
        const payments = paymentSnap.docs.map((paymentDoc) => ({ id: paymentDoc.id, ...paymentDoc.data() }));
        const reviews = reviewSnap.docs.map((reviewDoc) => ({ id: reviewDoc.id, ...reviewDoc.data() }));
        const ratingValues = reviews
          .map((review) => Number(review.Rating || review.rating || 0))
          .filter((rating) => rating > 0);
        const ratingAverage = ratingValues.length
          ? ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length
          : 0;
        const today = todayKey();
        const bookingsTodayList = bookings.filter((booking) => booking.bookingDate === today);
        const activeLaneList = bookings.filter((booking) => booking.status === 'occupied');
        const pendingBookingList = bookings.filter((booking) => booking.status === 'pending');
        const paymentsTodayList = payments.filter((payment) => {
          const paymentDate = toDate(payment.Payment_Date || payment.createdAt);
          return payment.status !== 'cancelled' && paymentDate && paymentDate.toISOString().split('T')[0] === today;
        });

        const todayBreakdown = paymentsTodayList.reduce((summary, payment) => {
          const breakdown = getPaymentBreakdown(payment);
          return {
            cash: summary.cash + breakdown.cash,
            transfer: summary.transfer + breakdown.transfer,
            total: summary.total + breakdown.total
          };
        }, { cash: 0, transfer: 0, total: 0 });

        setStats({
          bookingsToday: bookingsTodayList.length,
          activeLanes: activeLaneList.length,
          pendingBookings: pendingBookingList.length,
          revenueToday: todayBreakdown.total,
          cashRevenueToday: todayBreakdown.cash,
          transferRevenueToday: todayBreakdown.transfer,
          shopRating: ratingAverage,
          reviewCount: ratingValues.length,
          bookingsTodayList,
          activeLaneList,
          pendingBookingList,
          paymentsTodayList,
          reviewsList: reviews,
          memberBookingList: [],
          memberReviewList: [],
          memberPendingReviewList: [],
          totalBookings: bookings.length,
          pointsBalance: 0,
          upcomingBookings: 0,
          completedBookings: bookings.filter((booking) => booking.status === 'completed').length,
          latestBooking: null,
          revenueReport: buildRevenueReport(payments),
          revenuePayments: payments
        });
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [isCustomer, isOwner, isStaff, user, userData]);

  const roleLabel = isOwner ? 'OWNER DASHBOARD' : isStaff ? 'STAFF DASHBOARD' : 'MEMBER DASHBOARD';
  const welcomeText = isOwner
    ? 'ภาพรวมการบริหารร้านและรายการสำคัญของวันนี้'
    : isStaff
      ? 'ภาพรวมการทำงานหน้าร้านและเลนที่ต้องดูแลวันนี้'
      : 'ภาพรวมบัญชีสมาชิก การจอง และแต้มสะสมของคุณ';

  const actions = isOwner
    ? [
        ['จัดการเลนซ้อม', 'ดูตารางเลน เปิดใช้งาน และจัดการสถานะเลน', 'lane', 'lanes'],
        ['คิดเงินและรายได้', 'ตรวจสอบรายการชำระเงินและปิดยอด', 'payment', 'payment'],
        ['ประวัติการจอง', 'ค้นหาและตรวจสอบประวัติการจองทั้งหมด', 'history', 'bookingHistory'],
        ['ตั้งค่าระบบ', 'ตั้งค่าราคา เวลา และนโยบายของร้าน', 'code', 'settings']
      ]
    : isStaff
      ? [
          ['ตารางการใช้เลนซ้อม', 'ดูสถานะเลนและเปิดใช้งานให้ลูกค้า', 'lane', 'lanes'],
          ['คิดเงินและรายได้', 'เรียกชำระเงินและตรวจสอบรายการ', 'payment', 'payment'],
          ['ตรวจสอบรีวิว', 'ดูคะแนนและความคิดเห็นจากลูกค้า', 'star', 'reviews']
        ]
      : [
          ['จองสนามออนไลน์', 'เลือกวัน เวลา และเลนซ้อมที่ต้องการ', 'booking', 'booking'],
          ['ประวัติการจอง', 'ดู แก้ไข ยกเลิก หรือรับใบเสร็จ', 'history', 'history'],
          ['ให้คะแนนและรีวิว', 'รีวิวบริการที่ใช้งานเสร็จสิ้นแล้ว', 'star', 'writereview'],
          ['ข้อมูลโปรไฟล์', 'แก้ไขข้อมูลส่วนตัวและรหัสผ่าน', 'user', 'profile']
        ];

  const managementCards = [
    {
      key: 'bookingsToday',
      label: 'การจองวันนี้',
      value: stats.bookingsToday,
      hint: 'กดเพื่อดูรายการ',
      tone: 'emerald',
      icon: 'booking'
    },
    {
      key: 'pendingBookings',
      label: 'รายการรอเช็กอิน',
      value: stats.pendingBookings,
      hint: 'กดเพื่อดูรายการ',
      tone: 'blue',
      icon: 'history'
    },
    {
      key: 'activeLanes',
      label: 'เลนที่กำลังใช้งาน',
      value: stats.activeLanes,
      hint: 'กดเพื่อดูเลน',
      tone: 'amber',
      icon: 'lane'
    },
    {
      key: 'revenueToday',
      label: 'ยอดรับชำระวันนี้',
      value: `${stats.revenueToday.toLocaleString()} บาท`,
      hint: `สด ${stats.cashRevenueToday.toLocaleString()} | โอน ${stats.transferRevenueToday.toLocaleString()} บาท`,
      tone: 'slate',
      icon: 'payment'
    },
    {
      key: 'shopRating',
      label: 'คะแนนของร้าน',
      value: stats.reviewCount ? stats.shopRating.toFixed(1) : '-',
      hint: stats.reviewCount ? `จาก ${stats.reviewCount} รีวิว` : 'ยังไม่มีรีวิว',
      tone: 'amber',
      icon: 'star'
    }
  ];

  const memberCards = [
    {
      key: 'memberPoints',
      label: 'แต้มสะสม',
      value: formatPoints(stats.pointsBalance),
      hint: 'กดเพื่อดูข้อมูลแต้มสะสม',
      tone: 'amber',
      icon: 'star'
    },
    {
      key: 'memberBookings',
      label: 'รายการจองทั้งหมด',
      value: stats.totalBookings,
      hint: 'กดเพื่อดูประวัติการจอง',
      tone: 'emerald',
      icon: 'booking'
    },
    {
      key: 'pendingBookings',
      label: 'รายการรอเช็กอิน',
      value: stats.pendingBookings,
      hint: 'รายการที่รอเจ้าหน้าที่ดูแล',
      tone: 'blue',
      icon: 'history'
    },
    {
      key: 'memberReviews',
      label: 'รีวิวและการให้คะแนน',
      value: stats.memberReviewList.length,
      hint: 'กดเพื่อดูคะแนนที่เคยให้',
      tone: 'slate',
      icon: 'star'
    }
  ];

  return (
    <div className="w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left shadow-sm animate-fadeIn sm:p-8">
      <div className="space-y-6">
      <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">{roleLabel}</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-slate-900 sm:text-3xl">
              สวัสดี, {displayName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-slate-500">{welcomeText}</p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-slate-50 px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Today</div>
            <div className="mt-1 text-lg font-black text-slate-800">
              {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-black text-slate-400">
          กำลังโหลดข้อมูล Dashboard...
        </div>
      ) : (
        <>
          <section className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isOwner || isStaff ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
            {isCustomer ? (false ? (
              <>
                <StatCard label="แต้มสะสม" value={formatPoints(userData?.Points_Balance ?? userData?.points_balance ?? 0)} hint="คะแนนที่ใช้แลกส่วนลดได้" tone="amber" icon="star" />
                <StatCard label="การจองที่กำลังมาถึง" value={stats.upcomingBookings} hint="รายการที่ยังใช้งานได้" tone="emerald" icon="booking" />
                <StatCard label="รายการรอเช็กอิน" value={stats.pendingBookings} hint="รายการจองที่ยังไม่มาเช็กอิน" tone="blue" icon="history" />
                <StatCard label="ใช้บริการเสร็จสิ้น" value={stats.completedBookings} hint="ประวัติการใช้บริการทั้งหมด" tone="slate" icon="payment" />
              </>
            ) : (
              memberCards.map((card) => (
                <StatCard
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  hint={card.hint}
                  tone={card.tone}
                  icon={card.icon}
                  active={selectedSummary === card.key}
                  onClick={() => setSelectedSummary(card.key)}
                />
              ))
            )
            ) : (
              managementCards.map((card) => (
                <StatCard
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  hint={card.hint}
                  tone={card.tone}
                  icon={card.icon}
                  active={selectedSummary === card.key}
                  onClick={() => setSelectedSummary(card.key)}
                />
              ))
            )}
          </section>

          {isOwner || isStaff ? (
            <>
              <DashboardSummaryPanel
                selected={selectedSummary}
                stats={stats}
                sortMode={summarySortMode}
                onSortModeChange={setSummarySortMode}
              />
              {isOwner && (
                <OwnerRevenueOverview
                  report={buildFilteredRevenueReport(
                    stats.revenuePayments,
                    reportRange,
                    reportMonth,
                    reportYear,
                    customReportStart,
                    customReportEnd
                  )}
                  range={reportRange}
                  month={reportMonth}
                  year={reportYear}
                  customStart={customReportStart}
                  customEnd={customReportEnd}
                  onRangeChange={setReportRange}
                  onMonthChange={setReportMonth}
                  onYearChange={setReportYear}
                  onCustomStartChange={setCustomReportStart}
                  onCustomEndChange={setCustomReportEnd}
                />
              )}
            </>
          ) : (
            <>
            <DashboardSummaryPanel
              selected={selectedSummary}
              stats={stats}
              sortMode={summarySortMode}
              onSortModeChange={setSummarySortMode}
            />
            <section className="hidden">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-slate-800">เมนูลัดสำหรับวันนี้</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {actions.map(([label, description, icon, tab]) => (
                  <QuickAction
                    key={tab}
                    label={label}
                    description={description}
                    icon={icon}
                    onClick={() => onNavigate?.(tab)}
                  />
                ))}
              </div>
            </section>
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}

export default DashboardHome;
