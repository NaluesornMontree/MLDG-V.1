import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase'; 
import { onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore"; 
import Auth from './components/Auth';
import OwnerDashboard from './components/OwnerDashboard'; 
import StaffDashboard from './components/StaffDashboard';
import CustomerDashboard from './components/CustomerDashboard'; 
import LaneManagement from './components/LaneManagement';
import ReviewManagement from './components/ReviewManagement';
import Popup from './components/Popup';
import EmailActionHandler from './components/EmailActionHandler';
import { normalizeFirebaseErrorMessage } from './utils/firebaseErrorMessages';
import {
  consumeEmailActionResult,
  getEmailActionCodeSettings,
  getEmailActionRequest
} from './utils/emailActionUtils';

function getAlertType(message) {
  const text = String(message || '').toLowerCase();
  if (
    text.includes('ผิดพลาด') ||
    text.includes('ไม่สามารถ') ||
    text.includes('ผิดพลาด') ||
    text.includes('ไม่สามารถ') ||
    text.includes('ไม่ถูกต้อง') ||
    text.includes('ไม่สำเร็จ') ||
    text.includes('ไม่พบ') ||
    text.includes('ถูกระงับ') ||
    text.includes('บล็อก') ||
    text.includes('error') ||
    text.includes('failed') ||
    text.includes('ถูกระงับ') ||
    text.includes('ยกเลิกบิล')
  ) {
    return 'danger';
  }

  if (
    text.includes('กรุณา') ||
    text.includes('ยังไม่') ||
    text.includes('ต้อง') ||
    text.includes('warning')
  ) {
    return 'warning';
  }

  return 'info';
}

function getAlertTitle(type) {
  if (type === 'danger') return 'เกิดข้อผิดพลาด';
  if (type === 'warning') return 'แจ้งเตือน';
  return 'แจ้งเตือนจากระบบ';
}

const dispatchAppAlert = (message = '') => {
  if (typeof window === 'undefined') return;
  const alertItem = { id: Date.now() + Math.random(), message };
  window.__appAlertQueue = [...(window.__appAlertQueue || []), alertItem];
  window.dispatchEvent(new CustomEvent('app-alert', { detail: alertItem }));
};

if (typeof window !== 'undefined') {
  window.appAlert = dispatchAppAlert;
}

function BrowserAlertPopupBridge() {
  const [popupQueue, setPopupQueue] = useState([]);

  useEffect(() => {
    const enqueueAlert = ({ id, message = '' } = {}) => {
      const text = String(message || '');
      const readableText = normalizeFirebaseErrorMessage(text);
      const type = getAlertType(`${text} ${readableText}`);
      setPopupQueue((currentQueue) => [
        ...currentQueue,
        {
          id: id || Date.now() + Math.random(),
          type,
          title: getAlertTitle(type),
          message: readableText
        }
      ]);
    };
    const nativeAlert = window.alert;
    const handleAppAlert = (event) => {
      const alertItem = event.detail || {};
      window.__appAlertQueue = (window.__appAlertQueue || []).filter((item) => item.id !== alertItem.id);
      enqueueAlert(alertItem);
    };

    window.addEventListener('app-alert', handleAppAlert);
    window.alert = dispatchAppAlert;
    const pendingAlerts = window.__appAlertQueue || [];
    window.__appAlertQueue = [];
    pendingAlerts.forEach(enqueueAlert);

    return () => {
      window.removeEventListener('app-alert', handleAppAlert);
      window.alert = nativeAlert;
    };
  }, []);

  const activePopup = popupQueue[0];
  const dismissActivePopup = () => {
    if (!activePopup) return;
    window.__appAlertQueue = (window.__appAlertQueue || []).filter((item) => item.id !== activePopup.id);
    setPopupQueue((currentQueue) => currentQueue.slice(1));
  };

  return (
    <Popup
      isOpen={Boolean(activePopup)}
      type={activePopup?.type}
      title={activePopup?.title}
      message={activePopup?.message}
      onConfirm={dismissActivePopup}
    />
  );
}

function PublicPortal({ onLoginRequest }) {
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);

  const heroSlides = [
    { src: '/shop-hero.jpg', alt: 'เมืองเลยไดร์ฟกอล์ฟ' },
    { src: '/shop-gallery-1.jpg', alt: 'บรรยากาศร้านเมืองเลยไดร์ฟกอล์ฟ 1' },
    { src: '/shop-gallery-2.jpg', alt: 'บรรยากาศร้านเมืองเลยไดร์ฟกอล์ฟ 2' },
    { src: '/shop-gallery-3.jpg', alt: 'บรรยากาศร้านเมืองเลยไดร์ฟกอล์ฟ 3' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlideIndex((current) => (current + 1) % heroSlides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const handleScrollToPublicInfo = (event) => {
    event.preventDefault();
    document.getElementById('public-info')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <main>
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-emerald-950 shadow-xl">
            {heroSlides.map((slide, index) => (
              <img
                key={slide.src}
                src={slide.src}
                alt={slide.alt}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  index === heroSlideIndex ? 'opacity-100' : 'opacity-0'
                }`}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                  const fallback = event.currentTarget.parentElement?.querySelector('[data-shop-hero-fallback]');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ))}

            <div className="relative h-[500px] sm:h-[800px]">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/95 via-emerald-950/50 to-transparent" />
              <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-start px-5 pt-4 sm:px-8 sm:pt-6 lg:px-12 lg:pt-8">
                <div className="order-2 mt-4 flex w-full flex-col gap-3 sm:mt-5">
                  <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      ['15', 'เลนซ้อม'],
                      ['08:00-19:00', 'เวลาให้บริการ'],
                      ['Online', 'จองล่วงหน้า']
                    ].map(([value, label]) => (
                      <div key={label} className="rounded-3xl border border-white/20 bg-white/15 p-4 shadow-sm backdrop-blur">
                        <div className="text-lg font-black text-white sm:text-xl">{value}</div>
                        <div className="mt-1 text-[11px] font-bold text-emerald-50/85">{label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={onLoginRequest}
                      className="rounded-2xl border border-white/20 bg-white/15 px-6 py-3 text-sm font-black text-white shadow-sm backdrop-blur transition-all hover:bg-white/25"
                    >
                      จองเลนซ้อมออนไลน์
                    </button>
                    <a
                      href="#public-info"
                      onClick={handleScrollToPublicInfo}
                      className="rounded-2xl border border-white/20 bg-white/15 px-6 py-3 text-center text-sm font-black text-white shadow-sm backdrop-blur transition-all hover:bg-white/25"
                    >
                      ตรวจสอบตารางเลน
                    </a>
                  </div>
                </div>

                <div className="order-1 w-full">
                  <div className="mb-3 flex w-full flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="inline-flex w-fit rounded-2xl border border-white/20 bg-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-50 backdrop-blur">
                      Driving Range & Golf Practice
                    </div>
                    <button
                      type="button"
                      onClick={onLoginRequest}
                      className="inline-flex w-fit rounded-2xl border border-white/20 bg-white/15 px-4 py-2 text-[11px] font-black text-white shadow-sm backdrop-blur transition-all hover:bg-white/25 sm:px-5 sm:text-xs"
                    >
                      เข้าสู่ระบบ / สมัครสมาชิก
                    </button>
                  </div>
                  <h2 className="max-w-4xl font-black leading-tight text-white drop-shadow-sm">
                    <span className="block text-3xl sm:text-5xl lg:text-6xl">เมืองเลยไดร์ฟกอล์ฟ</span>
                    <span className="mt-2 block text-xl sm:text-3xl lg:text-4xl">สนามสำหรับฝึกซ้อมกีฬากอล์ฟ</span>
                    <span className="block text-xl sm:text-3xl lg:text-4xl">พร้อมระบบจองเลนซ้อมออนไลน์</span>
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-emerald-50/90 sm:text-base">
                    ตรวจสอบสถานะเลนซ้อมได้ก่อนเดินทาง ดูคะแนนและความคิดเห็นจากลูกค้า และเข้าสู่ระบบสมาชิกเพื่อจองวันเวลาใช้งานได้สะดวกยิ่งขึ้น
                  </p>
                </div>
              </div>

              <div className="absolute bottom-4 right-5 z-10 flex gap-2 sm:bottom-6 sm:right-8">
                {heroSlides.map((slide, index) => (
                  <span
                    key={slide.src}
                    className={`h-2.5 rounded-full transition-all ${
                      index === heroSlideIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/45 hover:bg-white/75'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              ['ตรวจสอบเลนก่อนมาใช้บริการ', 'ดูสถานะเลนซ้อมแบบอัปเดตตามระบบ ช่วยวางแผนวันและเวลาฝึกซ้อมได้ง่ายขึ้น'],
              ['จองออนไลน์สำหรับสมาชิก', 'สมาชิกสามารถเลือกวัน เวลา เลนซ้อม จำนวนผู้เข้าใช้ และบริการเสริมได้จากหน้าเว็บ'],
              ['รีวิวและคะแนนจากลูกค้า', 'ตรวจสอบประสบการณ์จากผู้ใช้บริการจริงก่อนตัดสินใจเข้าใช้สนามซ้อม']
            ].map(([title, description]) => (
              <div key={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
                  <span className="h-3 w-3 rounded-full bg-emerald-600" />
                </div>
                <h3 className="text-base font-black text-slate-900">{title}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((index) => (
              <div key={index} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              </div>
            ))}
          </div>
        </section>

        <section id="public-info" className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
          <LaneManagement publicView onLoginRequest={onLoginRequest} />
          <div className="mt-6">
            <ReviewManagement publicView />
          </div>
        </section>
      </main>
    </div>
  );
}

function AppContent() {
  const [emailActionResult] = useState(() => consumeEmailActionResult());
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [showAuth, setShowAuth] = useState(() => Boolean(emailActionResult?.requiresLogin));
  const [authTransitioning, setAuthTransitioning] = useState(false);
  const [passwordResetPopup, setPasswordResetPopup] = useState({
    isOpen: false,
    email: '',
    sending: false,
    notice: '',
    error: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data()); 
          } else {
            console.error("ไม่พบข้อมูลผู้ใช้ในระบบฐานข้อมูล");
            setUserData(null);
          }
        } catch (error) {
          console.error("เกิดข้อผิดพลาดในการดึงข้อมูลจาก Firestore:", error);
          setUserData(null);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!emailActionResult?.message) return;
    window.appAlert(emailActionResult.message);
  }, [emailActionResult]);

  const handleLogout = () => {
    signOut(auth).then(() => window.appAlert("ออกจากระบบเรียบร้อยแล้ว"));
  };

  const handleBackToLoginFromVerification = () => {
    if (authTransitioning) return;

    setAuthTransitioning(true);
    window.setTimeout(async () => {
      setShowAuth(true);
      try {
        await signOut(auth);
        window.appAlert("ออกจากหน้าตรวจสอบอีเมลแล้ว");
      } finally {
        window.setTimeout(() => setAuthTransitioning(false), 80);
      }
    }, 260);
  };

  const handlePasswordResetEmailSent = async (email) => {
    setPasswordResetPopup({
      isOpen: true,
      email,
      sending: false,
      notice: 'ส่งอีเมลเปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาตรวจสอบกล่องข้อความหรืออีเมลขยะ',
      error: ''
    });

    try {
      await signOut(auth);
    } catch (error) {
      setPasswordResetPopup((current) => ({
        ...current,
        error: 'ส่งอีเมลสำเร็จแล้ว แต่ไม่สามารถออกจากระบบอัตโนมัติได้ กรุณากดออกจากระบบด้วยตนเอง'
      }));
    }
  };

  const handleResendPasswordResetEmail = async () => {
    if (!passwordResetPopup.email) return;

    setPasswordResetPopup((current) => ({
      ...current,
      sending: true,
      notice: '',
      error: ''
    }));

    try {
      await sendPasswordResetEmail(auth, passwordResetPopup.email);
      setPasswordResetPopup((current) => ({
        ...current,
        sending: false,
        notice: 'ส่งอีเมลเปลี่ยนรหัสผ่านอีกครั้งแล้ว กรุณาตรวจสอบกล่องข้อความหรืออีเมลขยะ',
        error: ''
      }));
    } catch (error) {
      setPasswordResetPopup((current) => ({
        ...current,
        sending: false,
        notice: '',
        error:
          error.code === 'auth/too-many-requests'
            ? 'มีการส่งอีเมลหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง'
            : error.code === 'auth/network-request-failed'
              ? 'ไม่สามารถส่งอีเมลได้เนื่องจากปัญหาเครือข่าย กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
              : 'ไม่สามารถส่งอีเมลเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง'
      }));
    }
  };

  const handlePasswordResetEmailReceived = () => {
    setPasswordResetPopup({
      isOpen: false,
      email: '',
      sending: false,
      notice: '',
      error: ''
    });
    setShowAuth(true);
  };

  const handleOpenAuth = () => {
    if (authTransitioning) return;

    setAuthTransitioning(true);
    window.setTimeout(() => {
      setShowAuth(true);
      setAuthTransitioning(false);
      window.scrollTo({ top: 0, left: 0 });
    }, 280);
  };

  const handleCloseAuth = () => {
    if (authTransitioning) return;

    setAuthTransitioning(true);
    window.setTimeout(() => {
      setShowAuth(false);
      setAuthTransitioning(false);
      window.scrollTo({ top: 0, left: 0 });
    }, 240);
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;

    setResendingVerification(true);
    try {
      await sendEmailVerification(auth.currentUser, getEmailActionCodeSettings());
      window.appAlert("ส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจสอบกล่องจดหมายหลักและกล่องจดหมายขยะ");
    } catch (error) {
      window.appAlert("ไม่สามารถส่งอีเมลยืนยันซ้ำได้: " + error.message);
    } finally {
      setResendingVerification(false);
    }
  };

  const handleRefreshVerification = async () => {
    if (!auth.currentUser) return;

    setCheckingVerification(true);
    try {
      await auth.currentUser.reload();

      if (!auth.currentUser.emailVerified) {
        window.appAlert("ยังไม่พบการยืนยันอีเมล กรุณาเปิดอีเมลและกดลิงก์ยืนยันตัวตนก่อน แล้วจึงกลับมาตรวจสอบสถานะอีกครั้ง");
        return;
      }

      window.appAlert("ยืนยันอีเมลสำเร็จแล้ว ระบบกำลังนำคุณเข้าสู่ระบบ");
      window.location.reload();
    } catch (error) {
      window.appAlert("ไม่สามารถตรวจสอบสถานะอีเมลได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง");
    } finally {
      setCheckingVerification(false);
    }
  };

  const passwordResetPopupElement = passwordResetPopup.isOpen ? (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm modal-overlay-transition">
      <div className="modal-card-transition w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-2xl sm:p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
          <span className="h-3 w-3 rounded-full bg-emerald-600" />
        </div>
        <h3 className="text-lg font-black text-slate-900">ส่งอีเมลเปลี่ยนรหัสผ่านแล้ว</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
          ระบบออกจากระบบเพื่อความปลอดภัยแล้ว กรุณาตรวจสอบอีเมล
          <span className="mx-1 font-black text-slate-800">{passwordResetPopup.email}</span>
          หากยังไม่ได้รับสามารถกดส่งอีเมลอีกครั้งได้
        </p>

        {passwordResetPopup.notice && (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold leading-relaxed text-emerald-700">
            {passwordResetPopup.notice}
          </div>
        )}

        {passwordResetPopup.error && (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold leading-relaxed text-rose-600">
            {passwordResetPopup.error}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleResendPasswordResetEmail}
            disabled={passwordResetPopup.sending}
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:bg-slate-300 disabled:text-white"
          >
            {passwordResetPopup.sending ? 'กำลังส่งอีเมล...' : 'ส่งอีเมลอีกครั้ง'}
          </button>
          <button
            type="button"
            onClick={handlePasswordResetEmailReceived}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
          >
            ได้รับอีเมลแล้ว
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const withPasswordResetPopup = (content) => (
    <>
      {content}
      {passwordResetPopupElement}
    </>
  );

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-emerald-900 text-white font-bold animate-pulse">
      MUANG LOEI DRIVE GOLF IS LOADING...
    </div>
  );

  // กรณีที่ 1: ยังไม่ได้เข้าสู่ระบบ ให้ดูหน้าสาธารณะได้ก่อน
  if (!user) {
    if (showAuth) {
      return withPasswordResetPopup(
        <div className={`min-h-screen bg-slate-50 transition-all duration-300 ease-out motion-safe:animate-[screenEnter_0.35s_ease-out] ${authTransitioning ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'}`}>
          <div className="fixed left-4 top-4 z-50 sm:left-6 sm:top-6">
            <button
              type="button"
              onClick={handleCloseAuth}
              className="rounded-2xl border border-white/25 bg-white/90 px-4 py-2.5 text-xs font-black text-emerald-900 shadow-lg shadow-emerald-950/10 backdrop-blur transition-all hover:bg-white sm:px-5"
            >
              กลับไปหน้าตรวจสอบสนาม
            </button>
          </div>
          <Auth />
        </div>
      );
    }

    return withPasswordResetPopup(
      <div className={`transition-all duration-300 ease-out motion-safe:animate-[screenEnter_0.35s_ease-out] ${authTransitioning ? '-translate-y-6 opacity-0' : 'translate-y-0 opacity-100'}`}>
        <PublicPortal onLoginRequest={handleOpenAuth} />
      </div>
    );
  }

  // กรณีที่ 2: เข้าสู่ระบบแล้ว แต่ยังไม่ได้ยืนยันอีเมล
  if (!user.emailVerified) {
    return withPasswordResetPopup(
      <div className="flex h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 p-6">
        <div className={`w-full max-w-sm rounded-[2rem] border-t-8 border-amber-500 bg-white p-6 text-center shadow-2xl transition-all duration-300 ease-in-out motion-safe:animate-[screenEnter_0.38s_cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none sm:rounded-[3rem] sm:p-10 ${authTransitioning ? '-translate-y-4 scale-[0.985] opacity-0' : 'translate-y-0 scale-100 opacity-100'}`}>
          <h2 className="text-xl font-black text-slate-800">กรุณายืนยันอีเมลของคุณ</h2>
          <p className="text-sm text-slate-500 my-4">
            ระบบได้ส่งลิงก์ยืนยันตัวตนไปที่อีเมลของท่านแล้ว กรุณาตรวจสอบในกล่องจดหมายหลัก หรือกล่องจดหมายขยะ จากนั้นกดยืนยันลิงก์ก่อนเข้าใช้งานระบบ
          </p>
          <div className="space-y-3">
            <button
              onClick={handleResendVerification}
              disabled={resendingVerification}
              className="w-full rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold tracking-wider text-white shadow-md transition-all hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {resendingVerification ? 'กำลังส่งอีเมล...' : 'ส่งอีเมลยืนยันอีกครั้ง'}
            </button>
            <button
              onClick={handleRefreshVerification}
              disabled={checkingVerification}
              className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {checkingVerification ? 'กำลังตรวจสอบสถานะ...' : 'ฉันกดยืนยันแล้ว ตรวจสอบสถานะ'}
            </button>
            <button 
              onClick={handleBackToLoginFromVerification}
              disabled={authTransitioning}
              className="w-full rounded-2xl bg-slate-800 px-6 py-3 text-sm font-bold tracking-wider text-white shadow-md transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ดักจับสิทธิ์จากฐานข้อมูลและแปลงเป็นตัวพิมพ์เล็กเพื่อตรวจสอบความถูกต้อง
  const rawRole = userData?.Role || userData?.role || '';
  const role = rawRole.trim().toLowerCase(); 

  // กรณีที่ 3: ผ่านการตรวจสอบแล้ว แยกการสลับหน้าแดชบอร์ดให้ตรงตามสิทธิ์จริง
  if (role === 'owner') {
    return withPasswordResetPopup(<OwnerDashboard user={user} userData={userData} handleLogout={handleLogout} onPasswordResetEmailSent={handlePasswordResetEmailSent} />);
  } else if (role === 'staff') {
    return withPasswordResetPopup(<StaffDashboard user={user} userData={userData} handleLogout={handleLogout} onPasswordResetEmailSent={handlePasswordResetEmailSent} />);
  } else {
    return withPasswordResetPopup(<CustomerDashboard user={user} userData={userData} handleLogout={handleLogout} onPasswordResetEmailSent={handlePasswordResetEmailSent} />);
  }
}

function App() {
  const emailAction = getEmailActionRequest();

  return (
    <>
      {emailAction ? <EmailActionHandler action={emailAction} /> : <AppContent />}
      <BrowserAlertPopupBridge />
    </>
  );
}

export default App;
