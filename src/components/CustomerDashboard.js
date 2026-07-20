import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, onSnapshot, serverTimestamp, doc, updateDoc, setDoc } from 'firebase/firestore';
import BookingFlow from './BookingFlow'; 
import { NavIcon, ResponsiveNavButton } from './DashboardNav';
import { StarIcon } from './AppIcons';
import IntegerStepperInput from './IntegerStepperInput';
import QuantityAdjuster from './QuantityAdjuster';
import ClubRentalTotal from './ClubRentalTotal';
import AccountProfileCard from './AccountProfileCard';
import DashboardHome from './DashboardHome';
import {
  getClubName,
  getClubRepairQty,
  getClubTotalQty,
  getClubType,
  sortGolfClubsLikeInventory
} from '../utils/golfClubUtils';
import { findUserByPhoneNumber, getDuplicatePhoneMessage, normalizePhoneNumber } from '../utils/userPhoneUtils';
import { toWholeNumber } from '../utils/numberUtils';
import useClubRentalRate from '../utils/useClubRentalRate';
import {
  getPaymentItemQuantity,
  getPaymentItemTotal,
  getPaymentItemUnit,
  getPaymentItemUnitPrice
} from '../utils/paymentItemUtils';

function CustomerDashboard({ user, userData, handleLogout, onPasswordResetEmailSent }) {
  const { clubRentalRate, clubRentalRateLoading } = useClubRentalRate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profileForm, setProfileForm] = useState({ FullName: '', PhoneNumber: '' });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [paymentsByBookingId, setPaymentsByBookingId] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editBookingForm, setEditBookingForm] = useState({
    customerName: '',
    customerPhone: '',
    guestCount: 1,
    needsInstructor: false,
    needsClubRent: false
  });
  const [editClubInventory, setEditClubInventory] = useState([]);
  const [editSelectedClubs, setEditSelectedClubs] = useState([]);
  const [editClubsLoading, setEditClubsLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [receiptBooking, setReceiptBooking] = useState(null);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [receiptPaymentLoading, setReceiptPaymentLoading] = useState(false);
  const [bookingModifyLimitHours, setBookingModifyLimitHours] = useState(2);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewableBookings, setReviewableBookings] = useState([]);
  const [reviewMap, setReviewMap] = useState({});
  const [reviewPaymentMap, setReviewPaymentMap] = useState({});
  const [selectedReviewBooking, setSelectedReviewBooking] = useState(null);
  const [loadingReviewableBookings, setLoadingReviewableBookings] = useState(false);
  const [shopReviews, setShopReviews] = useState([]);
  const [loadingShopReviews, setLoadingShopReviews] = useState(false);
  const [reviewViewMode, setReviewViewMode] = useState('shop');
  const [paymentReviewPrompt, setPaymentReviewPrompt] = useState(null);

  const getDismissedPaymentReviewPrompts = () => {
    if (!user?.uid) return [];
    try {
      return JSON.parse(localStorage.getItem(`mlg_dismissed_payment_reviews_${user.uid}`) || '[]');
    } catch (error) {
      return [];
    }
  };

  const markPaymentReviewPromptDismissed = (paymentId) => {
    if (!user?.uid || !paymentId) return;
    const dismissed = new Set(getDismissedPaymentReviewPrompts());
    dismissed.add(paymentId);
    localStorage.setItem(`mlg_dismissed_payment_reviews_${user.uid}`, JSON.stringify([...dismissed]));
  };

  const formatPoints = (value) => toWholeNumber(value).toLocaleString();

  const getMemberEmailVariants = () => {
    const emails = [
      user?.email,
      userData?.Email,
      userData?.email
    ]
      .filter(Boolean)
      .map((email) => String(email).trim())
      .filter(Boolean);

    return [...new Set(emails.flatMap((email) => [email, email.toLowerCase()]))];
  };

  const getBookingSortTime = (booking) => {
    const dateValue = booking.createdAt || booking.Created_At || booking.bookingDate || booking.Booking_Date;
    if (dateValue?.toDate) return dateValue.toDate().getTime();
    const parsed = new Date(dateValue || 0).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getPaymentSortTime = (payment) => {
    const dateValue = payment?.Payment_Date || payment?.createdAt || payment?.Updated_At;
    const parsed = dateValue?.toDate ? dateValue.toDate().getTime() : new Date(dateValue || 0).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const fetchMemberBookings = async ({ status = null } = {}) => {
    if (!user?.uid) return [];

    const bookingQueries = [
      query(collection(db, 'bookings'), where('User_ID', '==', user.uid)),
      query(collection(db, 'bookings'), where('userId', '==', user.uid)),
      query(collection(db, 'bookings'), where('uid', '==', user.uid))
    ];

    getMemberEmailVariants().forEach((email) => {
      ['customerEmail', 'Email', 'email', 'Customer_Email', 'memberEmail'].forEach((fieldName) => {
        bookingQueries.push(query(collection(db, 'bookings'), where(fieldName, '==', email)));
      });
    });

    const snapshots = await Promise.all(
      bookingQueries.map((bookingQuery) => getDocs(bookingQuery).catch((error) => {
        console.error('Error fetching member booking query:', error);
        return { docs: [] };
      }))
    );

    const bookingsById = new Map();
    snapshots.forEach((snapshot) => {
      snapshot.docs.forEach((bookingDoc) => {
        const booking = { id: bookingDoc.id, ...bookingDoc.data() };
        if (status && booking.status !== status) return;
        bookingsById.set(booking.id, booking);
      });
    });

    return [...bookingsById.values()].sort((a, b) => getBookingSortTime(b) - getBookingSortTime(a));
  };

  useEffect(() => {
    if (userData) {
      setProfileForm({
        FullName: userData.FullName || userData.fullName || '',
        PhoneNumber: userData.PhoneNumber || userData.phone || ''
      });
    }
  }, [userData]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.FullName.trim()) {
      window.appAlert('กรุณากรอกชื่อ-นามสกุลจริง');
      return;
    }
    const normalizedPhone = normalizePhoneNumber(profileForm.PhoneNumber);
    if (normalizedPhone.length !== 10) {
      window.appAlert('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก');
      return;
    }

    setUpdatingProfile(true);
    try {
      const duplicatePhoneUser = await findUserByPhoneNumber(db, normalizedPhone, user.uid);
      if (duplicatePhoneUser) {
        window.appAlert(getDuplicatePhoneMessage(normalizedPhone));
        return;
      }

      await setDoc(doc(db, 'users', user.uid), {
        User_ID: user.uid,
        Email: user.email || userData?.Email || userData?.email || '',
        FullName: profileForm.FullName.trim(),
        PhoneNumber: normalizedPhone,
        Role: userData?.Role || userData?.role || 'customer',
        Is_Active: userData?.Is_Active ?? userData?.isActive ?? true,
        Updated_At: new Date()
      }, { merge: true });
      window.appAlert('บันทึกการแก้ไขข้อมูลส่วนตัวสำเร็จเรียบร้อยแล้ว');
    } catch (error) {
      window.appAlert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const fetchMyBookings = async () => {
    setLoadingHistory(true);
    try {
      const bookings = await fetchMemberBookings();
      const bookingIds = new Set(bookings.map((booking) => booking.id));
      const paymentSnap = await getDocs(collection(db, 'payments'));
      const paymentMap = {};
      const manualIncomeBookings = [];

      paymentSnap.docs.forEach((paymentDoc) => {
        const payment = { id: paymentDoc.id, ...paymentDoc.data() };
        const bookingId = payment.Booking_ID || payment.bookingId;
        const isMemberManualIncome =
          payment.User_ID === user.uid &&
          !bookingIds.has(bookingId) &&
          (payment.Source_Type === 'manual_income' || String(bookingId || '').startsWith('manual_income_'));

        if (!bookingIds.has(bookingId) && !isMemberManualIncome) return;

        const current = paymentMap[bookingId];
        const paymentTime = payment.Payment_Date?.toDate
          ? payment.Payment_Date.toDate().getTime()
          : new Date(payment.Payment_Date || payment.createdAt || 0).getTime();
        const currentTime = current?.Payment_Date?.toDate
          ? current.Payment_Date.toDate().getTime()
          : new Date(current?.Payment_Date || current?.createdAt || 0).getTime();

        if (!current || paymentTime > currentTime) {
          paymentMap[bookingId] = payment;
        }

        if (isMemberManualIncome) {
          const paymentDate = payment.Payment_Date?.toDate ? payment.Payment_Date.toDate() : new Date();
          const rentedClubs = Array.isArray(payment.Rented_Clubs) ? payment.Rented_Clubs : [];
          manualIncomeBookings.push({
            id: bookingId,
            isManualIncome: true,
            bookingDate: paymentDate.toLocaleDateString('th-TH'),
            selectedLanes: [],
            laneNumber: payment.Lane_Code || 'เบ็ดเตล็ดหน้าร้าน',
            timeSlots: Array.isArray(payment.Time_Slots) ? payment.Time_Slots : [],
            needsInstructor: Boolean(payment.Needs_Instructor ?? payment.needsInstructor),
            needsClubRent: Boolean(payment.Needs_Club_Rent ?? payment.needsClubRent ?? rentedClubs.length > 0),
            rentedClubs,
            customerName: payment.FullName || userData?.FullName || user?.displayName || '-',
            customerPhone: payment.Customer_Phone || '',
            customerEmail: payment.Customer_Email || payment.Email || payment.email || user?.email || '',
            guestCount: payment.Guest_Count || 1,
            status: payment.status === 'cancelled' ? 'cancelled' : 'completed',
            createdAt: payment.Payment_Date,
            description: payment.Description || payment.description || ''
          });
        }
      });

      setMyBookings([...bookings, ...manualIncomeBookings].sort((a, b) => getBookingSortTime(b) - getBookingSortTime(a)));
      setPaymentsByBookingId(paymentMap);
    } catch (error) {
      console.error("Error fetching personal bookings:", error);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchMyBookings();
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchBookingPolicy = async () => {
      try {
        const policySnap = await getDoc(doc(db, 'system_settings', 'booking_policy'));
        if (policySnap.exists()) {
          const hours = Number(policySnap.data().Modify_Limit_Hours);
          if (Number.isFinite(hours) && hours >= 0) {
            setBookingModifyLimitHours(hours);
          }
        }
      } catch (error) {
        console.error('Error fetching booking policy:', error);
      }
    };

    fetchBookingPolicy();
  }, []);

  const fetchReviewableBookings = async () => {
    setLoadingReviewableBookings(true);
    try {
      const [bookingSnap, reviewSnap, paymentSnap] = await Promise.all([
        fetchMemberBookings({ status: 'completed' }),
        getDocs(query(collection(db, 'reviews'), where('User_ID', '==', user.uid))),
        getDocs(query(collection(db, 'payments'), where('User_ID', '==', user.uid)))
      ]);

      const latestPaymentByBookingId = {};
      paymentSnap.docs.forEach((paymentDoc) => {
        const payment = { id: paymentDoc.id, ...paymentDoc.data() };
        const bookingId = payment.Booking_ID || payment.bookingId;
        if (!bookingId) return;

        const current = latestPaymentByBookingId[bookingId];
        if (!current || getPaymentSortTime(payment) > getPaymentSortTime(current)) {
          latestPaymentByBookingId[bookingId] = payment;
        }
      });

      const completedBookings = bookingSnap
        .sort((a, b) => new Date(b.bookingDate || b.createdAt || 0) - new Date(a.bookingDate || a.createdAt || 0));

      const reviewsByBookingId = {};
      reviewSnap.docs.forEach((reviewDoc) => {
        const review = { id: reviewDoc.id, ...reviewDoc.data() };
        const bookingId = review.Booking_ID || review.bookingId;
        if (bookingId) reviewsByBookingId[bookingId] = review;
      });

      setReviewableBookings(completedBookings);
      setReviewMap(reviewsByBookingId);
      setReviewPaymentMap(latestPaymentByBookingId);

      if (!selectedReviewBooking && completedBookings.length > 0) {
        const firstBooking = completedBookings[0];
        const existingReview = reviewsByBookingId[firstBooking.id];
        setSelectedReviewBooking(firstBooking);
        setReviewRating(Number(existingReview?.rating || existingReview?.Rating || 5));
        setReviewComment(existingReview?.comment || existingReview?.Comment || '');
      }
    } catch (error) {
      console.error('Error fetching reviewable bookings:', error);
    }
    setLoadingReviewableBookings(false);
  };

  useEffect(() => {
    if (activeTab === 'writereview') {
      fetchReviewableBookings();
    }
  }, [activeTab]);

  const fetchShopReviews = async () => {
    setLoadingShopReviews(true);
    try {
      const reviewSnap = await getDocs(collection(db, 'reviews'));
      const reviewList = reviewSnap.docs
        .map((reviewDoc) => ({ id: reviewDoc.id, ...reviewDoc.data() }))
        .filter((review) => (
          review.Is_Active !== false &&
          review.isActive !== false &&
          review.Review_Status !== 'voided_payment' &&
          review.reviewStatus !== 'voided_payment'
        ))
        .sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || a.Review_Date || 0).getTime();
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || b.Review_Date || 0).getTime();
          return bDate - aDate;
        });
      setShopReviews(reviewList);
    } catch (error) {
      console.error('Error fetching shop reviews:', error);
      setShopReviews([]);
    }
    setLoadingShopReviews(false);
  };

  useEffect(() => {
    if (activeTab === 'writereview') {
      fetchShopReviews();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!user?.uid || paymentReviewPrompt) return undefined;

    let cancelled = false;
    const paymentsQuery = query(collection(db, 'payments'), where('User_ID', '==', user.uid));

    const unsubscribe = onSnapshot(paymentsQuery, async (snapshot) => {
      const dismissedPrompts = new Set(getDismissedPaymentReviewPrompts());

      const latestPaymentByBookingId = {};
      snapshot.docs.forEach((paymentDoc) => {
        const payment = { id: paymentDoc.id, ...paymentDoc.data() };
        const bookingId = payment.Booking_ID || payment.bookingId;
        if (!bookingId) return;

        const current = latestPaymentByBookingId[bookingId];
        if (!current || getPaymentSortTime(payment) > getPaymentSortTime(current)) {
          latestPaymentByBookingId[bookingId] = payment;
        }
      });

      const payments = Object.values(latestPaymentByBookingId)
        .filter((payment) => payment.status !== 'cancelled' && !dismissedPrompts.has(payment.id))
        .sort((a, b) => {
          return getPaymentSortTime(b) - getPaymentSortTime(a);
        });

      for (const payment of payments) {
        const bookingId = payment.Booking_ID || payment.bookingId;
        const existingReviewSnap = await getDoc(doc(db, 'reviews', `${user.uid}_${bookingId}`));
        if (cancelled || existingReviewSnap.exists()) continue;

        const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
        if (cancelled || !bookingSnap.exists()) continue;

        const booking = { id: bookingSnap.id, ...bookingSnap.data() };
        if (booking.status !== 'completed') continue;

        setPaymentReviewPrompt({ payment, booking });
        setSelectedReviewBooking(booking);
        setReviewRating(5);
        setReviewComment('');
        break;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user?.uid, paymentReviewPrompt]);

  const handleSelectReviewBooking = (booking) => {
    const existingReview = reviewMap[booking.id];
    setSelectedReviewBooking(booking);
    setReviewRating(Number(existingReview?.rating || existingReview?.Rating || 5));
    setReviewComment(existingReview?.comment || existingReview?.Comment || '');
  };

  const isReviewDeletedByShop = (review) => (
    review?.Review_Status === 'deleted_by_shop' ||
    review?.reviewStatus === 'deleted_by_shop' ||
    review?.Hidden_Reason === 'shop_removed_review' ||
    review?.hiddenReason === 'shop_removed_review'
  );

  const getBookingStartDate = (booking) => {
    if (!booking?.bookingDate) return null;
    const firstSlot = Array.isArray(booking.timeSlots) && booking.timeSlots.length > 0
      ? [...booking.timeSlots].sort()[0]
      : '';
    const startTime = firstSlot.split('-')[0] || '00:00';
    const startDate = new Date(`${booking.bookingDate}T${startTime}:00`);
    return Number.isNaN(startDate.getTime()) ? null : startDate;
  };

  const canModifyBooking = (booking) => {
    if (!['pending', 'confirmed'].includes(booking?.status)) return false;
    const startDate = getBookingStartDate(booking);
    if (!startDate) return false;
    return startDate.getTime() - Date.now() > bookingModifyLimitHours * 60 * 60 * 1000;
  };

  const getBookingStatusLabel = (status) => {
    if (status === 'pending') return 'รอตรวจสอบ';
    if (status === 'confirmed') return 'ยืนยันจองแล้ว';
    if (status === 'occupied') return 'กำลังใช้บริการ';
    if (status === 'completed') return 'เสร็จสิ้นรายการ';
    if (status === 'cancelled') return 'ถูกยกเลิก';
    return status || '-';
  };

  const getBookingStatusClass = (status) => (
    status === 'pending' ? 'bg-slate-100 text-slate-500' :
    status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
    status === 'occupied' ? 'bg-amber-100 text-amber-800' :
    status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  );

  const getHistoryStatusLabel = (booking) => {
    const payment = paymentsByBookingId[booking.id];
    if (payment?.status === 'cancelled') return 'ยกเลิกบิล';
    return getBookingStatusLabel(booking.status);
  };

  const getHistoryStatusClass = (booking) => {
    const payment = paymentsByBookingId[booking.id];
    if (payment?.status === 'cancelled') return 'bg-rose-100 text-rose-800';
    return getBookingStatusClass(booking.status);
  };

  const formatBookingCreatedAt = (value) => {
    if (!value) return '-';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCashierLabel = (payment) => {
    const name = payment?.Cashier_Name || payment?.cashierName || payment?.Processed_By_Name || '';
    const role = payment?.Cashier_Role || payment?.cashierRole || payment?.Processed_By_Role || '';
    if (!payment) return '-';
    if (!name && !role) return 'ไม่ระบุผู้รับชำระ';
    return `${name || 'ไม่ระบุชื่อ'}${role ? ` (${String(role).toUpperCase()})` : ''}`;
  };

  const openReceiptBooking = async (booking) => {
    setReceiptBooking(booking);
    setReceiptPayment(null);
    setReceiptPaymentLoading(true);
    try {
      const paymentQuery = query(
        collection(db, 'payments'),
        where('Booking_ID', '==', booking.id)
      );
      const snap = await getDocs(paymentQuery);
      const payments = snap.docs.map((paymentDoc) => ({ id: paymentDoc.id, ...paymentDoc.data() }));
      payments.sort((a, b) => {
        const aTime = a.Payment_Date?.toDate ? a.Payment_Date.toDate().getTime() : new Date(a.Payment_Date || 0).getTime();
        const bTime = b.Payment_Date?.toDate ? b.Payment_Date.toDate().getTime() : new Date(b.Payment_Date || 0).getTime();
        return bTime - aTime;
      });
      setReceiptPayment(payments[0] || null);
    } catch (error) {
      console.error('Error fetching member receipt payment:', error);
      setReceiptPayment(null);
    }
    setReceiptPaymentLoading(false);
  };

  const escapeReceiptText = (value) => String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatReceiptMoney = (value) => `${toWholeNumber(value).toLocaleString()} บาท`;

  const getReceiptRentedClubs = () => {
    if (Array.isArray(receiptBooking?.rentedClubs) && receiptBooking.rentedClubs.length > 0) {
      return receiptBooking.rentedClubs;
    }

    if (Array.isArray(receiptPayment?.Rented_Clubs) && receiptPayment.Rented_Clubs.length > 0) {
      return receiptPayment.Rented_Clubs;
    }

    return [];
  };

  const getReceiptNeedsClubRent = () => (
    Boolean(receiptBooking?.needsClubRent || receiptPayment?.Needs_Club_Rent || getReceiptRentedClubs().length > 0)
  );

  const getReceiptNeedsInstructor = () => (
    Boolean(receiptBooking?.needsInstructor || receiptPayment?.Needs_Instructor)
  );

  const handleSaveReceipt = () => {
    if (!receiptBooking) return;
    if (!receiptPayment || receiptPayment.status === 'cancelled') {
      window.appAlert('ยังไม่สามารถบันทึกใบเสร็จได้ เนื่องจากรายการนี้ยังไม่ได้รับการชำระเงิน');
      return;
    }

    const receiptWindow = window.open('', '_blank', 'width=900,height=900');
    if (!receiptWindow) {
      window.appAlert('ไม่สามารถเปิดหน้าบันทึกใบเสร็จได้ กรุณาอนุญาต popup ในเบราว์เซอร์');
      return;
    }

    const laneLabel = receiptBooking.isManualIncome
      ? (receiptBooking.laneNumber || '-')
      : receiptBooking.selectedLanes?.length
      ? `เลน ${receiptBooking.selectedLanes.join(', ')}`
      : `เลน ${receiptBooking.laneNumber || '-'}`;
    const timeLabel = Array.isArray(receiptBooking.timeSlots) && receiptBooking.timeSlots.length > 0
      ? receiptBooking.timeSlots.join(', ')
      : '-';
    const receiptRentedClubs = getReceiptRentedClubs();
    const rentedClubsHtml = receiptRentedClubs.length > 0
      ? receiptRentedClubs.map((club) => `
          <tr>
            <td>${escapeReceiptText(club.Club_Name || '-')}</td>
            <td>${escapeReceiptText(club.Club_Type || '-')}</td>
            <td class="right">${Number(club.qty || 0).toLocaleString()} ชิ้น</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3" class="muted center">ไม่มีรายการเช่าไม้กอล์ฟ</td></tr>';
    const paymentItemsHtml = receiptPayment && Array.isArray(receiptPayment.Items_List) && receiptPayment.Items_List.length > 0
      ? receiptPayment.Items_List.map((item) => `
          <tr>
            <td>${escapeReceiptText(item.item_name || item.name || '-')}</td>
            <td class="right">${formatReceiptMoney(getPaymentItemUnitPrice(item))} / ${escapeReceiptText(getPaymentItemUnit(item))}</td>
            <td class="right">${getPaymentItemQuantity(item).toLocaleString()} ${escapeReceiptText(getPaymentItemUnit(item))}</td>
            <td class="right">${formatReceiptMoney(getPaymentItemTotal(item))}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" class="muted center">ยังไม่มีรายละเอียดค่าบริการ</td></tr>';

    receiptWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Booking Receipt - ${escapeReceiptText(receiptBooking.id)}</title>
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
              <div class="muted">เลขที่รายการ: ${escapeReceiptText(receiptBooking.id)}</div>
            </section>
            <section class="content">
              <div class="grid">
                <div class="box"><div class="label">วันที่เข้าใช้</div><div class="value">${escapeReceiptText(receiptBooking.bookingDate || '-')}</div></div>
                <div class="box"><div class="label">สถานะ</div><div class="value">${escapeReceiptText(getBookingStatusLabel(receiptBooking.status))}</div></div>
                <div class="box"><div class="label">ชื่อผู้จอง</div><div class="value">${escapeReceiptText(receiptBooking.customerName || '-')}</div></div>
                <div class="box"><div class="label">เบอร์โทรศัพท์</div><div class="value">${escapeReceiptText(receiptBooking.customerPhone || '-')}</div></div>
                <div class="box"><div class="label">อีเมล</div><div class="value">${escapeReceiptText(receiptBooking.customerEmail || user?.email || '-')}</div></div>
                <div class="box"><div class="label">สร้างรายการเมื่อ</div><div class="value">${escapeReceiptText(formatBookingCreatedAt(receiptBooking.createdAt))}</div></div>
                <div class="box"><div class="label">เลนซ้อม</div><div class="value">${escapeReceiptText(laneLabel)}</div></div>
                <div class="box"><div class="label">ช่วงเวลาที่จอง</div><div class="value">${escapeReceiptText(timeLabel)}</div></div>
                <div class="box"><div class="label">จำนวนผู้เข้าใช้</div><div class="value">${Number(receiptBooking.guestCount || 1).toLocaleString()} ท่าน</div></div>
                <div class="box"><div class="label">บริการเสริม</div><div class="value">ผู้สอนพื้นฐานการเล่นกอล์ฟ: ${getReceiptNeedsInstructor() ? 'ต้องการ' : 'ไม่ต้องการ'} | เช่าไม้: ${getReceiptNeedsClubRent() ? 'ต้องการ' : 'ไม่ต้องการ'}</div></div>
              </div>

              <h2>รายการไม้กอล์ฟที่เลือกเช่า</h2>
              <table>
                <thead><tr><th>รายการ</th><th>ประเภท</th><th class="right">จำนวน</th></tr></thead>
                <tbody>${rentedClubsHtml}</tbody>
              </table>

              <h2>รายการชำระเงิน</h2>
              <table>
                <thead><tr><th>รายการ</th><th class="right">ราคา/หน่วย</th><th class="right">จำนวน</th><th class="right">รวม</th></tr></thead>
                <tbody>${paymentItemsHtml}</tbody>
              </table>

              <div class="total">
                <div class="row"><span>ยอดรวม</span><span>${formatReceiptMoney(receiptPayment?.Total_Amount || 0)}</span></div>
                <div class="row"><span>ส่วนลดจากแต้ม</span><span>${formatReceiptMoney(receiptPayment?.Point_Discount || 0)}</span></div>
                <div class="row"><span>แต้มที่ใช้</span><span>${toWholeNumber(receiptPayment?.Used_Points || 0).toLocaleString()} PTS</span></div>
                <div class="row"><span>แต้มที่ได้รับ</span><span>+${toWholeNumber(receiptPayment?.Earned_Points || 0).toLocaleString()} PTS</span></div>
                <div class="row"><span>ยอดแต้มเปลี่ยนแปลง</span><span>${toWholeNumber(receiptPayment?.Point_Balance_Change || 0).toLocaleString()} PTS</span></div>
                <div class="row"><span>วิธีชำระเงิน</span><span>${escapeReceiptText(receiptPayment?.Payment_Method || '-')}</span></div>
                <div class="row"><span>ผู้รับชำระเงิน</span><span>${escapeReceiptText(receiptPayment ? getCashierLabel(receiptPayment) : '-')}</span></div>
                <div class="row"><span>เงินสด</span><span>${formatReceiptMoney(receiptPayment?.Cash_Amount || 0)}</span></div>
                <div class="row"><span>เงินโอน</span><span>${formatReceiptMoney(receiptPayment?.Transfer_Amount || 0)}</span></div>
                <div class="row net"><span>ยอดสุทธิที่ชำระ</span><span>${formatReceiptMoney(receiptPayment?.Net_Amount || 0)}</span></div>
              </div>
            </section>
            <section class="footer">เอกสารนี้สร้างจากระบบ Muang Loei Golf เมื่อ ${new Date().toLocaleString('th-TH')}</section>
          </main>
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => window.print(), 300);
            });
          </script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };

  const fetchEditClubInventory = async (targetBooking = editingBooking) => {
    setEditClubsLoading(true);
    try {
      const rentedQtyMap = {};

      if (targetBooking?.bookingDate) {
        const bookingSnap = await getDocs(query(
          collection(db, 'bookings'),
          where('bookingDate', '==', targetBooking.bookingDate),
          where('status', 'in', ['pending', 'confirmed', 'occupied'])
        ));

        bookingSnap.docs.forEach((bookingDoc) => {
          if (bookingDoc.id === targetBooking.id) return;

          const booking = bookingDoc.data();
          if (Array.isArray(booking.rentedClubs)) {
            booking.rentedClubs.forEach((clubItem) => {
              const clubId = clubItem.clubId;
              if (!clubId) return;
              rentedQtyMap[clubId] = (rentedQtyMap[clubId] || 0) + Number(clubItem.qty || 0);
            });
          }
        });
      }

      const snap = await getDocs(collection(db, 'golf_clubs'));
      const clubs = snap.docs.map((clubDoc) => {
        const data = clubDoc.data();
        const totalQty = getClubTotalQty(data);
        const repairQty = getClubRepairQty(data);
        const rentedQty = rentedQtyMap[clubDoc.id] || 0;
        return {
          id: clubDoc.id,
          name: getClubName(data),
          type: getClubType(data),
          available: Math.max(0, totalQty - repairQty - rentedQty),
          isActive: data.Is_Active !== false
        };
      }).filter((club) => club.isActive && club.available > 0);

      setEditClubInventory(sortGolfClubsLikeInventory(clubs));
    } catch (error) {
      console.error('Error fetching editable golf clubs:', error);
      setEditClubInventory([]);
    }
    setEditClubsLoading(false);
  };

  const openEditBooking = (booking) => {
    setEditingBooking(booking);
    setEditSelectedClubs(Array.isArray(booking.rentedClubs) ? booking.rentedClubs : []);
    setEditClubInventory([]);
    setEditBookingForm({
      customerName: booking.customerName || userData?.FullName || userData?.fullName || '',
      customerPhone: booking.customerPhone || userData?.PhoneNumber || userData?.phone || '',
      guestCount: Math.max(1, toWholeNumber(booking.guestCount || 1)),
      needsInstructor: Boolean(booking.needsInstructor),
      needsClubRent: Boolean(booking.needsClubRent)
    });
    if (booking.needsClubRent) {
      fetchEditClubInventory(booking);
    }
  };

  const handleToggleEditClubRent = (needsClubRent) => {
    setEditBookingForm({ ...editBookingForm, needsClubRent });
    if (needsClubRent && editClubInventory.length === 0) {
      fetchEditClubInventory(editingBooking);
    }
    if (!needsClubRent) {
      setEditSelectedClubs([]);
    }
  };

  const handleEditClubQtyChange = (club, change) => {
    const existingItem = editSelectedClubs.find((item) => item.clubId === club.id);
    const currentQty = existingItem ? Number(existingItem.qty || 0) : 0;
    const newQty = Math.max(0, currentQty + change);

    if (newQty > club.available) {
      window.appAlert(`ไม้กอล์ฟรายการนี้พร้อมใช้งานได้อีก ${club.available} ชิ้น`);
      return;
    }

    if (existingItem) {
      if (newQty === 0) {
        setEditSelectedClubs(editSelectedClubs.filter((item) => item.clubId !== club.id));
      } else {
        setEditSelectedClubs(editSelectedClubs.map((item) => (
          item.clubId === club.id ? { ...item, qty: newQty, price: clubRentalRate } : item
        )));
      }
      return;
    }

    if (change > 0) {
      setEditSelectedClubs([
        ...editSelectedClubs,
        {
          clubId: club.id,
          Club_Name: club.name,
          Club_Type: club.type,
          qty: newQty,
          price: clubRentalRate
        }
      ]);
    }
  };

  const handleSaveBookingEdit = async () => {
    if (!editingBooking || !canModifyBooking(editingBooking)) return;
    const phone = editBookingForm.customerPhone.replace(/\D/g, '');
    if (!editBookingForm.customerName.trim() || phone.length !== 10) {
      window.appAlert('กรุณากรอกชื่อและเบอร์โทรศัพท์ 10 หลักให้ครบถ้วน');
      return;
    }
    if (editBookingForm.needsClubRent && editSelectedClubs.length === 0) {
      window.appAlert('กรุณาเลือกไม้กอล์ฟอย่างน้อย 1 รายการ หรือเปลี่ยนเป็นไม่ต้องการเช่า');
      return;
    }
    if (editBookingForm.needsClubRent && clubRentalRateLoading) {
      window.appAlert('กำลังโหลดราคาค่าเช่าไม้กอล์ฟล่าสุด กรุณารอสักครู่แล้วลองอีกครั้ง');
      return;
    }

    await updateDoc(doc(db, 'bookings', editingBooking.id), {
      customerName: editBookingForm.customerName.trim(),
      customerPhone: phone,
      guestCount: Math.max(1, toWholeNumber(editBookingForm.guestCount || 1)),
      needsInstructor: Boolean(editBookingForm.needsInstructor),
      needsClubRent: Boolean(editBookingForm.needsClubRent),
      rentedClubs: editBookingForm.needsClubRent
        ? editSelectedClubs.map((item) => ({ ...item, price: clubRentalRate }))
        : [],
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid
    });

    setEditingBooking(null);
    fetchMyBookings();
  };

  const handleCancelBooking = async () => {
    if (!cancelTarget || !canModifyBooking(cancelTarget)) return;

    await updateDoc(doc(db, 'bookings', cancelTarget.id), {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: user.uid,
      cancelReason: 'Member cancelled before booking time'
    });

    setCancelTarget(null);
    fetchMyBookings();
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedReviewBooking) {
      window.appAlert('กรุณาเลือกประวัติการใช้บริการที่เสร็จสิ้นแล้วก่อนให้คะแนน');
      return;
    }
    if (selectedReviewBooking.status !== 'completed') {
      window.appAlert('ให้คะแนนได้เฉพาะการใช้บริการที่เสร็จสิ้นแล้วเท่านั้น');
      return;
    }

    const selectedPayment = reviewPaymentMap[selectedReviewBooking.id] || paymentsByBookingId[selectedReviewBooking.id];
    if (selectedPayment?.status === 'cancelled') {
      window.appAlert('รายการนี้ถูกยกเลิกบิลแล้ว จึงไม่สามารถให้คะแนนและความคิดเห็นได้');
      return;
    }

    const existingSelectedReview = reviewMap[selectedReviewBooking.id];
    if (isReviewDeletedByShop(existingSelectedReview)) {
      window.appAlert('ความคิดเห็นนี้ถูกลบโดยร้านแล้ว จึงไม่สามารถแก้ไขหรือนำมานับรวมกับคะแนนของร้านได้');
      return;
    }
    setSubmittingReview(true);
    try {
      const reviewDocId = `${user.uid}_${selectedReviewBooking.id}`;
      const reviewPayload = {
        User_ID: user.uid,
        Booking_ID: selectedReviewBooking.id,
        bookingId: selectedReviewBooking.id,
        Booking_Date: selectedReviewBooking.bookingDate || '',
        Lane_Code: selectedReviewBooking.selectedLanes?.join(', ') || selectedReviewBooking.laneNumber || '',
        Time_Slots: Array.isArray(selectedReviewBooking.timeSlots) ? selectedReviewBooking.timeSlots : [],
        Customer_Name: userData?.FullName || userData?.fullName || selectedReviewBooking.customerName || 'สมาชิกไม่ระบุชื่อ',
        customerName: userData?.FullName || userData?.fullName || selectedReviewBooking.customerName || 'สมาชิกไม่ระบุชื่อ',
        Email: user.email,
        email: user.email,
        Rating: Number(reviewRating),
        rating: Number(reviewRating),
        Comment: reviewComment.trim(),
        comment: reviewComment.trim(),
        Review_Date: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const existingReview = reviewMap[selectedReviewBooking.id];
      await setDoc(doc(db, 'reviews', existingReview?.id || reviewDocId), {
        ...reviewPayload,
        createdAt: existingReview?.createdAt || serverTimestamp()
      }, { merge: true });

      if (paymentReviewPrompt?.payment?.id) {
        markPaymentReviewPromptDismissed(paymentReviewPrompt.payment.id);
        setPaymentReviewPrompt(null);
      }

      window.appAlert(existingReview ? "แก้ไขคะแนนและความคิดเห็นเรียบร้อยแล้ว" : "ขอบคุณสำหรับคะแนนและความคิดเห็นที่มีให้ทางสนามครับ");
      setReviewComment('');
      setReviewRating(5);
      setSelectedReviewBooking(null);
      fetchReviewableBookings();
    } catch (error) {
      window.appAlert("ไม่สามารถส่งรีวิวได้: " + error.message);
    }
    setSubmittingReview(false);
  };

  const handleClosePaymentReviewPrompt = () => {
    if (paymentReviewPrompt?.payment?.id) {
      markPaymentReviewPromptDismissed(paymentReviewPrompt.payment.id);
    }
    setPaymentReviewPrompt(null);
    setSelectedReviewBooking(null);
    setReviewRating(5);
    setReviewComment('');
  };

  const navItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: 'dashboard' },
    { id: 'profile', label: 'ข้อมูลโปรไฟล์ของฉัน', icon: 'user' },
    { id: 'booking', label: 'จองสนามซ้อมออนไลน์', icon: 'booking' },
    { id: 'history', label: 'รายการจองของฉัน', icon: 'history' },
    { id: 'writereview', label: 'รีวิวและให้คะแนน', icon: 'star' },
  ];

  const shopReviewStats = (() => {
    const ratings = shopReviews
      .map((review) => Number(review.Rating || review.rating || 0))
      .filter((rating) => rating > 0);
    const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
    return {
      average,
      total: ratings.length,
      distribution: [5, 4, 3, 2, 1].reduce((acc, score) => {
        acc[score] = ratings.filter((rating) => Math.round(rating) === score).length;
        return acc;
      }, {})
    };
  })();

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans">
      {/* --- SIDEBAR (ถอดดีไซน์สีและ Layout มาจาก OwnerDashboard) --- */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden bg-emerald-950 text-white p-2 shadow-2xl border-t border-emerald-800/70 md:inset-y-0 md:right-auto md:h-dvh md:w-72 md:shrink-0 md:overflow-y-auto md:p-6 md:border-t-0 md:flex md:flex-col md:justify-between"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(2,44,34,0.88), rgba(2,44,34,0.72), rgba(2,44,34,0.84)), url('/sidebar-cover.jpg')",
          backgroundSize: '100% 100%',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'local'
        }}
      >
        <div className="relative z-10">
          <h2 className="hidden md:flex mb-5 rounded-2xl border border-amber-400/30 bg-amber-600/25 px-4 py-3 text-lg font-black tracking-wide text-white shadow-sm shadow-amber-950/20">
            MLG Member
          </h2>
          
          {/* บล็อกแสดงข้อมูลผู้เข้าใช้งานและแต้มสะสม */}
          <div className="hidden md:block mb-6 p-4 bg-emerald-950/40 rounded-2xl border border-emerald-800/50 text-left">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              แต้มสะสมของคุณ
            </div>
            <div className="text-3xl font-black text-amber-400 mt-1">
              {formatPoints(userData?.Points_Balance ?? userData?.points_balance ?? 0)} <span className="text-xs text-white font-bold">PTS</span>
            </div>
            <div className="text-[10px] text-slate-300 font-bold truncate mt-2">
              คุณ {userData?.FullName || userData?.fullName || 'สมาชิก'}
            </div>
          </div>

          <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
            {navItems.map((item) => (
              <ResponsiveNavButton
                key={item.id}
                active={activeTab === item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => setActiveTab(item.id)}
              />
            ))}
            <button
              type="button"
              onClick={handleLogout}
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className="flex h-14 min-w-[58px] flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-2 font-bold text-rose-100 transition-all hover:bg-rose-900/40 hover:text-white md:hidden"
            >
              <NavIcon name="logOut" className="h-5 w-5 shrink-0" />
            </button>
          </nav>

          <nav className="hidden">
            <button onClick={() => setActiveTab('profile')} 
              className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'profile' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              ข้อมูลโปรไฟล์ของฉัน
            </button>
            <button onClick={() => setActiveTab('booking')} 
              className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'booking' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              จองสนามซ้อมออนไลน์
            </button>
            <button onClick={() => setActiveTab('history')} 
              className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'history' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              รายการจองของฉัน
            </button>
            <button onClick={() => setActiveTab('writereview')} 
              className={`w-full text-left p-4 rounded-2xl font-bold transition-all ${activeTab === 'writereview' ? 'bg-emerald-600 shadow-lg' : 'hover:bg-emerald-800'}`}>
              รีวิวและให้คะแนน
            </button>
          </nav>
        </div>
        <div className="relative z-10 hidden border-t border-emerald-800/60 pt-4 md:block">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl border border-rose-200/10 bg-rose-50/10 px-4 py-3 text-left text-sm font-black text-rose-100 transition-all hover:bg-rose-500/20 hover:text-white"
          >
            <NavIcon name="logOut" className="h-5 w-5 shrink-0" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>

      {/* --- MAIN CONTENT (โครงสร้างตรงกับหน้าหลักแอดมิน) --- */}
      <div className="min-w-0 flex-1 p-4 pb-28 md:ml-72 md:p-10 md:pb-10 overflow-y-auto">
        <header className="hidden">
          <button 
            onClick={handleLogout} 
            className="shrink-0 text-sm font-bold text-red-500 bg-red-50 px-3 md:px-4 py-2 rounded-xl hover:bg-red-100 transition-all shadow-sm flex items-center gap-2"
          >
            <NavIcon name="logOut" className="w-4 h-4" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
          
          <button 
            onClick={handleLogout} 
            className="text-sm font-bold text-red-500 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-all shadow-sm"
          >
            ออกจากระบบ
          </button>
        </header>
        
        <div key={`${activeTab}-${reviewViewMode}`} className="dashboard-page-transition">
        {activeTab === 'dashboard' && (
          <DashboardHome
            role="customer"
            user={user}
            userData={userData}
            onNavigate={setActiveTab}
          />
        )}

        {/* TAB 1: ข้อมูลหน้าโปรไฟล์สมาชิก */}
        {activeTab === 'profile' && (
          <AccountProfileCard
            user={user}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            updatingProfile={updatingProfile}
            onSubmit={handleUpdateProfile}
            fallbackName="สมาชิก"
            fallbackInitials="MB"
            pointsBalance={userData?.Points_Balance ?? userData?.points_balance ?? 0}
            onPasswordResetEmailSent={onPasswordResetEmailSent}
          />
        )}

        {/* TAB 2: หน้าต่างทำรายการจองสนาม */}
        {activeTab === 'booking' && (
          <div className="w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm animate-fadeIn sm:p-8">
            <BookingFlow user={user} userData={userData} />
          </div>
        )}

        {/* TAB 3: หน้าแสดงประวัติและสถานะคิวการจองของตนเอง */}
        {activeTab === 'history' && (
          <div className="w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left shadow-sm animate-fadeIn sm:p-8">
            <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight">รายการจองของฉัน</h2>
            
            {loadingHistory ? (
              <p className="text-center py-10 text-slate-400 font-bold">กำลังดึงข้อมูลตารางเวลาของคุณ...</p>
            ) : myBookings.length === 0 ? (
              <div className="text-center py-14 text-slate-400 border border-dashed rounded-2xl italic font-bold">
                คุณยังไม่มีรายการจองในระบบขณะนี้
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm border-collapse">
                  <thead>
                    <tr className="text-slate-400 text-xs font-black uppercase border-b border-slate-200">
                      <th className="py-3 px-2">วันที่เข้าใช้</th>
                      <th>ตำแหน่งเลน</th>
                      <th>ช่วงเวลาซ้อม</th>
                      <th className="text-center">สถานะบิลคิว</th>
                      <th className="text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold text-slate-600 text-xs">
                    {myBookings.map((b) => {
                      const canModify = canModifyBooking(b);
                      return (
                        <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-4 px-2 text-slate-800">{b.bookingDate}</td>
                          <td className="text-indigo-600">{b.isManualIncome ? (b.laneNumber || '-') : `เลน ${b.selectedLanes?.join(', ') || b.laneNumber}`}</td>
                          <td className="text-slate-500 font-medium">{b.timeSlots?.join(', ')}</td>
                          <td className="text-center">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase ${getHistoryStatusClass(b)} ${b.status === 'occupied' && paymentsByBookingId[b.id]?.status !== 'cancelled' ? 'animate-pulse' : ''}`}>
                              {getHistoryStatusLabel(b)}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="flex flex-wrap justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openReceiptBooking(b)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-700 hover:bg-slate-50"
                              >
                                ตรวจสอบรายละเอียด
                              </button>
                              {canModify ? (
                                <>
                                <button
                                  type="button"
                                  onClick={() => openEditBooking(b)}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-100"
                                >
                                  แก้ไข
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCancelTarget(b)}
                                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-black text-rose-700 hover:bg-rose-100"
                                >
                                  ยกเลิก
                                </button>
                                </>
                              ) : (
                                <span className="self-center text-[10px] font-bold text-slate-400">แก้ไขไม่ได้</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'writereview' && (
          <div className="mb-5 w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left shadow-sm animate-fadeIn sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Reviews & Rating</p>
                <h2 className="mt-1 text-2xl font-black text-slate-800">คะแนนและความคิดเห็น</h2>
                <p className="mt-2 max-w-2xl text-xs font-bold leading-relaxed text-slate-500">
                  ดูคะแนนรวมของร้านหรือเลือกประวัติการใช้บริการที่เสร็จสิ้นแล้วเพื่อให้คะแนนของคุณ
                </p>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[420px]">
                <button
                  type="button"
                  onClick={() => setReviewViewMode('shop')}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    reviewViewMode === 'shop'
                      ? 'border-emerald-300 bg-white text-emerald-800 shadow-sm ring-2 ring-emerald-100'
                      : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-white'
                  }`}
                >
                  <span className="block text-[11px] font-black">คะแนนร้าน</span>
                  <span className="mt-1 block text-lg font-black">
                    {shopReviewStats.total ? shopReviewStats.average.toFixed(1) : '-'}
                    <span className="ml-1 text-[11px] text-slate-400">/ 5</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewViewMode('write')}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    reviewViewMode === 'write'
                      ? 'border-emerald-300 bg-white text-emerald-800 shadow-sm ring-2 ring-emerald-100'
                      : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-white'
                  }`}
                >
                  <span className="block text-[11px] font-black">ให้คะแนนของฉัน</span>
                  <span className="mt-1 block text-lg font-black">
                    {Object.keys(reviewMap).length}
                    <span className="ml-1 text-[11px] text-slate-400">รีวิวแล้ว</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'writereview' && reviewViewMode === 'shop' && (
          <div className="w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left shadow-sm animate-fadeIn sm:p-8">
            {loadingShopReviews ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
                กำลังโหลดคะแนนและความคิดเห็นของร้าน...
              </div>
            ) : (
              <>
                <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5 text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Average Rating</div>
                    <div className="mt-2 text-5xl font-black text-slate-800">
                      {shopReviewStats.total ? shopReviewStats.average.toFixed(1) : '-'}
                    </div>
                    <div className="mt-3 flex justify-center gap-1 text-amber-600">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <StarIcon key={num} className="h-5 w-5" filled={shopReviewStats.average >= num - 0.49} />
                      ))}
                    </div>
                    <div className="mt-3 text-xs font-bold text-slate-400">
                      จากทั้งหมด {shopReviewStats.total.toLocaleString()} รีวิว
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-black text-slate-800">สัดส่วนคะแนน</h3>
                    <div className="mt-4 space-y-3">
                      {[5, 4, 3, 2, 1].map((score) => {
                        const count = shopReviewStats.distribution[score] || 0;
                        const percent = shopReviewStats.total ? (count / shopReviewStats.total) * 100 : 0;
                        return (
                          <div key={score} className="grid grid-cols-[72px_minmax(0,1fr)_52px] items-center gap-3 text-xs font-bold text-slate-500">
                            <span>{score} คะแนน</span>
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-amber-300" style={{ width: `${percent}%` }} />
                            </div>
                            <span className="text-right">{count} รีวิว</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {shopReviews.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
                    ยังไม่มีคะแนนและความคิดเห็นของร้านในขณะนี้
                  </div>
                ) : (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black text-slate-800">ความคิดเห็นล่าสุด</h3>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                        {shopReviews.length.toLocaleString()} รายการ
                      </span>
                    </div>
                    {shopReviews.map((review) => {
                      const rating = Number(review.Rating || review.rating || 0);
                      const reviewDate = review.createdAt?.toDate
                        ? review.createdAt.toDate()
                        : review.Review_Date?.toDate
                          ? review.Review_Date.toDate()
                          : null;

                      return (
                        <article key={review.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-sm font-black text-slate-800">
                                {review.Customer_Name || review.customerName || 'สมาชิกไม่ระบุชื่อ'}
                              </div>
                              <div className="mt-1 text-[11px] font-bold text-slate-400">
                                {review.Booking_Date || review.bookingDate ? `วันที่ใช้บริการ ${review.Booking_Date || review.bookingDate}` : 'รีวิวการใช้บริการ'}
                                {reviewDate ? ` | รีวิวเมื่อ ${reviewDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-amber-700">
                              <StarIcon className="h-4 w-4" filled />
                              <span className="text-sm font-black">{rating.toFixed(1)}</span>
                            </div>
                          </div>
                          <p className="mt-4 whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-relaxed text-slate-600">
                            {review.Comment || review.comment || 'ไม่มีความคิดเห็นเพิ่มเติม'}
                          </p>
                        </article>
                      );
                    })}
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 4: หน้าจอให้คะแนนและเขียนข้อความรีวิว */}
        {activeTab === 'writereview' && reviewViewMode === 'write' && (
          <div className="w-full max-w-[1600px] mx-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left shadow-sm animate-fadeIn sm:p-8">
            <div className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase text-slate-400">Completed</div>
                <div className="mt-1 text-2xl font-black text-slate-800">{reviewableBookings.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="text-[10px] font-black uppercase text-emerald-600">Reviewed</div>
                <div className="mt-1 text-2xl font-black text-emerald-800">{Object.keys(reviewMap).length}</div>
              </div>
            </div>

            {loadingReviewableBookings ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
                กำลังโหลดประวัติการใช้บริการที่เสร็จสิ้นแล้ว...
              </div>
            ) : reviewableBookings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
                ยังไม่มีประวัติการใช้บริการที่เสร็จสิ้นแล้วสำหรับให้คะแนน
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,430px)]">
                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-slate-400">เลือกประวัติการใช้บริการ</div>
                      <div className="mt-1 text-[11px] font-bold text-slate-400">เลือกรายการที่ต้องการให้คะแนนหรือแก้ไขรีวิว</div>
                    </div>
                  </div>
                  <div className="max-h-[470px] space-y-2 overflow-y-auto pr-1">
                    {reviewableBookings.map((booking) => {
                      const isSelected = selectedReviewBooking?.id === booking.id;
                      const existingReview = reviewMap[booking.id];
                      const reviewDeletedByShop = isReviewDeletedByShop(existingReview);
                      const cancelledPayment = reviewPaymentMap[booking.id]?.status === 'cancelled' ? reviewPaymentMap[booking.id] : null;
                      const cancelReason = cancelledPayment?.Cancel_Reason || cancelledPayment?.cancelReason || '-';

                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => handleSelectReviewBooking(booking)}
                          className={`w-full rounded-2xl border p-4 text-left transition-all ${cancelledPayment || reviewDeletedByShop ? 'border-rose-100 bg-rose-50/60 hover:bg-rose-50' : isSelected ? 'border-emerald-300 bg-white shadow-sm ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 space-y-1">
                              <div className="text-sm font-black text-slate-800">วันที่ {booking.bookingDate || '-'}</div>
                              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                                <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">เลน {booking.selectedLanes?.join(', ') || booking.laneNumber || '-'}</span>
                                <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-500">{Array.isArray(booking.timeSlots) ? booking.timeSlots.join(', ') : '-'}</span>
                              </div>
                              {cancelledPayment && (
                                <div className="rounded-xl border border-rose-100 bg-white/80 px-3 py-2 text-[11px] font-bold leading-relaxed text-rose-700">
                                  รายการนี้ถูกยกเลิกบิลเนื่องจาก: {cancelReason} จึงไม่สามารถนำมานับรวมกับรีวิวและคะแนนของร้านได้
                                </div>
                              )}
                              {reviewDeletedByShop && !cancelledPayment && (
                                <div className="rounded-xl border border-rose-100 bg-white/80 px-3 py-2 text-[11px] font-bold leading-relaxed text-rose-700">
                                  ความคิดเห็นนี้ถูกลบโดยร้าน แต่ยังเก็บไว้ในส่วนรีวิวเฉพาะของคุณ และจะไม่ถูกนำมานับรวมกับรีวิวและคะแนนของร้าน
                                </div>
                              )}
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${cancelledPayment || reviewDeletedByShop ? 'border-rose-200 bg-rose-50 text-rose-700' : existingReview ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                              {cancelledPayment ? 'ยกเลิกบิล' : reviewDeletedByShop ? 'ถูกลบโดยร้าน' : existingReview ? 'รีวิวแล้ว' : 'ยังไม่รีวิว'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <form onSubmit={handleSubmitReview} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400">รายการที่เลือก</div>
                    {selectedReviewBooking ? (
                      <div className="mt-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                        <div className="text-sm font-black text-slate-800">วันที่ {selectedReviewBooking.bookingDate || '-'}</div>
                        <div className="mt-1 text-xs font-bold text-slate-500">เลน {selectedReviewBooking.selectedLanes?.join(', ') || selectedReviewBooking.laneNumber || '-'} | {Array.isArray(selectedReviewBooking.timeSlots) ? selectedReviewBooking.timeSlots.join(', ') : '-'}</div>
                        {reviewPaymentMap[selectedReviewBooking.id]?.status === 'cancelled' && (
                          <div className="mt-3 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold leading-relaxed text-rose-700">
                            รายการนี้ถูกยกเลิกบิลเนื่องจาก: {reviewPaymentMap[selectedReviewBooking.id]?.Cancel_Reason || reviewPaymentMap[selectedReviewBooking.id]?.cancelReason || '-'} จึงไม่สามารถให้คะแนน/แก้ไขรีวิว และไม่นับรวมกับคะแนนของร้าน
                          </div>
                        )}
                        {isReviewDeletedByShop(reviewMap[selectedReviewBooking.id]) && (
                          <div className="mt-3 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold leading-relaxed text-rose-700">
                            ความคิดเห็นนี้ถูกลบโดยร้าน แต่ยังเก็บไว้ในส่วนรีวิวเฉพาะของคุณ และจะไม่ถูกนำมานับรวมกับรีวิวและคะแนนของร้าน
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs font-bold text-slate-400">กรุณาเลือกรายการใช้บริการก่อน</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ระดับความพึงพอใจการเข้าใช้บริการ</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setReviewRating(num)}
                          disabled={reviewPaymentMap[selectedReviewBooking?.id]?.status === 'cancelled' || isReviewDeletedByShop(reviewMap[selectedReviewBooking?.id])}
                          className={`flex h-12 items-center justify-center rounded-2xl transition-all border ${
                            reviewRating >= num
                              ? 'bg-amber-100 border-amber-200 text-amber-700 shadow-inner'
                              : 'bg-white text-slate-300 border-slate-200 hover:bg-slate-50'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                          aria-label={`${num} คะแนน`}
                        >
                          <StarIcon className="h-5 w-5" filled={reviewRating >= num} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">พิมพ์ข้อความเสนอแนะหรือคำชมเชย</label>
                    <textarea
                      rows="5"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      disabled={reviewPaymentMap[selectedReviewBooking?.id]?.status === 'cancelled' || isReviewDeletedByShop(reviewMap[selectedReviewBooking?.id])}
                      placeholder="พิมพ์ความคิดเห็นสำหรับการใช้บริการครั้งนี้..."
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-relaxed focus:border-emerald-500 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReview || !selectedReviewBooking || reviewPaymentMap[selectedReviewBooking?.id]?.status === 'cancelled' || isReviewDeletedByShop(reviewMap[selectedReviewBooking?.id])}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-3 rounded-2xl text-sm shadow transition-all active:scale-95"
                  >
                    {submittingReview ? 'กำลังบันทึกข้อมูล...' : reviewMap[selectedReviewBooking?.id] ? 'บันทึกการแก้ไขรีวิว' : 'ส่งข้อมูลรีวิวสู่ระบบ'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
        </div>

        {paymentReviewPrompt && (
          <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-emerald-100 bg-white text-left shadow-2xl">
              <div className="border-b border-emerald-100 bg-emerald-50/80 px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Payment Completed</p>
                    <h3 className="mt-1 text-xl font-black text-slate-900">ระบบคิดเงินรายการนี้เสร็จสิ้นแล้ว</h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      ขอบคุณที่ใช้บริการเมืองเลยไดร์ฟกอล์ฟ คุณสามารถให้คะแนนและความคิดเห็นสำหรับการจองครั้งนี้ได้ทันที
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClosePaymentReviewPrompt}
                    className="shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 transition-all hover:bg-slate-50"
                  >
                    ปิด
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                <section className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Booking Detail</p>
                    <h4 className="mt-1 text-base font-black text-slate-900">ข้อมูลการจองที่ชำระเงินแล้ว</h4>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white bg-white px-4 py-3">
                      <div className="text-[10px] font-black text-slate-400">วันที่เข้าใช้</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{paymentReviewPrompt.booking.bookingDate || '-'}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                      <div className="text-[10px] font-black text-emerald-600">เลนซ้อม</div>
                      <div className="mt-1 text-sm font-black text-emerald-800">
                        {paymentReviewPrompt.payment.Lane_Code || `เลน ${paymentReviewPrompt.booking.selectedLanes?.join(', ') || paymentReviewPrompt.booking.laneNumber || '-'}`}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white px-4 py-3 sm:col-span-2">
                      <div className="text-[10px] font-black text-slate-400">ช่วงเวลาที่ใช้บริการ</div>
                      <div className="mt-1 text-sm font-black text-slate-800">
                        {Array.isArray(paymentReviewPrompt.payment.Time_Slots) && paymentReviewPrompt.payment.Time_Slots.length > 0
                          ? paymentReviewPrompt.payment.Time_Slots.join(', ')
                          : Array.isArray(paymentReviewPrompt.booking.timeSlots) && paymentReviewPrompt.booking.timeSlots.length > 0
                            ? paymentReviewPrompt.booking.timeSlots.join(', ')
                            : '-'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white px-4 py-3">
                      <div className="text-[10px] font-black text-slate-400">ยอดชำระสุทธิ</div>
                      <div className="mt-1 text-lg font-black text-emerald-700">
                        {toWholeNumber(paymentReviewPrompt.payment.Net_Amount || 0).toLocaleString()} บาท
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white px-4 py-3">
                      <div className="text-[10px] font-black text-slate-400">แต้มที่ได้รับ</div>
                      <div className="mt-1 text-lg font-black text-amber-700">
                        +{toWholeNumber(paymentReviewPrompt.payment.Earned_Points || 0).toLocaleString()} PTS
                      </div>
                    </div>
                  </div>
                </section>

                <form onSubmit={handleSubmitReview} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Review</p>
                    <h4 className="mt-1 text-base font-black text-slate-900">ให้คะแนนและความคิดเห็น</h4>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">ระดับความพึงพอใจ</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setReviewRating(num)}
                          className={`flex h-11 items-center justify-center rounded-2xl border transition-all ${
                            reviewRating >= num
                              ? 'border-amber-200 bg-amber-100 text-amber-700 shadow-inner'
                              : 'border-slate-200 bg-white text-slate-300 hover:bg-slate-50'
                          }`}
                          aria-label={`${num} คะแนน`}
                        >
                          <StarIcon className="h-5 w-5" filled={reviewRating >= num} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">ความคิดเห็น</label>
                    <textarea
                      rows="4"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="พิมพ์ความคิดเห็นสำหรับการใช้บริการครั้งนี้..."
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-relaxed focus:border-emerald-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {submittingReview ? 'กำลังบันทึก...' : 'บันทึกคะแนนและความคิดเห็น'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClosePaymentReviewPrompt}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-100"
                    >
                      ยังไม่ให้คะแนนตอนนี้
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {receiptBooking && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm modal-overlay-transition sm:items-center">
            <div className="modal-card-transition w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl text-left">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Booking Receipt</p>
                    <h3 className="mt-1 text-xl font-black text-slate-800">ใบเสร็จรายละเอียดการจอง</h3>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      เลขที่รายการ: {receiptBooking.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptBooking(null);
                      setReceiptPayment(null);
                    }}
                    className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 bg-white text-base font-black text-slate-400 hover:bg-slate-100"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[10px] font-black text-slate-400">วันที่เข้าใช้</div>
                    <div className="mt-1 text-sm font-black text-slate-800">{receiptBooking.bookingDate || '-'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[10px] font-black text-slate-400">สถานะ</div>
                    <span className={`mt-1 inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black ${getBookingStatusClass(receiptBooking.status)}`}>
                      {getBookingStatusLabel(receiptBooking.status)}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[10px] font-black text-slate-400">สร้างรายการเมื่อ</div>
                    <div className="mt-1 text-sm font-black text-slate-800">{formatBookingCreatedAt(receiptBooking.createdAt)}</div>
                  </div>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-black text-slate-800">ข้อมูลผู้จอง</h4>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[10px] font-black text-slate-400">ชื่อผู้จอง</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{receiptBooking.customerName || '-'}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[10px] font-black text-slate-400">เบอร์โทรศัพท์</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{receiptBooking.customerPhone || '-'}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
                      <div className="text-[10px] font-black text-slate-400">อีเมล</div>
                      <div className="mt-1 break-words text-sm font-black text-slate-800">{receiptBooking.customerEmail || user?.email || '-'}</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-black text-slate-800">รายละเอียดเลนและเวลา</h4>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <div className="text-[10px] font-black text-emerald-600">เลนซ้อม</div>
                      <div className="mt-1 text-sm font-black text-emerald-800">
                        {receiptBooking.isManualIncome ? (receiptBooking.laneNumber || '-') : `เลน ${receiptBooking.selectedLanes?.join(', ') || receiptBooking.laneNumber || '-'}`}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[10px] font-black text-slate-400">จำนวนผู้เข้าใช้</div>
                      <div className="mt-1 text-sm font-black text-slate-800">{receiptBooking.guestCount || 1} ท่าน</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
                      <div className="text-[10px] font-black text-slate-400">ช่วงเวลาที่จอง</div>
                      <div className="mt-1 break-words text-sm font-black text-slate-800">
                        {Array.isArray(receiptBooking.timeSlots) && receiptBooking.timeSlots.length > 0 ? receiptBooking.timeSlots.join(', ') : '-'}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-black text-slate-800">บริการเสริม</h4>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className={`rounded-xl border p-3 ${getReceiptNeedsInstructor() ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="text-[10px] font-black text-slate-400">ผู้สอนพื้นฐานการเล่นกอล์ฟ</div>
                      <div className={`mt-1 text-sm font-black ${getReceiptNeedsInstructor() ? 'text-indigo-700' : 'text-slate-500'}`}>
                        {getReceiptNeedsInstructor() ? 'ต้องการ' : 'ไม่ต้องการ'}
                      </div>
                    </div>
                    <div className={`rounded-xl border p-3 ${getReceiptNeedsClubRent() ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="text-[10px] font-black text-slate-400">เช่าไม้กอล์ฟ</div>
                      <div className={`mt-1 text-sm font-black ${getReceiptNeedsClubRent() ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {getReceiptNeedsClubRent() ? 'ต้องการเช่า' : 'ไม่ต้องการเช่า'}
                      </div>
                    </div>
                  </div>
                </section>

                {getReceiptRentedClubs().length > 0 && (
                  <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                    <h4 className="text-sm font-black text-emerald-800">รายการไม้กอล์ฟที่เลือกเช่า</h4>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {getReceiptRentedClubs().map((club, index) => (
                        <div key={`${club.clubId || club.Club_Name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white p-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-slate-800">{club.Club_Name || '-'}</div>
                            {club.Club_Type && <div className="text-[11px] font-bold text-slate-400">{club.Club_Type}</div>}
                          </div>
                          <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                            {club.qty || 0} ชิ้น
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Payment Summary</p>
                      <h4 className="mt-0.5 text-sm font-black text-slate-800">รายการชำระเงินและสรุปยอด</h4>
                    </div>
                    {receiptPayment && (
                      <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${receiptPayment.status === 'cancelled' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {receiptPayment.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'ชำระแล้ว'}
                      </span>
                    )}
                  </div>

                  {receiptPaymentLoading ? (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">
                      กำลังโหลดข้อมูลการชำระเงิน...
                    </div>
                  ) : !receiptPayment ? (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">
                      ยังไม่มีข้อมูลการชำระเงินสำหรับรายการนี้
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {Array.isArray(receiptPayment.Items_List) && receiptPayment.Items_List.length > 0 && (
                        <div className="space-y-2">
                          {receiptPayment.Items_List.map((item, index) => (
                            <div key={`${item.item_name || 'item'}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black text-slate-800">{item.item_name || item.name || '-'}</div>
                                <div className="mt-1 text-[11px] font-bold text-slate-500">
                                  ราคา {getPaymentItemUnitPrice(item).toLocaleString('th-TH')} บาท/{getPaymentItemUnit(item)}
                                </div>
                              </div>
                              <div className="shrink-0 text-right text-sm font-black text-emerald-700">
                                {getPaymentItemTotal(item).toLocaleString('th-TH')} บาท
                              </div>
                              </div>
                              <div className="mt-1 text-[10px] font-bold text-slate-400">
                                จำนวน {getPaymentItemQuantity(item).toLocaleString('th-TH')} {getPaymentItemUnit(item)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                          <span>ยอดรวม</span>
                          <span>{toWholeNumber(receiptPayment.Total_Amount || 0).toLocaleString()} บาท</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                          <span>ส่วนลดจากแต้ม</span>
                          <span>{toWholeNumber(receiptPayment.Point_Discount || 0).toLocaleString()} บาท</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="rounded-xl bg-white px-3 py-2">
                            <div className="text-[10px] font-black text-slate-400">แต้มที่ใช้</div>
                            <div className="text-sm font-black text-slate-800">{toWholeNumber(receiptPayment.Used_Points || 0).toLocaleString()} PTS</div>
                          </div>
                          <div className="rounded-xl bg-emerald-50 px-3 py-2">
                            <div className="text-[10px] font-black text-emerald-700">แต้มที่ได้รับ</div>
                            <div className="text-sm font-black text-emerald-800">+{toWholeNumber(receiptPayment.Earned_Points || 0).toLocaleString()} PTS</div>
                          </div>
                          <div className="rounded-xl bg-slate-100 px-3 py-2">
                            <div className="text-[10px] font-black text-slate-500">ยอดแต้มเปลี่ยนแปลง</div>
                            <div className="text-sm font-black text-slate-800">{toWholeNumber(receiptPayment.Point_Balance_Change || 0).toLocaleString()} PTS</div>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                          <span>วิธีชำระเงิน</span>
                          <span>{receiptPayment.Payment_Method || '-'}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-sm font-bold text-slate-600">
                          <span className="shrink-0">ผู้รับชำระเงิน</span>
                          <span className="text-right text-slate-800">{getCashierLabel(receiptPayment)}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-xl bg-white px-3 py-2">
                            <div className="text-[10px] font-black text-slate-400">เงินสด</div>
                            <div className="text-sm font-black text-slate-800">{toWholeNumber(receiptPayment.Cash_Amount || 0).toLocaleString()} บาท</div>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-2">
                            <div className="text-[10px] font-black text-slate-400">เงินโอน</div>
                            <div className="text-sm font-black text-slate-800">{toWholeNumber(receiptPayment.Transfer_Amount || 0).toLocaleString()} บาท</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                          <span className="text-base font-black text-slate-800">ยอดสุทธิที่ชำระ</span>
                          <span className="text-xl font-black text-emerald-700">{toWholeNumber(receiptPayment.Net_Amount || 0).toLocaleString()} บาท</span>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleSaveReceipt}
                    disabled={receiptPaymentLoading || !receiptPayment || receiptPayment.status === 'cancelled'}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {!receiptPayment || receiptPayment.status === 'cancelled' ? 'รอรับชำระเงิน' : 'บันทึกใบเสร็จ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptBooking(null);
                      setReceiptPayment(null);
                    }}
                    className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-900"
                  >
                    ปิดใบเสร็จ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingBooking && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm modal-overlay-transition sm:items-center">
            <div className="modal-card-transition w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl text-left">
              <h3 className="text-lg font-black text-slate-800">แก้ไขข้อมูลการจอง</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">
                แก้ไขได้เฉพาะรายการที่ยังเหลือเวลาเกิน {bookingModifyLimitHours} ชั่วโมงก่อนถึงเวลาเริ่มจอง
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-black text-slate-500">ชื่อผู้จอง</label>
                  <input
                    value={editBookingForm.customerName}
                    onChange={(e) => setEditBookingForm({ ...editBookingForm, customerName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-black text-slate-500">เบอร์โทรศัพท์</label>
                  <input
                    value={editBookingForm.customerPhone}
                    maxLength={10}
                    onChange={(e) => setEditBookingForm({ ...editBookingForm, customerPhone: e.target.value.replace(/\D/g, '') })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-black text-slate-500">จำนวนผู้เข้าใช้</label>
                  <IntegerStepperInput
                    value={editBookingForm.guestCount}
                    onChange={(value) => setEditBookingForm({ ...editBookingForm, guestCount: value })}
                    min={1}
                    ariaLabel="จำนวนผู้เข้าใช้"
                    inputClassName="bg-slate-50"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black text-slate-500">ต้องการเช่าไม้กอล์ฟหรือไม่?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleEditClubRent(true)}
                      className={`rounded-xl border px-3 py-2 text-xs font-black ${editBookingForm.needsClubRent ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-400'}`}
                    >
                      ต้องการเช่า
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleEditClubRent(false)}
                      className={`rounded-xl border px-3 py-2 text-xs font-black ${!editBookingForm.needsClubRent ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-200 bg-white text-slate-400'}`}
                    >
                      ไม่ต้องการเช่า
                    </button>
                  </div>
                  {editBookingForm.needsClubRent && (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
                      <div className="mb-2 text-xs font-black text-emerald-800">เลือกไม้กอล์ฟที่ต้องการเช่า</div>
                      {editClubsLoading ? (
                        <div className="py-3 text-xs font-bold text-slate-400">กำลังโหลดรายการไม้กอล์ฟ...</div>
                      ) : editClubInventory.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs font-bold text-slate-400">
                          ไม่มีไม้กอล์ฟพร้อมให้เช่าในขณะนี้
                        </div>
                      ) : (
                        <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                          {editClubInventory.map((club) => {
                            const cartItem = editSelectedClubs.find((item) => item.clubId === club.id);
                            const currentQty = cartItem ? Number(cartItem.qty || 0) : 0;

                            return (
                              <div key={club.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-black text-slate-800">{club.name}</div>
                                  <div className="mt-0.5 text-[11px] font-black text-emerald-700">
                                    {clubRentalRateLoading
                                      ? 'กำลังโหลดราคา...'
                                      : `${clubRentalRate.toLocaleString('th-TH')} บาท/ชิ้น`}
                                  </div>
                                  <div className="mt-0.5 text-[11px] font-bold text-slate-400">
                                    {club.type || 'ไม่ระบุประเภท'} • พร้อมใช้งาน {club.available} ชิ้น
                                  </div>
                                </div>
                                <QuantityAdjuster
                                  className="self-end shrink-0 sm:self-auto"
                                  value={currentQty}
                                  onChange={(value) => handleEditClubQtyChange(club, Number(value) - currentQty)}
                                  min={0}
                                  max={club.available}
                                  ariaLabel={`จำนวนไม้กอล์ฟ ${club.name}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <ClubRentalTotal
                        className="mt-3"
                        selectedClubs={editSelectedClubs}
                        rate={clubRentalRate}
                        loading={clubRentalRateLoading}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black text-slate-500">ต้องการผู้สอนพื้นฐานการเล่นกอล์ฟหรือไม่?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditBookingForm({ ...editBookingForm, needsInstructor: true })}
                      className={`rounded-xl border px-3 py-2 text-xs font-black ${editBookingForm.needsInstructor ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-400'}`}
                    >
                      ต้องการ
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditBookingForm({ ...editBookingForm, needsInstructor: false })}
                      className={`rounded-xl border px-3 py-2 text-xs font-black ${!editBookingForm.needsInstructor ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-200 bg-white text-slate-400'}`}
                    >
                      ไม่ต้องการ
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={handleSaveBookingEdit}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </div>
          </div>
        )}

        {cancelTarget && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm modal-overlay-transition sm:items-center">
            <div className="modal-card-transition w-full max-w-sm rounded-3xl border border-rose-100 bg-white p-5 shadow-2xl text-left">
              <h3 className="text-lg font-black text-rose-700">ยืนยันยกเลิกการจอง</h3>
              <p className="mt-2 text-sm font-bold text-slate-600">
                ต้องการยกเลิกการจองวันที่ {cancelTarget.bookingDate} เวลา {cancelTarget.timeSlots?.join(', ')} ใช่หรือไม่
              </p>
              <p className="mt-2 text-xs font-bold text-slate-400">
                ระบบอนุญาตให้ยกเลิกได้เฉพาะก่อนถึงเวลาเริ่มจองอย่างน้อย {bookingModifyLimitHours} ชั่วโมง
              </p>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"
                >
                  ไม่ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleCancelBooking}
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-rose-700"
                >
                  ยืนยันยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default CustomerDashboard;
