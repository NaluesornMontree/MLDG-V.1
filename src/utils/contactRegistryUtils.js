import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import {
  getDuplicateEmailMessage,
  getDuplicatePhoneMessage,
  normalizeEmail,
  normalizePhoneNumber
} from './userPhoneUtils';

export const CONTACT_ERROR_CODES = {
  DUPLICATE_EMAIL: 'duplicate-email',
  DUPLICATE_PHONE: 'duplicate-phone',
  INVALID_PHONE: 'invalid-phone',
  PRECHECK_UNAVAILABLE: 'contact-precheck-unavailable'
};

export const createDuplicateContactError = (type, value) => {
  const error = new Error(type === 'phone' ? getDuplicatePhoneMessage(value) : getDuplicateEmailMessage(value));
  error.code = type === 'phone' ? CONTACT_ERROR_CODES.DUPLICATE_PHONE : CONTACT_ERROR_CODES.DUPLICATE_EMAIL;
  error.contactValue = value;
  return error;
};

export const createInvalidPhoneError = () => {
  const error = new Error('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก');
  error.code = CONTACT_ERROR_CODES.INVALID_PHONE;
  return error;
};

export const createContactPrecheckError = () => {
  const error = new Error('ระบบยังไม่สามารถตรวจสอบข้อมูลซ้ำได้ในขณะนี้ กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ');
  error.code = CONTACT_ERROR_CODES.PRECHECK_UNAVAILABLE;
  return error;
};

export const isContactError = (error) => (
  error?.code === CONTACT_ERROR_CODES.DUPLICATE_EMAIL ||
  error?.code === CONTACT_ERROR_CODES.DUPLICATE_PHONE ||
  error?.code === CONTACT_ERROR_CODES.INVALID_PHONE ||
  error?.code === CONTACT_ERROR_CODES.PRECHECK_UNAVAILABLE
);

const isOwnedByOtherUser = (snap, userId) => {
  if (!snap?.exists?.()) return false;
  const registryUserId = snap.data()?.User_ID || '';
  return !userId || registryUserId !== userId;
};

export const assertPhoneAvailableForSignup = async (db, phoneNumber) => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (normalizedPhone.length !== 10) throw createInvalidPhoneError();

  try {
    const phoneSnap = await getDoc(doc(db, 'phone_registry', normalizedPhone));
    if (phoneSnap.exists()) throw createDuplicateContactError('phone', normalizedPhone);
  } catch (error) {
    if (error?.code === 'permission-denied') throw createContactPrecheckError();
    throw error;
  }
};

export const assertEmailAvailableForSignup = async (db, email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  try {
    const emailSnap = await getDoc(doc(db, 'email_registry', normalizedEmail));
    if (emailSnap.exists()) throw createDuplicateContactError('email', normalizedEmail);
  } catch (error) {
    if (error?.code === 'permission-denied') throw createContactPrecheckError();
    throw error;
  }
};

export const saveUserProfileWithContactRegistry = async (db, userId, profileUpdates, options = {}) => {
  const { merge = true } = options;

  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await transaction.get(userRef);
    const existingData = userSnap.exists() ? userSnap.data() : {};

    const nextEmail = normalizeEmail(profileUpdates.Email ?? profileUpdates.email ?? existingData.Email ?? existingData.email);
    const nextPhone = normalizePhoneNumber(profileUpdates.PhoneNumber ?? profileUpdates.phone ?? existingData.PhoneNumber ?? existingData.phone);
    const currentEmail = normalizeEmail(existingData.Email ?? existingData.email);
    const currentPhone = normalizePhoneNumber(existingData.PhoneNumber ?? existingData.phone);

    if (nextPhone && nextPhone.length !== 10) throw createInvalidPhoneError();

    const nextEmailRef = nextEmail ? doc(db, 'email_registry', nextEmail) : null;
    const nextPhoneRef = nextPhone ? doc(db, 'phone_registry', nextPhone) : null;
    const currentEmailRef = currentEmail && currentEmail !== nextEmail ? doc(db, 'email_registry', currentEmail) : null;
    const currentPhoneRef = currentPhone && currentPhone !== nextPhone ? doc(db, 'phone_registry', currentPhone) : null;

    const nextEmailSnap = nextEmailRef ? await transaction.get(nextEmailRef) : null;
    const nextPhoneSnap = nextPhoneRef ? await transaction.get(nextPhoneRef) : null;
    const currentEmailSnap = currentEmailRef ? await transaction.get(currentEmailRef) : null;
    const currentPhoneSnap = currentPhoneRef ? await transaction.get(currentPhoneRef) : null;

    if (isOwnedByOtherUser(nextEmailSnap, userId)) {
      throw createDuplicateContactError('email', nextEmail);
    }

    if (isOwnedByOtherUser(nextPhoneSnap, userId)) {
      throw createDuplicateContactError('phone', nextPhone);
    }

    const normalizedUpdates = {
      ...profileUpdates,
      ...(nextEmail ? { Email: nextEmail } : {}),
      ...(nextPhone ? { PhoneNumber: nextPhone } : {})
    };

    if (currentEmailSnap?.exists?.() && currentEmailSnap.data()?.User_ID === userId) {
      transaction.delete(currentEmailRef);
    }

    if (currentPhoneSnap?.exists?.() && currentPhoneSnap.data()?.User_ID === userId) {
      transaction.delete(currentPhoneRef);
    }

    if (nextEmailRef) {
      transaction.set(nextEmailRef, {
        Email: nextEmail,
        User_ID: userId,
        UpdatedAt: serverTimestamp(),
        ...(nextEmailSnap?.exists?.() ? {} : { CreatedAt: serverTimestamp() })
      }, { merge: true });
    }

    if (nextPhoneRef) {
      transaction.set(nextPhoneRef, {
        PhoneNumber: nextPhone,
        User_ID: userId,
        UpdatedAt: serverTimestamp(),
        ...(nextPhoneSnap?.exists?.() ? {} : { CreatedAt: serverTimestamp() })
      }, { merge: true });
    }

    transaction.set(userRef, normalizedUpdates, { merge });
  });
};
