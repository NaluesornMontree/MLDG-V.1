import { collection, getDocs, query, where } from 'firebase/firestore';

export const normalizePhoneNumber = (value = '') => String(value || '').replace(/\D/g, '');

export const getDuplicatePhoneMessage = (phoneNumber) => (
  `เบอร์โทรศัพท์ ${phoneNumber} ถูกใช้ในระบบแล้ว กรุณาใช้เบอร์อื่น`
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
