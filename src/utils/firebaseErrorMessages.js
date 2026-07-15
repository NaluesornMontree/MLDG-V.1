const AUTH_ERROR_MESSAGES = {
  'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง',
  'auth/user-not-found': 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ กรุณาตรวจสอบอีเมลอีกครั้ง',
  'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง',
  'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกอีเมลให้ถูกต้อง',
  'auth/missing-email': 'กรุณากรอกอีเมลก่อนดำเนินการ',
  'auth/missing-password': 'กรุณากรอกรหัสผ่านก่อนดำเนินการ',
  'auth/email-already-in-use': 'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบด้วยอีเมลนี้',
  'auth/weak-password': 'รหัสผ่านสั้นหรือเดาง่ายเกินไป กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร',
  'auth/too-many-requests': 'มีการพยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
  'auth/network-request-failed': 'ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  'auth/popup-closed-by-user': 'หน้าต่างเข้าสู่ระบบถูกปิดก่อนทำรายการเสร็จ กรุณาลองใหม่อีกครั้ง',
  'auth/popup-blocked': 'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ กรุณาอนุญาต popup แล้วลองใหม่',
  'auth/cancelled-popup-request': 'มีหน้าต่างเข้าสู่ระบบเปิดอยู่แล้ว กรุณาดำเนินการจากหน้าต่างเดิม',
  'auth/account-exists-with-different-credential': 'อีเมลนี้เคยสมัครด้วยวิธีอื่นแล้ว กรุณาเข้าสู่ระบบด้วยวิธีเดิม',
  'auth/credential-already-in-use': 'บัญชีนี้ถูกเชื่อมกับผู้ใช้งานอื่นแล้ว กรุณาติดต่อผู้ดูแลระบบ',
  'auth/operation-not-allowed': 'ระบบยังไม่ได้เปิดใช้งานวิธีเข้าสู่ระบบนี้ กรุณาติดต่อผู้ดูแลระบบ',
  'auth/requires-recent-login': 'เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่ก่อนทำรายการนี้',
};

export function getFirebaseAuthErrorMessage(error, fallbackMessage = 'เกิดข้อผิดพลาดในการทำรายการ กรุณาลองใหม่อีกครั้ง') {
  const code = error?.code || extractAuthCode(error?.message);
  return AUTH_ERROR_MESSAGES[code] || fallbackMessage;
}

export function normalizeFirebaseErrorMessage(message) {
  const text = String(message || '');
  const code = extractAuthCode(text);

  if (!code) return text;

  const readableMessage = AUTH_ERROR_MESSAGES[code];
  if (!readableMessage) return text;

  if (text.includes('Google')) return `การเข้าสู่ระบบด้วย Google ไม่สำเร็จ: ${readableMessage}`;
  if (text.includes('Facebook')) return `การเข้าสู่ระบบด้วย Facebook ไม่สำเร็จ: ${readableMessage}`;
  if (text.includes('รีเซ็ต') || text.toLowerCase().includes('reset')) return `ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้: ${readableMessage}`;

  return readableMessage;
}

function extractAuthCode(text = '') {
  const match = String(text).match(/auth\/[a-z0-9-]+/i);
  return match ? match[0] : '';
}
