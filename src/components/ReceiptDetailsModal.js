import React from 'react';
import { toWholeNumber } from '../utils/numberUtils';
import {
  getPaymentItemQuantity,
  getPaymentItemTotal,
  getPaymentItemUnit,
  getPaymentItemUnitPrice
} from '../utils/paymentItemUtils';

const STATUS_STYLES = {
  pending: 'border-slate-200 bg-slate-100 text-slate-600',
  confirmed: 'border-blue-200 bg-blue-50 text-blue-700',
  occupied: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-600',
  billing_cancelled: 'border-rose-200 bg-rose-50 text-rose-600',
  maintenance: 'border-slate-300 bg-slate-200 text-slate-600'
};

const STATUS_LABELS = {
  pending: 'รอตรวจสอบ',
  confirmed: 'ยืนยันแล้ว',
  occupied: 'กำลังใช้งาน',
  completed: 'เสร็จสิ้น',
  active: 'ชำระสำเร็จ',
  cancelled: 'ยกเลิกการจอง',
  billing_cancelled: 'ยกเลิกบิล',
  maintenance: 'ปิดปรับปรุง'
};

const BOOKING_TYPE_LABELS = {
  'phone-reservation': 'จองล่วงหน้า',
  'member-lane-activation': 'สมาชิกหน้าร้าน',
  'walk-in': 'Walk-in',
  online: 'ออนไลน์',
  manual_income: 'รายได้อื่น ๆ'
};

function getValue(source, keys, fallback = '') {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source[key] !== '') {
      return source[key];
    }
  }
  return fallback;
}

function getTimestampLabel(value) {
  if (!value) return '-';

  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return '-';
  }
}

function timeToMinutes(time) {
  const [hour, minute] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.MAX_SAFE_INTEGER;
  return (hour * 60) + minute;
}

function compactTimeSlots(value) {
  const slots = Array.isArray(value)
    ? value.filter(Boolean)
    : typeof value === 'string' && value.trim()
      ? value.split(',').map((slot) => slot.trim()).filter(Boolean)
      : [];

  if (slots.length === 0) return '-';

  const normalized = [...new Set(slots)].sort((a, b) => {
    const [aStart] = String(a).split('-');
    const [bStart] = String(b).split('-');
    return timeToMinutes(aStart) - timeToMinutes(bStart);
  });

  const ranges = [];
  let rangeStart = normalized[0];
  let rangeEnd = normalized[0];

  normalized.slice(1).forEach((slot) => {
    const previousEnd = String(rangeEnd).split('-')[1];
    const currentStart = String(slot).split('-')[0];
    if (previousEnd && currentStart && previousEnd === currentStart) {
      rangeEnd = slot;
      return;
    }

    const start = String(rangeStart).split('-')[0];
    const end = String(rangeEnd).split('-')[1];
    ranges.push(start && end ? `${start}-${end}` : rangeStart);
    rangeStart = slot;
    rangeEnd = slot;
  });

  const start = String(rangeStart).split('-')[0];
  const end = String(rangeEnd).split('-')[1];
  ranges.push(start && end ? `${start}-${end}` : rangeStart);
  return ranges.join(', ');
}

function getLaneNumber(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function getLaneLabel(value) {
  const laneNumber = getLaneNumber(value);
  if (Number.isFinite(laneNumber) && laneNumber !== Number.MAX_SAFE_INTEGER) {
    return `เลน ${laneNumber}`;
  }
  return String(value || 'ไม่ระบุเลน').replace(/^lane_/i, 'เลน ');
}

function getScheduleRows(booking, payment) {
  const detailedSlots = getValue(payment, ['Lane_Time_Slots', 'laneTimeSlots'], null)
    || getValue(booking, ['detailedSlots', 'Detailed_Slots', 'laneTimeSlots'], null);

  if (detailedSlots && typeof detailedSlots === 'object' && !Array.isArray(detailedSlots)) {
    const rows = Object.entries(detailedSlots)
      .filter(([, slots]) => Array.isArray(slots) && slots.length > 0)
      .map(([lane, slots]) => ({ lane: getLaneLabel(lane), time: compactTimeSlots(slots) }))
      .sort((a, b) => getLaneNumber(a.lane) - getLaneNumber(b.lane));
    if (rows.length > 0) return rows;
  }

  const bookingLanes = getValue(booking, ['selectedLanes'], null);
  const laneValues = Array.isArray(bookingLanes) && bookingLanes.length > 0
    ? bookingLanes
    : String(getValue(payment, ['Lane_Code', 'laneCode'], getValue(booking, ['laneNumber', 'laneNum'], '')))
        .match(/\d+/g) || [];
  const slots = getValue(payment, ['Time_Slots', 'timeSlots', 'TimeSlots'], getValue(booking, ['timeSlots'], []));

  if (laneValues.length > 0) {
    return laneValues
      .map((lane) => ({ lane: getLaneLabel(lane), time: compactTimeSlots(slots) }))
      .sort((a, b) => getLaneNumber(a.lane) - getLaneNumber(b.lane));
  }

  return [{
    lane: getValue(payment, ['Lane_Code', 'laneCode'], getValue(booking, ['laneNumber'], 'ไม่ระบุเลน')),
    time: compactTimeSlots(slots)
  }];
}

function getCashierLabel(payment) {
  if (!payment) return 'ยังไม่มีข้อมูลการชำระเงิน';
  const name = getValue(payment, ['Cashier_Name', 'cashierName', 'Processed_By_Name'], '');
  const role = getValue(payment, ['Cashier_Role', 'cashierRole', 'Processed_By_Role'], '');
  if (!name && !role) return 'ไม่ระบุผู้รับชำระ';
  return `${name || 'ไม่ระบุชื่อ'}${role ? ` (${String(role).toUpperCase()})` : ''}`;
}

function ReceiptDetailsModal({
  booking = null,
  payment = null,
  title = 'ใบเสร็จรายละเอียดการจอง',
  subtitle = '',
  onClose,
  onPrimaryAction = null,
  primaryActionLabel = 'บันทึกใบเสร็จ',
  primaryActionDisabled = false,
  disabledActionLabel = 'รอรับชำระเงิน'
}) {
  if (!booking && !payment) return null;

  const customerName = getValue(booking, ['customerName', 'FullName'], getValue(payment, ['FullName'], 'ไม่ระบุชื่อ'));
  const customerEmail = getValue(booking, ['customerEmail', 'Email', 'email'], getValue(payment, ['Customer_Email', 'Email', 'email'], 'ไม่มีอีเมล'));
  const customerPhone = getValue(booking, ['customerPhone', 'PhoneNumber', 'phone'], getValue(payment, ['Customer_Phone', 'PhoneNumber', 'phone'], 'ไม่มีเบอร์โทร'));
  const guestCount = Math.max(1, toWholeNumber(getValue(booking, ['guestCount', 'guests'], getValue(payment, ['Guest_Count'], 1))));
  const rentedClubs = getValue(booking, ['rentedClubs'], getValue(payment, ['Rented_Clubs'], []));
  const needsClubRent = Boolean(getValue(payment, ['Needs_Club_Rent', 'needsClubRent'], getValue(booking, ['needsClubRent'], Array.isArray(rentedClubs) && rentedClubs.length > 0)));
  const needsInstructor = Boolean(getValue(payment, ['Needs_Instructor', 'needsInstructor'], getValue(booking, ['needsInstructor'], false)));
  const paymentCancelled = payment?.status === 'cancelled';
  const statusKey = paymentCancelled
    ? 'billing_cancelled'
    : getValue(booking, ['status'], getValue(payment, ['status'], payment ? 'active' : 'pending'));
  const bookingType = getValue(booking, ['bookingType'], getValue(payment, ['Booking_Type', 'Source_Type'], 'online'));
  const scheduleRows = getScheduleRows(booking, payment);
  const paymentNote = getValue(payment, ['Cancel_Reason', 'cancelReason', 'Description', 'description'], '');
  const items = Array.isArray(payment?.Items_List) ? payment.Items_List : [];
  const computedSubtitle = subtitle || `บันทึกเมื่อ: ${getTimestampLabel(payment?.Payment_Date || booking?.createdAt)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-900/60 p-2 backdrop-blur-sm modal-overlay-transition sm:p-4">
      <div className="modal-card-transition flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#fcfcfb] text-left shadow-2xl">
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-800 sm:text-xl">{title}</h3>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400 sm:text-xs">{computedSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="h-8 w-8 shrink-0 rounded-xl border border-slate-200 bg-slate-50 text-base font-black text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 sm:p-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)]">
          <div className="space-y-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Booking Info</p>
              <h4 className="mt-0.5 text-sm font-black text-slate-800">ข้อมูลการจอง</h4>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <InfoBox label="ชื่อลูกค้า" value={customerName} />
                <InfoBox label="รูปแบบการจอง" value={BOOKING_TYPE_LABELS[bookingType] || BOOKING_TYPE_LABELS.online} />
                <InfoBox label="อีเมล" value={customerEmail} />
                <InfoBox label="เบอร์โทรศัพท์" value={customerPhone} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Lane Schedule</p>
              <h4 className="mt-0.5 text-sm font-black text-slate-800">เลนและช่วงเวลาใช้งาน</h4>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-2">
                  {scheduleRows.map((row, index) => (
                    <div key={`${row.lane}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-2">
                      <span className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">{row.lane}</span>
                      <span className="min-w-0 text-right text-xs font-black text-slate-700">{row.time}</span>
                    </div>
                  ))}
                </div>
                <InfoBox label="จำนวนผู้เข้าใช้" value={`${guestCount} ท่าน`} />
              </div>
            </section>

            {Array.isArray(rentedClubs) && rentedClubs.length > 0 && (
              <section className="rounded-2xl border border-emerald-100 bg-white p-3 sm:p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-500">Rental Clubs</p>
                <h4 className="mt-0.5 text-sm font-black text-slate-800">รายการไม้กอล์ฟที่เลือกเช่า</h4>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {rentedClubs.map((club, index) => (
                    <div key={`${club.Club_Name || club.name || 'club'}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                      <div className="min-w-0 break-words text-sm font-black text-emerald-800">{club.Club_Name || club.name || 'ไม่ระบุชื่อไม้กอล์ฟ'}</div>
                      <div className="shrink-0 rounded-lg border border-emerald-200 bg-white/90 px-2.5 py-1 text-xs font-black text-emerald-700">
                        {toWholeNumber(club.qty || club.quantity || 0)} ชิ้น
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {paymentNote && (
              <section className={`rounded-2xl border bg-white p-3 sm:p-4 ${paymentCancelled ? 'border-rose-200' : 'border-slate-200'}`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${paymentCancelled ? 'text-rose-500' : 'text-slate-400'}`}>Note</p>
                <h4 className="mt-0.5 text-sm font-black text-slate-800">{paymentCancelled ? 'เหตุผลการยกเลิกบิล' : 'หมายเหตุเพิ่มเติม'}</h4>
                <div className={`mt-2 whitespace-pre-wrap rounded-xl px-3 py-2.5 text-xs font-bold leading-relaxed ${paymentCancelled ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}`}>
                  {paymentNote}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-3">
            <aside className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Status</p>
              <h4 className="mt-0.5 text-sm font-black text-slate-800">สรุปสถานะการจอง</h4>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="mb-1 text-[10px] font-black text-slate-400">สถานะปัจจุบัน</div>
                  <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-black ${STATUS_STYLES[statusKey] || STATUS_STYLES.pending}`}>
                    {STATUS_LABELS[statusKey] || 'ไม่ระบุสถานะ'}
                  </span>
                </div>
                <InfoBox label="ผู้รับชำระเงิน" value={getCashierLabel(payment)} compact />
                <ServiceBox label="เช่าไม้กอล์ฟ" enabled={needsClubRent} color="emerald" />
                <ServiceBox label="ผู้สอนพื้นฐานการเล่นกอล์ฟ" enabled={needsInstructor} color="indigo" />
              </div>
            </aside>

            <aside className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Payment Summary</p>
              <h4 className="mt-0.5 text-sm font-black text-slate-800">รายการชำระเงินและสรุปยอด</h4>
              {!payment ? (
                <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">
                  ยังไม่มีข้อมูลการชำระเงินสำหรับรายการนี้
                </div>
              ) : (
                <div className="mt-2 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="border-b border-slate-200 pb-2">
                    <div className="mb-1.5 text-[10px] font-black text-slate-500">รายละเอียดค่าบริการ</div>
                    {items.length > 0 ? (
                      <div className="space-y-1.5">
                        {items.map((item, index) => (
                          <div key={`${item.item_name || item.name || 'item'}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-black text-slate-800">{item.item_name || item.name || '-'}</div>
                              <div className="mt-0.5 text-[10px] font-bold text-slate-500">
                                ราคา {getPaymentItemUnitPrice(item).toLocaleString('th-TH')} บาท/{getPaymentItemUnit(item)} · จำนวน {getPaymentItemQuantity(item).toLocaleString('th-TH')} {getPaymentItemUnit(item)}
                              </div>
                            </div>
                            <div className="shrink-0 text-sm font-black text-emerald-700">
                              {getPaymentItemTotal(item).toLocaleString('th-TH')} บาท
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-center text-[11px] font-bold text-slate-400">
                        ไม่พบรายละเอียดค่าบริการในรายการนี้
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <AmountBox label="ยอดรวม" value={`${toWholeNumber(payment.Total_Amount || 0).toLocaleString()} บาท`} />
                    <AmountBox label="ส่วนลดแต้ม" value={`${toWholeNumber(payment.Point_Discount || 0).toLocaleString()} บาท`} />
                    <AmountBox label="แต้มที่ได้รับ" value={`+${toWholeNumber(payment.Earned_Points || 0).toLocaleString()} PTS`} accent />
                  </div>

                  {(payment.Payment_Method === 'รวมทั้งสอง' || toWholeNumber(payment.Cash_Amount || 0) > 0 || toWholeNumber(payment.Transfer_Amount || 0) > 0) && (
                    <div className="grid grid-cols-2 gap-2">
                      <AmountBox label="เงินสด" value={`${toWholeNumber(payment.Cash_Amount || 0).toLocaleString()} บาท`} />
                      <AmountBox label="เงินโอน" value={`${toWholeNumber(payment.Transfer_Amount || 0).toLocaleString()} บาท`} />
                    </div>
                  )}

                  <div className="flex justify-between gap-3 text-xs font-bold text-slate-600">
                    <span>วิธีชำระเงิน</span>
                    <span className="text-right">{payment.Payment_Method || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                    <span className="text-sm font-black text-slate-800">ยอดสุทธิที่ชำระ</span>
                    <span className="whitespace-nowrap text-lg font-black text-emerald-700">{toWholeNumber(payment.Net_Amount || 0).toLocaleString()} บาท</span>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          {onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              disabled={primaryActionDisabled}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {primaryActionDisabled ? disabledActionLabel : primaryActionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-5 py-2 text-xs font-black text-slate-600 transition-all hover:bg-slate-200"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, compact = false }) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-100 bg-slate-50 ${compact ? 'px-3 py-2' : 'px-3 py-2.5'}`}>
      <div className="mb-1 text-[10px] font-black text-slate-400">{label}</div>
      <div className={`${compact ? 'text-xs' : 'text-sm'} break-words font-black text-slate-800`}>{value || '-'}</div>
    </div>
  );
}

function ServiceBox({ label, enabled, color }) {
  const isEmerald = color === 'emerald';
  const enabledStyle = isEmerald
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-indigo-200 bg-indigo-50 text-indigo-700';

  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2 ${enabled ? enabledStyle : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
      <div className="mb-1 text-[10px] font-black text-slate-400">{label}</div>
      <div className="text-xs font-black">{enabled ? 'ต้องการ' : 'ไม่ต้องการ'}</div>
    </div>
  );
}

function AmountBox({ label, value, accent = false }) {
  return (
    <div className={`rounded-xl px-2.5 py-2 ${accent ? 'bg-emerald-50' : 'bg-white'}`}>
      <div className={`text-[9px] font-black ${accent ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</div>
      <div className={`mt-0.5 whitespace-nowrap text-xs font-black ${accent ? 'text-emerald-800' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

export default ReceiptDetailsModal;
