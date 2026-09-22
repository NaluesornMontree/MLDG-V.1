const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'muangloeigolf';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_BATCH_WRITES = 400;

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

function getUserId(doc) {
  const data = doc.data() || {};
  return data.User_ID || data.uid || data.userId || doc.id;
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

function createEmptySummary() {
  return {
    totalUsers: 0,
    phonesCreated: 0,
    emailsCreated: 0,
    phonesAlreadyValid: 0,
    emailsAlreadyValid: 0,
    missingPhone: 0,
    missingEmail: 0,
    invalidPhone: 0,
    invalidEmail: 0,
    conflicts: []
  };
}

function addConflict(summary, type, value, currentOwner, nextOwner, reason) {
  summary.conflicts.push({
    type,
    value,
    currentOwner,
    nextOwner,
    reason
  });
}

async function queueSet(writeState, ref, payload) {
  if (!writeState.shouldWrite) return;
  writeState.batch.set(ref, payload, { merge: true });
  writeState.pendingWrites += 1;

  if (writeState.pendingWrites >= MAX_BATCH_WRITES) {
    await writeState.batch.commit();
    writeState.batch = writeState.db.batch();
    writeState.pendingWrites = 0;
  }
}

async function flushWrites(writeState) {
  if (writeState.shouldWrite && writeState.pendingWrites > 0) {
    await writeState.batch.commit();
    writeState.pendingWrites = 0;
  }
}

async function backfillRegistry() {
  const admin = loadFirebaseAdmin();
  initializeAdmin(admin);

  const db = admin.firestore();
  const shouldWrite = hasFlag('--write');
  const limitValue = Number(readArg('--limit') || 0);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const summary = createEmptySummary();
  const localPhones = new Map();
  const localEmails = new Map();
  const writeState = {
    db,
    shouldWrite,
    batch: db.batch(),
    pendingWrites: 0
  };

  let usersQuery = db.collection('users');
  if (Number.isFinite(limitValue) && limitValue > 0) {
    usersQuery = usersQuery.limit(limitValue);
  }

  const usersSnapshot = await usersQuery.get();
  summary.totalUsers = usersSnapshot.size;

  for (const userDoc of usersSnapshot.docs) {
    const data = userDoc.data() || {};
    const userId = getUserId(userDoc);
    const phone = getUserPhone(data);
    const email = getUserEmail(data);

    if (!phone) {
      summary.missingPhone += 1;
    } else if (phone.length !== 10) {
      summary.invalidPhone += 1;
      addConflict(summary, 'phone', phone, '', userId, 'เบอร์โทรใน users ไม่ครบ 10 หลัก');
    } else if (localPhones.has(phone) && localPhones.get(phone) !== userId) {
      addConflict(summary, 'phone', phone, localPhones.get(phone), userId, 'พบเบอร์โทรซ้ำใน collection users');
    } else {
      localPhones.set(phone, userId);
      const phoneRef = db.collection('phone_registry').doc(phone);
      const phoneSnap = await phoneRef.get();

      if (phoneSnap.exists && phoneSnap.data().User_ID && phoneSnap.data().User_ID !== userId) {
        addConflict(summary, 'phone', phone, phoneSnap.data().User_ID, userId, 'phone_registry มีเจ้าของคนอื่นอยู่แล้ว');
      } else {
        if (phoneSnap.exists) summary.phonesAlreadyValid += 1;
        else summary.phonesCreated += 1;

        await queueSet(writeState, phoneRef, {
          PhoneNumber: phone,
          User_ID: userId,
          UpdatedAt: now,
          ...(phoneSnap.exists ? {} : { CreatedAt: now })
        });
      }
    }

    if (!email) {
      summary.missingEmail += 1;
    } else if (!EMAIL_PATTERN.test(email)) {
      summary.invalidEmail += 1;
      addConflict(summary, 'email', email, '', userId, 'อีเมลใน users มีรูปแบบไม่ถูกต้อง');
    } else if (localEmails.has(email) && localEmails.get(email) !== userId) {
      addConflict(summary, 'email', email, localEmails.get(email), userId, 'พบอีเมลซ้ำใน collection users');
    } else {
      localEmails.set(email, userId);
      const emailRef = db.collection('email_registry').doc(email);
      const emailSnap = await emailRef.get();

      if (emailSnap.exists && emailSnap.data().User_ID && emailSnap.data().User_ID !== userId) {
        addConflict(summary, 'email', email, emailSnap.data().User_ID, userId, 'email_registry มีเจ้าของคนอื่นอยู่แล้ว');
      } else {
        if (emailSnap.exists) summary.emailsAlreadyValid += 1;
        else summary.emailsCreated += 1;

        await queueSet(writeState, emailRef, {
          Email: email,
          User_ID: userId,
          UpdatedAt: now,
          ...(emailSnap.exists ? {} : { CreatedAt: now })
        });
      }
    }
  }

  await flushWrites(writeState);

  console.log(shouldWrite ? 'เขียน registry เรียบร้อย' : 'DRY RUN: ยังไม่ได้เขียนข้อมูลลง Firestore');
  console.log(JSON.stringify(summary, null, 2));

  if (!shouldWrite) {
    console.log('ถ้าผลตรวจสอบถูกต้องแล้ว ให้รันใหม่โดยเพิ่ม --write');
  }

  if (summary.conflicts.length > 0) {
    process.exitCode = 2;
  }
}

backfillRegistry().catch((error) => {
  console.error('Backfill contact registry failed:');
  console.error(error);
  process.exit(1);
});
