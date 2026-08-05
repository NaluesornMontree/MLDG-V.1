import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import Popup from './Popup';

function getLaneLabel(booking) {
  const lanes = Array.isArray(booking?.selectedLanes)
    ? booking.selectedLanes
    : String(booking?.laneNumber || booking?.Lane_Code || booking?.laneCode || '')
      .split(',')
      .map((value) => value.replace(/[^\d]/g, '').trim())
      .filter(Boolean);

  const uniqueLanes = [...new Set(lanes)]
    .map((lane) => Number(lane))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  return uniqueLanes.length > 0 ? `เลน ${uniqueLanes.join(', ')}` : 'ไม่ระบุเลน';
}

function getRequestTimeLabel(booking) {
  const value = booking?.billingRequestedAt || booking?.Billing_Requested_At;
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function BillingRequestNotifier({ onOpenPayment }) {
  const notifiedIdsRef = useRef(new Set());
  const [requestQueue, setRequestQueue] = useState([]);
  const [activeRequest, setActiveRequest] = useState(null);

  useEffect(() => {
    const bookingsQuery = query(collection(db, 'bookings'), where('status', '==', 'occupied'));

    const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const requestedBookings = snapshot.docs
        .map((bookingDoc) => ({ id: bookingDoc.id, ...bookingDoc.data() }))
        .filter((booking) => booking.billingRequested || booking.Billing_Requested);

      const requestedIds = new Set(requestedBookings.map((booking) => booking.id));
      [...notifiedIdsRef.current].forEach((id) => {
        if (!requestedIds.has(id)) notifiedIdsRef.current.delete(id);
      });

      const newRequests = requestedBookings.filter((booking) => !notifiedIdsRef.current.has(booking.id));
      if (newRequests.length === 0) return;

      newRequests.forEach((booking) => notifiedIdsRef.current.add(booking.id));
      setRequestQueue((current) => [...current, ...newRequests]);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeRequest && requestQueue.length > 0) {
      setActiveRequest(requestQueue[0]);
      setRequestQueue((current) => current.slice(1));
    }
  }, [activeRequest, requestQueue]);

  const message = useMemo(() => {
    if (!activeRequest) return '';

    const requestTime = getRequestTimeLabel(activeRequest);
    const lines = [
      `${activeRequest.customerName || activeRequest.FullName || 'ลูกค้า'} แจ้งขอคิดเงิน`,
      `ตำแหน่ง: ${getLaneLabel(activeRequest)}`
    ];

    if (requestTime) lines.push(`เวลาที่แจ้ง: ${requestTime}`);
    lines.push('กรุณาตรวจสอบรายการในหน้าคิดเงินและจัดการรายได้');

    return lines.join('\n');
  }, [activeRequest]);

  const closeCurrentRequest = () => {
    setActiveRequest(null);
  };

  const goToPayment = () => {
    closeCurrentRequest();
    if (typeof onOpenPayment === 'function') onOpenPayment(activeRequest?.id || null);
  };

  return (
    <Popup
      isOpen={Boolean(activeRequest)}
      type="warning"
      title="มีลูกค้าแจ้งคิดเงิน"
      message={message}
      onConfirm={goToPayment}
      onCancel={closeCurrentRequest}
      confirmLabel="ไปหน้าคิดเงิน"
      cancelLabel="ปิด"
    />
  );
}

export default BillingRequestNotifier;
