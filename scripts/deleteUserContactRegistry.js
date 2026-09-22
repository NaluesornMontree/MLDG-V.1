const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'muangloeigolf';

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizePhoneNumber(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function getUserEmail(data = {}) {
  return normalizeEmail(data.Email || data.email || data.Customer_Email || '');
}

function getUserPhone(data = {}) {
  return normalizePhoneNumber(data.PhoneNumber || data.phoneNumber || data.phone || data.Customer_Phone || '');
}

function loadFirebaseAdmin() {
  try {
    return require('firebase-admin');
  } catch (error) {
    console.error('ไม่พบ package firebase-admin');
    console.error('ให้ติดตั้งก่อนด้วยคำสั่ง: npm install firebase-admin --save-dev');
    process.exit(1);
  }
}

function initializeAdmin(admin) {
  const serviceAccountPath = readArg('--service-account') || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountPath) {
    const resolvedPath = path.resolve(serviceAccountPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`ไม่พบไฟล์ service account: ${resolvedPath}`);
      process.exit(1);
    }

    const serviceAccount = require(resolvedPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || PROJECT_ID
    });
    return;
  }

  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || PROJECT_ID });
}

function getDeleteTargets(userId, userData) {
  const emailArg = normalizeEmail(readArg('--email'));
  const phoneArg = normalizePhoneNumber(readArg('--phone'));

  return {
    email: emailArg || getUserEmail(userData),
    phone: phoneArg || getUserPhone(userData),
    userId
  };
}

function canDeleteRegistry(registrySnap, userId) {
  if (!registrySnap.exists) return true;
  if (!userId) return true;

  const registryOwner = registrySnap.data()?.User_ID || '';
  return registryOwner === userId;
}

async function deleteUserContactRegistry() {
  const admin = loadFirebaseAdmin();
  initializeAdmin(admin);

  const db = admin.firestore();
  const shouldWrite = hasFlag('--write');
  const shouldDeleteAuth = hasFlag('--delete-auth');
  const userId = readArg('--user-id') || readArg('--uid');
  const emailArg = normalizeEmail(readArg('--email'));
  const phoneArg = normalizePhoneNumber(readArg('--phone'));

  if (!userId && !emailArg && !phoneArg) {
    console.error('กรุณาระบุอย่างน้อยหนึ่งค่า: --user-id, --email หรือ --phone');
    process.exit(1);
  }

  const userRef = userId ? db.collection('users').doc(userId) : null;
  const userSnap = userRef ? await userRef.get() : null;
  const userData = userSnap?.exists ? userSnap.data() : {};
  const targets = getDeleteTargets(userId, userData);

  const emailRef = targets.email ? db.collection('email_registry').doc(targets.email) : null;
  const phoneRef = targets.phone ? db.collection('phone_registry').doc(targets.phone) : null;
  const emailSnap = emailRef ? await emailRef.get() : null;
  const phoneSnap = phoneRef ? await phoneRef.get() : null;

  const summary = {
    mode: shouldWrite ? 'WRITE' : 'DRY_RUN',
    input: {
      userId: userId || '',
      email: emailArg || '',
      phone: phoneArg || ''
    },
    resolvedTargets: targets,
    found: {
      user: Boolean(userSnap?.exists),
      emailRegistry: Boolean(emailSnap?.exists),
      phoneRegistry: Boolean(phoneSnap?.exists)
    },
    willDelete: {
      user: Boolean(userRef && userSnap?.exists),
      emailRegistry: Boolean(emailRef && emailSnap?.exists && canDeleteRegistry(emailSnap, userId)),
      phoneRegistry: Boolean(phoneRef && phoneSnap?.exists && canDeleteRegistry(phoneSnap, userId)),
      authUser: Boolean(shouldDeleteAuth && userId)
    },
    skipped: []
  };

  if (emailSnap?.exists && !canDeleteRegistry(emailSnap, userId)) {
    summary.skipped.push({
      target: 'email_registry',
      id: targets.email,
      reason: `เจ้าของ registry เป็น ${emailSnap.data()?.User_ID || '-'} ไม่ตรงกับ userId ที่ระบุ`
    });
  }

  if (phoneSnap?.exists && !canDeleteRegistry(phoneSnap, userId)) {
    summary.skipped.push({
      target: 'phone_registry',
      id: targets.phone,
      reason: `เจ้าของ registry เป็น ${phoneSnap.data()?.User_ID || '-'} ไม่ตรงกับ userId ที่ระบุ`
    });
  }

  if (shouldWrite) {
    await db.runTransaction(async (transaction) => {
      if (summary.willDelete.user) transaction.delete(userRef);
      if (summary.willDelete.emailRegistry) transaction.delete(emailRef);
      if (summary.willDelete.phoneRegistry) transaction.delete(phoneRef);
    });

    if (shouldDeleteAuth && userId) {
      try {
        await admin.auth().deleteUser(userId);
      } catch (error) {
        summary.skipped.push({
          target: 'auth',
          id: userId,
          reason: error?.code === 'auth/user-not-found' ? 'ไม่พบ Auth user นี้' : error.message
        });
      }
    }
  }

  console.log(shouldWrite ? 'ลบข้อมูลตามรายการเรียบร้อย' : 'DRY RUN: ยังไม่ได้ลบข้อมูลจริง');
  console.log(JSON.stringify(summary, null, 2));

  if (!shouldWrite) {
    console.log('ถ้าผลตรวจสอบถูกต้องแล้ว ให้รันใหม่โดยเพิ่ม --write');
  }

  if (summary.skipped.length > 0) {
    process.exitCode = 2;
  }
}

deleteUserContactRegistry().catch((error) => {
  console.error('Delete user contact registry failed:');
  console.error(error);
  process.exit(1);
});
