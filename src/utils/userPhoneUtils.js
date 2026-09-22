import { collection, getDocs, query, where } from 'firebase/firestore';

export const normalizePhoneNumber = (value = '') => String(value || '').replace(/\D/g, '');
export const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();
export const isValidEmailFormat = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(value));

export const getDuplicatePhoneMessage = (phoneNumber) => (
  `เบอร์โทรศัพท์ ${phoneNumber} ถูกใช้ในระบบแล้ว กรุณาใช้เบอร์อื่น`
);

export const getDuplicateEmailMessage = (email) => (
  `อีเมล ${email} ถูกใช้ในระบบแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบด้วยอีเมลนี้`
);

export const findUserByPhoneNumber = async (db, phoneNumber, excludeUserId = '') => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const rawPhone = String(phoneNumber || '').trim();

  if (!normalizedPhone && !rawPhone) return null;

  const phoneFields = ['PhoneNumber', 'phoneNumber', 'phone'];
  const phoneValues = [...new Set([normalizedPhone, rawPhone].filter(Boolean))];

  for (const fieldName of phoneFields) {
    for (const phoneValue of phoneValues) {
      const snap = await getDocs(query(collection(db, 'users'), where(fieldName, '==', phoneValue)));

      for (const userDoc of snap.docs) {
        const data = userDoc.data();
        const storedUserId = data.User_ID || data.uid || userDoc.id;

        if (excludeUserId && (userDoc.id === excludeUserId || storedUserId === excludeUserId)) {
          continue;
        }

        return { id: userDoc.id, ...data };
      }
    }
  }

  return null;
};

export const findUserByEmail = async (db, email, excludeUserId = '') => {
  const normalizedEmail = normalizeEmail(email);
  const rawEmail = String(email || '').trim();

  if (!normalizedEmail && !rawEmail) return null;

  const emailFields = ['Email', 'email'];
  const emailValues = [...new Set([normalizedEmail, rawEmail].filter(Boolean))];

  for (const fieldName of emailFields) {
    for (const emailValue of emailValues) {
      const snap = await getDocs(query(collection(db, 'users'), where(fieldName, '==', emailValue)));

      for (const userDoc of snap.docs) {
        const data = userDoc.data();
        const storedUserId = data.User_ID || data.uid || userDoc.id;

        if (excludeUserId && (userDoc.id === excludeUserId || storedUserId === excludeUserId)) {
          continue;
        }

        return { id: userDoc.id, ...data };
      }
    }
  }

  return null;
};
