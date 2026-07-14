import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { NavIcon } from './DashboardNav';

const todayKey = () => new Date().toISOString().split('T')[0];

const toDate = (value) => {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPaymentAmount = (payment) => Number(payment.Net_Amount || payment.netAmount || payment.Total_Amount || 0);

const MONTH_LABELS_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const buildRevenueReport = (payments = [], year = new Date().getFullYear()) => {
  const monthly = MONTH_LABELS_TH.map((label, index) => ({
    label,
    month: index,
    total: 0,
    count: 0
  }));

  payments.forEach((payment) => {
    const paymentDate = getPaymentDate(payment);
    if (!paymentDate || paymentDate.getFullYear() !== year || payment.status === 'cancelled') return;

    const monthIndex = paymentDate.getMonth();
    monthly[monthIndex].total += getPaymentAmount(payment);
    monthly[monthIndex].count += 1;
  });

  const yearTotal = monthly.reduce((sum, month) => sum + month.total, 0);
  const bestMonth = monthly.reduce((best, month) => (
    month.total > best.total ? month : best
  ), monthly[0]);

  return {
    year,
    monthly,
    yearTotal,
    bestMonth,
    averageMonthly: yearTotal / 12
  };
};

const formatPoints = (value) => Number(value || 0).toLocaleString(undefined, {
  maximumFractionDigits: 2
});

const getTimeValue = (date) => date?.getTime?.() || 0;

const getBookingCreatedDate = (booking) => (
  toDate(booking.createdAt || booking.Created_At || booking.Booking_Created_At || booking.updatedAt)
);

const getPaymentDate = (payment) => (
  toDate(payment.Payment_Date || payment.createdAt || payment.Created_At || payment.updatedAt)
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
        {meta && <div className="mt-1 text-xs font-bold text-slate-400 break-words">{meta}</div>}
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
      title: 'ข้อมูลสรุปรายการรอตรวจสอบ',
      empty: 'ไม่มีรายการที่รอตรวจสอบ',
      sortable: true,
      allowUpcomingSort: true,
      rows: stats.pendingBookingList.map((booking) => ({
        title: getBookingCustomer(booking),
        meta: `${booking.bookingDate || '-'} | ${getBookingLane(booking)} | ${getBookingTime(booking)}`,
        value: 'รอตรวจสอบ',
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
        tone: 'amber'
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
            <SummaryRow key={`${selected}-${index}`} {...row} />
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

function OwnerRevenueOverview({ report }) {
  if (!report) return null;

  const maxTotal = Math.max(...report.monthly.map((month) => month.total), 1);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">OWNER REVENUE</div>
          <h3 className="mt-1 text-lg font-black text-slate-900">กราฟรายได้ประจำปี {report.year + 543}</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">สรุปรายได้จากรายการชำระเงินที่ปิดยอดแล้ว และไม่รวมรายการที่ถูกยกเลิกบิล</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div className="text-[10px] font-black text-emerald-700">รายได้ทั้งปี</div>
            <div className="mt-1 text-lg font-black text-emerald-900">{report.yearTotal.toLocaleString()} บาท</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-black text-slate-500">เฉลี่ยต่อเดือน</div>
            <div className="mt-1 text-lg font-black text-slate-800">{Math.round(report.averageMonthly).toLocaleString()} บาท</div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div className="text-[10px] font-black text-amber-700">เดือนสูงสุด</div>
            <div className="mt-1 text-lg font-black text-amber-900">{report.bestMonth.label} {report.bestMonth.total.toLocaleString()} บาท</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 items-end gap-2 rounded-3xl border border-slate-100 bg-slate-50 px-3 pb-4 pt-6 sm:gap-3 sm:px-5">
        {report.monthly.map((month) => {
          const height = Math.max(8, Math.round((month.total / maxTotal) * 150));
          return (
            <div key={month.label} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end justify-center">
                <div
                  className="w-full max-w-8 rounded-t-xl border border-emerald-200 bg-emerald-500/70 transition-all"
                  style={{ height: `${height}px` }}
                  title={`${month.label}: ${month.total.toLocaleString()} บาท`}
                />
              </div>
              <div className="text-[10px] font-black text-slate-500">{month.label}</div>
              <div className="hidden text-[10px] font-bold text-slate-400 sm:block">{month.total ? `${Math.round(month.total / 1000).toLocaleString()}k` : '-'}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DashboardHome({ role = 'customer', user, userData, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [selectedSummary, setSelectedSummary] = useState('');
  const [summarySortMode, setSummarySortMode] = useState('newest');
  const [stats, setStats] = useState({
    bookingsToday: 0,
    activeLanes: 0,
    pendingBookings: 0,
    revenueToday: 0,
    shopRating: 0,
    reviewCount: 0,
    bookingsTodayList: [],
    activeLaneList: [],
    pendingBookingList: [],
    paymentsTodayList: [],
    reviewsList: [],
    upcomingBookings: 0,
    completedBookings: 0,
    latestBooking: null,
    revenueReport: buildRevenueReport([])
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
          const bookings = await fetchCustomerBookings(user, userData);
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
            shopRating: 0,
            reviewCount: 0,
            bookingsTodayList: [],
            activeLaneList: [],
            pendingBookingList: [],
            paymentsTodayList: [],
            reviewsList: [],
            upcomingBookings: upcoming.length,
            completedBookings: bookings.filter((booking) => booking.status === 'completed').length,
            latestBooking: latest,
            revenueReport: buildRevenueReport([])
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

        setStats({
          bookingsToday: bookingsTodayList.length,
          activeLanes: activeLaneList.length,
          pendingBookings: pendingBookingList.length,
          revenueToday: paymentsTodayList.reduce((sum, payment) => sum + getPaymentAmount(payment), 0),
          shopRating: ratingAverage,
          reviewCount: ratingValues.length,
          bookingsTodayList,
          activeLaneList,
          pendingBookingList,
          paymentsTodayList,
          reviewsList: reviews,
          upcomingBookings: 0,
          completedBookings: bookings.filter((booking) => booking.status === 'completed').length,
          latestBooking: null,
          revenueReport: buildRevenueReport(payments)
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
      label: 'รอตรวจสอบ',
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
      hint: 'กดเพื่อดูยอด',
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
            {isCustomer ? (
              <>
                <StatCard label="แต้มสะสม" value={formatPoints(userData?.Points_Balance ?? userData?.points_balance ?? 0)} hint="คะแนนที่ใช้แลกส่วนลดได้" tone="amber" icon="star" />
                <StatCard label="การจองที่กำลังมาถึง" value={stats.upcomingBookings} hint="รายการที่ยังใช้งานได้" tone="emerald" icon="booking" />
                <StatCard label="รอตรวจสอบ" value={stats.pendingBookings} hint="รายการที่รอเจ้าหน้าที่ดูแล" tone="blue" icon="history" />
                <StatCard label="ใช้บริการเสร็จสิ้น" value={stats.completedBookings} hint="ประวัติการใช้บริการทั้งหมด" tone="slate" icon="payment" />
              </>
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
              {isOwner && <OwnerRevenueOverview report={stats.revenueReport} />}
            </>
          ) : (
            <section>
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
          )}
        </>
      )}
      </div>
    </div>
  );
}

export default DashboardHome;
