require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const webpush = require('web-push');
const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

const dbRepo = require('./db');
const aiAssistant = require('./aiAssistant');

const app = express();
const PORT = process.env.PORT || 3050;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure all API responses disable caching completely so clients never get stale draft state
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Request & Response Logging Middleware (Logs IP, User-Agent, Headers, Request Body, and Response to Database)
app.use((req, res, next) => {
  // Ignore static assets like images, icons, styles, scripts to avoid noise
  const urlPath = req.path || '';
  const isStatic = urlPath.match(/\.(css|js|ico|png|jpg|jpeg|svg|webp|woff|woff2|ttf|map)$/i);
  if (isStatic) {
    return next();
  }

  const startTime = Date.now();
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '').toString().split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || '';

  // Intercept response body
  let responseCapturedBody = '';
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function (chunk) {
    if (chunk) {
      if (typeof chunk === 'string') {
        responseCapturedBody = chunk.length > 2000 ? chunk.slice(0, 2000) + '... [truncated]' : chunk;
      } else if (Buffer.isBuffer(chunk)) {
        responseCapturedBody = `[Binary/Buffer data: ${chunk.length} bytes]`;
      } else {
        try {
          const str = JSON.stringify(chunk);
          responseCapturedBody = str.length > 2000 ? str.slice(0, 2000) + '... [truncated]' : str;
        } catch (e) {
          responseCapturedBody = '[Non-serializable response]';
        }
      }
    }
    return originalSend.apply(res, arguments);
  };

  res.json = function (obj) {
    try {
      const str = JSON.stringify(obj);
      responseCapturedBody = str.length > 2000 ? str.slice(0, 2000) + '... [truncated]' : str;
    } catch (e) {
      responseCapturedBody = '[Non-serializable JSON]';
    }
    return originalJson.apply(res, arguments);
  };

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const sanitizedHeaders = { ...req.headers };
    // Mask sensitive passwords if present
    if (sanitizedHeaders.authorization) {
      sanitizedHeaders.authorization = sanitizedHeaders.authorization.slice(0, 15) + '...';
    }

    let safeReqBody = null;
    if (req.body && typeof req.body === 'object') {
      try {
        const bodyClone = JSON.parse(JSON.stringify(req.body));
        if (bodyClone.password) bodyClone.password = '***masked***';
        if (bodyClone.adminPassword) bodyClone.adminPassword = '***masked***';
        safeReqBody = bodyClone;
      } catch (e) {
        safeReqBody = req.body;
      }
    }

    const logEntry = {
      ip: clientIp,
      userAgent: userAgent,
      method: req.method,
      path: req.originalUrl || req.url,
      headers: sanitizedHeaders,
      requestBody: safeReqBody,
      statusCode: res.statusCode,
      responseBody: responseCapturedBody,
      durationMs: durationMs,
      timestamp: new Date().toISOString()
    };

    // Store in DB asynchronously without blocking
    dbRepo.addRequestLog(logEntry).catch(logErr => {
      console.error('Request logging error:', logErr.message);
    });
  });

  next();
});

// Initialize database tables & default data
dbRepo.initDatabaseTables().catch(err => {
  console.error('Database initialization notice:', err.message);
});

// Initialize Firebase Admin SDK
let firebaseApp = null;
let firebaseMessaging = null;

try {
  let saData = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const rawVal = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    if (rawVal.startsWith('{')) {
      try {
        saData = JSON.parse(rawVal);
      } catch (e1) {
        try {
          saData = JSON.parse(rawVal.replace(/\\n/g, '\n'));
        } catch (e2) { }
      }
    } else {
      try {
        saData = JSON.parse(Buffer.from(rawVal, 'base64').toString('utf8'));
      } catch (e3) { }
    }
  }

  if (!saData || !saData.project_id) {
    const isVercel = Boolean(process.env.VERCEL);
    const dataDir = isVercel ? path.join(os.tmpdir(), 'task_automation_data') : path.join(__dirname, 'data');
    const saCandidates = [
      path.join(dataDir, 'firebase_service_account.json'),
      path.join(__dirname, 'data', 'firebase_service_account.json')
    ];
    for (const p of saCandidates) {
      if (fs.existsSync(p)) {
        try {
          saData = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (saData && saData.project_id) break;
        } catch { }
      }
    }
  }

  if (saData && saData.project_id) {
    firebaseApp = initializeApp({
      credential: cert(saData)
    });
    firebaseMessaging = getMessaging(firebaseApp);
    console.log('✅ Firebase Admin SDK initialized for project:', saData.project_id);
  } else {
    console.log('ℹ️ Firebase service account not found; FCM admin not active.');
  }
} catch (fbErr) {
  console.error('⚠️ Firebase Admin SDK initialization error:', fbErr.message);
}

// Initialize VAPID Keys for Web Push Notifications
let vapidKeys = { publicKey: '', privateKey: '' };
(async () => {
  try {
    const keys = await dbRepo.getVapidKeys();
    if (keys && keys.publicKey && keys.privateKey) {
      vapidKeys = keys;
    } else {
      vapidKeys = webpush.generateVAPIDKeys();
      await dbRepo.saveVapidKeys(vapidKeys);
    }
    webpush.setVapidDetails(
      'mailto:admin@taskautomation.local',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (vapidErr) {
    console.error('Error setting up VAPID keys:', vapidErr.message);
  }
})();

// Helper: Format Date DD/MM/YYYY in Asia/Kolkata / Local timezone
function getFormattedToday(dateObj = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return formatter.format(dateObj);
  } catch (e) {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

// Helper: Format ISO Date YYYY-MM-DD
function getIsoDate(dateObj = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(dateObj);
  } catch (e) {
    return dateObj.toISOString().split('T')[0];
  }
}

// Helper: Format 24h time string (e.g. "18:15") to 12h display string (e.g. "6:15 PM")
function formatTimeDisplay(timeStr) {
  if (!timeStr) return '6:15 PM';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

// Helper: Check if current time in Asia/Kolkata is after cutoff time (6:28 PM)
async function isAfterCutoffTime() {
  try {
    const config = await dbRepo.getConfig();
    const cutoff = config.reminderTime || '18:28';
    const [cutoffH, cutoffM] = cutoff.split(':').map(Number);

    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now);

    const curH = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const curM = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

    const currentTotalMin = curH * 60 + curM;
    const cutoffTotalMin = cutoffH * 60 + cutoffM;

    return currentTotalMin >= cutoffTotalMin;
  } catch (e) {
    return false;
  }
}

// Helper: Check if current time in Asia/Kolkata is after auto-leave cutoff time (6:25 PM) on a working day
async function isAfterAutoLeaveTime() {
  try {
    const config = await dbRepo.getConfig();
    const autoLeave = config.autoLeaveTime || '18:25';
    const [leaveH, leaveM] = autoLeave.split(':').map(Number);

    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now);

    const weekdayStr = parts.find(p => p.type === 'weekday')?.value || '';
    const isWorkingDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekdayStr);
    if (!isWorkingDay) return false;

    const curH = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const curM = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

    const currentTotalMin = curH * 60 + curM;
    const leaveTotalMin = leaveH * 60 + leaveM;

    return currentTotalMin >= leaveTotalMin;
  } catch (e) {
    return false;
  }
}

// Helper: Auto-mark pending employees who have not sent an update today as ON LEAVE
async function autoMarkPendingEmployeesLeave(targetDate = getFormattedToday()) {
  try {
    const draft = await dbRepo.getDailyDraft(targetDate);
    draft.date = targetDate;
    if (!Array.isArray(draft.teamData)) {
      draft.teamData = [];
    }

    const allUsers = await dbRepo.getUsers();
    let modified = false;
    const nowIso = new Date().toISOString();

    allUsers.forEach(user => {
      const userNameUpper = (user.name || '').toUpperCase().trim();
      if (!userNameUpper) return;

      const existingIndex = draft.teamData.findIndex(
        m => m && m.name && m.name.toUpperCase().trim() === userNameUpper
      );

      const existingMember = existingIndex >= 0 ? draft.teamData[existingIndex] : null;
      const hasTasks = existingMember && Array.isArray(existingMember.projects) && existingMember.projects.some(p => Array.isArray(p.tasks) && p.tasks.length > 0);
      const hasNote = existingMember && Boolean(existingMember.note && existingMember.note.trim());

      // If member already has tasks or note, do not overwrite
      if (hasTasks || hasNote) {
        return;
      }

      // Member hasn't sent an update today: mark ON LEAVE
      const leaveEntry = {
        name: userNameUpper,
        role: (existingMember && existingMember.role) || user.role || '',
        note: 'ON LEAVE',
        projects: [],
        attachments: [],
        updatedAt: nowIso
      };

      if (existingIndex >= 0) {
        draft.teamData[existingIndex] = leaveEntry;
      } else {
        draft.teamData.push(leaveEntry);
      }
      modified = true;
    });

    if (modified) {
      const sortedTeamData = dbRepo.sortTeamDataByRoster(draft.teamData);
      const newVersion = (draft.version || 0) + 1;
      await dbRepo.saveDailyDraft(targetDate, sortedTeamData, newVersion, nowIso);
      console.log(`📝 [Auto-Leave] Marked pending employees as ON LEAVE for ${targetDate}`);
      return { updated: true, teamData: sortedTeamData };
    }
    return { updated: false, teamData: draft.teamData };
  } catch (err) {
    console.error('Error auto-marking pending employees as ON LEAVE:', err.message);
    return { updated: false, error: err.message };
  }
}

// Helper: Get set of member names who have already submitted their status update today
async function getTodaySubmittedMembersSet() {
  const submitted = new Set();
  const today = getFormattedToday();

  try {
    const draft = await dbRepo.getDailyDraft(today);
    if (draft && draft.date === today && Array.isArray(draft.teamData)) {
      draft.teamData.forEach(m => {
        if (m && m.name) {
          const hasTasks = Array.isArray(m.projects) && m.projects.some(p => Array.isArray(p.tasks) && p.tasks.length > 0);
          const hasNote = Boolean(m.note && m.note.trim());
          if (hasTasks || hasNote) {
            submitted.add(m.name.trim().toUpperCase());
          }
        }
      });
    }
  } catch (e) {
    console.error('Error reading draft for submitted members:', e.message);
  }

  try {
    const logs = await dbRepo.getSubmissions({ period: 'daily' });
    logs.forEach(log => {
      if (log.member) {
        submitted.add(log.member.trim().toUpperCase());
      }
    });
  } catch (e) {
    console.error('Error reading submissions log:', e.message);
  }

  return submitted;
}

// Push notification sender to employees
async function sendPushToEmployees(payload, options = {}) {
  const subs = await dbRepo.getPushSubscriptions();
  const validSubs = [];
  const fcmTokens = [];
  const seenEndpoints = new Set();
  const seenFcmTokens = new Set();
  let sentCount = 0;

  const targetMember = options.targetMember ? options.targetMember.toUpperCase().trim() : '';

  let submittedSet = new Set();
  if (options.onlyPendingToday) {
    submittedSet = await getTodaySubmittedMembersSet();
  }

  for (const sub of subs) {
    if (sub.role === 'admin') {
      validSubs.push(sub);
      continue;
    }

    const mUpper = (sub.member || '').toUpperCase().trim();

    // If specific targetMember is given, filter by that member
    if (targetMember && mUpper !== targetMember) {
      validSubs.push(sub);
      continue;
    }

    // If only pending members should receive the reminder:
    // 1. If sub.member is mapped and member already submitted today, skip!
    // 2. If sub.member is empty, skip unassigned subscriptions during pending reminders to prevent sending to submitted users.
    if (options.onlyPendingToday) {
      if (!mUpper || submittedSet.has(mUpper)) {
        validSubs.push(sub);
        continue;
      }
    }

    if (sub.fcmToken) {
      if (!seenFcmTokens.has(sub.fcmToken)) {
        seenFcmTokens.add(sub.fcmToken);
        fcmTokens.push({ token: sub.fcmToken, subRecord: sub });
      }
      continue;
    }

    if (sub.subscription && sub.subscription.endpoint) {
      if (seenEndpoints.has(sub.subscription.endpoint)) {
        continue;
      }
      seenEndpoints.add(sub.subscription.endpoint);

      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
        validSubs.push(sub);
        sentCount++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`Cleaned up expired push subscription for ${sub.member || 'employee'}`);
          await dbRepo.removePushSubscription(sub.subscription.endpoint, null);
        } else {
          console.error(`Push error to ${sub.member || 'employee'}:`, err.message);
          validSubs.push(sub);
        }
      }
    }
  }

  // Send to FCM devices
  if (firebaseMessaging && fcmTokens.length > 0) {
    const tokenStrings = fcmTokens.map(t => t.token);
    try {
      const fcmResponse = await firebaseMessaging.sendEachForMulticast({
        tokens: tokenStrings,
        notification: {
          title: payload.title || '⏰ Daily Status Task Reminder',
          body: payload.body || 'Please submit your task report.'
        },
        data: {
          url: payload.url || '/submit',
          tag: payload.tag || 'employee-reminder'
        },
        webpush: {
          fcmOptions: {
            link: payload.url || '/submit'
          }
        }
      });
      sentCount += fcmResponse.successCount;
      for (let idx = 0; idx < fcmResponse.responses.length; idx++) {
        const resp = fcmResponse.responses[idx];
        if (resp.success) {
          validSubs.push(fcmTokens[idx].subRecord);
        } else {
          const errCode = resp.error ? resp.error.code : '';
          if (errCode === 'messaging/invalid-registration-token' ||
              errCode === 'messaging/registration-token-not-registered') {
            console.log(`Cleaned up invalid FCM token for ${fcmTokens[idx].subRecord.member || 'employee'}`);
            await dbRepo.removePushSubscription(null, fcmTokens[idx].token);
          } else {
            validSubs.push(fcmTokens[idx].subRecord);
          }
        }
      }
    } catch (fcmErr) {
      console.error('FCM Multicast error to employees:', fcmErr.message);
    }
  }

  return sentCount;
}

// Push notification sender to admin
async function sendPushToAdmins(payload) {
  const subs = await dbRepo.getPushSubscriptions();
  const validSubs = [];
  const fcmTokens = [];
  let sentCount = 0;

  for (const sub of subs) {
    if (sub.role !== 'admin') {
      validSubs.push(sub);
      continue;
    }

    if (sub.fcmToken) {
      fcmTokens.push({ token: sub.fcmToken, subRecord: sub });
      continue;
    }

    if (sub.subscription && sub.subscription.endpoint) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
        validSubs.push(sub);
        sentCount++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`Cleaned up expired push subscription for admin`);
          await dbRepo.removePushSubscription(sub.subscription.endpoint, null);
        } else {
          console.error('Push error to admin:', err.message);
          validSubs.push(sub);
        }
      }
    }
  }

  if (firebaseMessaging && fcmTokens.length > 0) {
    const tokenStrings = fcmTokens.map(t => t.token);
    try {
      const fcmResponse = await firebaseMessaging.sendEachForMulticast({
        tokens: tokenStrings,
        notification: {
          title: payload.title || '🔔 Scrum Admin Alert',
          body: payload.body || 'New task submission received.'
        },
        data: {
          url: payload.url || '/',
          tag: payload.tag || 'admin-alert'
        },
        webpush: {
          fcmOptions: {
            link: payload.url || '/'
          }
        }
      });
      sentCount += fcmResponse.successCount;
      for (let idx = 0; idx < fcmResponse.responses.length; idx++) {
        const resp = fcmResponse.responses[idx];
        if (resp.success) {
          validSubs.push(fcmTokens[idx].subRecord);
        } else {
          const errCode = resp.error ? resp.error.code : '';
          if (errCode === 'messaging/invalid-registration-token' ||
              errCode === 'messaging/registration-token-not-registered') {
            console.log(`Cleaned up invalid FCM token for admin`);
            await dbRepo.removePushSubscription(null, fcmTokens[idx].token);
          } else {
            validSubs.push(fcmTokens[idx].subRecord);
          }
        }
      }
    } catch (fcmErr) {
      console.error('FCM Multicast error to admins:', fcmErr.message);
    }
  }

  return sentCount;
}

// Token Helpers (Permanent Session Tokens)
function generateUserToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    role: user.role || '',
    sig: 'scrum_auth_v1'
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

async function verifyUserToken(tokenStr) {
  if (!tokenStr) return null;
  try {
    const raw = Buffer.from(tokenStr, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && parsed.sig === 'scrum_auth_v1') {
      const match = await dbRepo.getUserByName(parsed.name);
      return match || { name: parsed.name, role: parsed.role || '' };
    }
    return null;
  } catch (e) {
    return null;
  }
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Redirect /submit
app.get('/submit', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'submit.html'));
});

// Get system IP info
app.get('/api/info', (req, res) => {
  const localIp = getLocalIp();
  res.json({
    localIp,
    isNeonDb: dbRepo.isDbConnected(),
    submitUrl: `http://${localIp}:${PORT}/submit`,
    adminUrl: `http://localhost:${PORT}`
  });
});

// Send Message to Google Chat via Webhook
app.post('/api/send-chat', async (req, res) => {
  try {
    const { webhookUrl, text } = req.body;

    if (!webhookUrl || !webhookUrl.startsWith('https://chat.googleapis.com/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Google Chat Webhook URL. It must start with https://chat.googleapis.com/'
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message text cannot be empty.'
      });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text: text.trim() }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `Google Chat API error (${response.status}): ${errBody}`
      });
    }

    const responseData = await response.json();

    // Auto save to history database
    const newEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      formattedText: text,
      status: 'Sent to Google Chat'
    };
    await dbRepo.addHistory(newEntry);

    return res.json({
      success: true,
      message: 'Successfully delivered to Google Chat space!',
      data: responseData
    });
  } catch (error) {
    console.error('Error sending to Google Chat:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error'
    });
  }
});

// -----------------------------------------------------------------------------
// Authentication & User Management APIs
// -----------------------------------------------------------------------------
app.post('/api/auth/admin-login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(401).json({ success: false, error: 'Password is required.' });
    }
    const inputPass = String(password).trim();
    const config = await dbRepo.getConfig();
    const users = await dbRepo.getUsers();
    const nisargUser = users.find(u => u.name && u.name.toUpperCase() === 'NISARG');

    const validPasswords = new Set([
      'nisarg@2002',
      'admin123',
      (config.adminPassword || '').trim(),
      (nisargUser && nisargUser.password ? nisargUser.password.trim() : '')
    ].filter(Boolean));

    if (!validPasswords.has(inputPass)) {
      return res.status(401).json({ success: false, error: 'Incorrect Admin password.' });
    }
    const adminToken = Buffer.from(JSON.stringify({ role: 'admin', ts: Date.now(), sig: 'scrum_admin_v1' })).toString('base64url');
    res.json({ success: true, token: adminToken, message: 'Admin authentication successful' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { member, password } = req.body;
    if (!member || !password) {
      return res.status(400).json({ success: false, error: 'Member name and password are required.' });
    }

    const user = await dbRepo.getUserByName(member);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Employee name not found in team roster.' });
    }

    if (user.password && user.password !== password.trim()) {
      return res.status(401).json({ success: false, error: 'Incorrect password. Please verify with your Scrum Master.' });
    }

    const token = generateUserToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role || ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token;
    const user = await verifyUserToken(token);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid.' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await dbRepo.getUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users/update', async (req, res) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users)) {
      return res.status(400).json({ success: false, error: 'Invalid users array.' });
    }
    await dbRepo.saveUsers(users);
    res.json({ success: true, message: 'User credentials updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check submission status, user draft, and lock state
async function getMemberSubmissionStatus(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token;
    const authUser = await verifyUserToken(token);
    const memberName = (req.query.member || (authUser ? authUser.name : '')).toUpperCase().trim();

    const config = await dbRepo.getConfig();
    const cutoffTime = config.reminderTime || '18:28';
    const locked = await isAfterCutoffTime();

    let existingSubmission = null;
    let todayStatus = { submitted: false };

    if (memberName) {
      const todayDate = getFormattedToday();
      const draft = await dbRepo.getDailyDraft(todayDate);
      const found = (draft.teamData || []).find(m => m.name && m.name.toUpperCase().trim() === memberName);
      if (found) {
        const hasTasks = Array.isArray(found.projects) && found.projects.some(p => Array.isArray(p.tasks) && p.tasks.length > 0);
        const hasNote = Boolean(found.note && found.note.trim());
        const isSubmitted = hasTasks || hasNote;

        let rawText = '';
        (found.projects || []).forEach(p => {
          rawText += `${p.name}:-\n`;
          (p.tasks || []).forEach(t => {
            const tText = typeof t === 'string' ? t : (t.text || '');
            const tStatus = typeof t === 'string' ? 'Done' : (t.status || 'Done');
            rawText += `${tText} => ${tStatus}\n`;
          });
          rawText += '\n';
        });

        existingSubmission = {
          member: found.name,
          role: found.role || '',
          note: found.note || '',
          projects: found.projects || [],
          rawText: rawText.trim(),
          attachments: Array.isArray(found.attachments) ? found.attachments : []
        };

        todayStatus = {
          submitted: isSubmitted,
          note: found.note || '',
          projects: found.projects || [],
          attachments: Array.isArray(found.attachments) ? found.attachments : []
        };
      }
    }

    res.json({
      success: true,
      isLocked: locked,
      cutoffTime: cutoffTime,
      existingSubmission: existingSubmission,
      todayStatus: todayStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

app.get('/api/submission-status', getMemberSubmissionStatus);
app.get('/api/user-status', getMemberSubmissionStatus);

// Member Direct Submission API from /submit
app.post('/api/submit-task', async (req, res) => {
  try {
    const { member, project, tasks, projects, note, password, token, rawText, attachments } = req.body;
    if (!member) {
      return res.status(400).json({ success: false, error: 'Member name is required.' });
    }

    // Cutoff Enforcement: Submissions/Edits close at cutoff time
    if (await isAfterCutoffTime()) {
      const config = await dbRepo.getConfig();
      const cutoffStr = formatTimeDisplay(config.reminderTime || '18:15');
      return res.status(403).json({
        success: false,
        isLocked: true,
        error: `Submissions closed for today at ${cutoffStr} (Daily status report is already compiled and dispatched). Please contact Scrum Master Nisarg if emergency edits are needed.`
      });
    }

    // Auth Validation: Verify user token or password
    const authHeader = req.headers.authorization || '';
    const authToken = authHeader.replace(/^Bearer\s+/i, '') || token;
    let authUser = await verifyUserToken(authToken);

    if (!authUser && password) {
      const userMatch = await dbRepo.getUserByName(member);
      if (userMatch && userMatch.password === password.trim()) {
        authUser = userMatch;
      }
    }

    // If caller has an auth token, prevent them from submitting under other employee names
    if (authUser && authUser.name.toUpperCase() !== member.toUpperCase().trim()) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: You are logged in as ${authUser.name}. You cannot submit tasks on behalf of ${member}.`
      });
    }

    const todayDate = getFormattedToday();
    const todayIso = getIsoDate();
    const draft = await dbRepo.getDailyDraft(todayDate);
    draft.date = todayDate;

    function parseRawMemberInput(rawText, defaultProjectName = 'General Tasks') {
      if (!rawText || !rawText.trim()) return [];

      const KNOWN_PROJECTS = [
        'RankMyTrip',
        'FirstText App',
        'Crystal Wish app',
        'Crystal Wish',
        "Happy Reward's Dashboard Application",
        'Happy Rewards Dashboard',
        'Happy Reward Shopify',
        'SEC EDGAR Terminal',
        'AI-powered SEO/marketing platform',
        'Alarm App',
        'AI Life Mentor',
        'QA & Testing',
        'General Tasks',
        'ReplyDM',
        'Second Number App',
        'Sweet Santa App',
        'BeForever app',
        'Beforever',
        'Beforever Backend'
      ];

      function isKnownProjectName(str) {
        if (!str) return false;
        const clean = str.trim().toLowerCase();
        return KNOWN_PROJECTS.some(p => p.toLowerCase() === clean);
      }

      const TASK_VERB_REGEX = /^(validate|validating|validated|test|testing|tested|start|starting|started|create|creating|created|fix|fixing|fixed|update|updating|updated|implement|implementing|implemented|build|building|built|deploy|deploying|deployed|do|doing|check|checking|checked|add|adding|added|modify|modifying|modified|research|researching|meeting|call|discussion|work|working|worked|review|reviewing|reviewed|resolve|resolving|resolved|recheck|rechecking|rechecked|design|designing|designed|develop|developing|developed|setup|setting|configure|configuring|configured|integrate|integrating|integrated|debug|debugging|debugged|refactor|refactoring|refactored|enhance|enhancing|enhanced|remove|removing|removed|delete|deleting|deleted|clean|cleaning|cleaned|write|writing|wrote|read|reading|optimize|optimizing|optimized|handle|handling|handled|investigate|investigating|investigated|verify|verifying|verified|support|supporting|supported|prepare|preparing|prepared|upload|uploading|uploaded|download|downloading|downloaded|push|pushing|pushed|merge|merging|merged)/i;

      function isExplicitTask(line) {
        if (!line) return false;
        if (/^[-•*#\d\.\)\s]+[a-zA-Z]/.test(line)) return true;
        if (/[-—–=>:]+\s*(done|completed|complete|finished|wip|in\s*progress|working|in-progress|on\s*leave|half\s*day)/i.test(line)) return true;
        if (/\b(DONE|WIP)\b/i.test(line)) return true;
        if (TASK_VERB_REGEX.test(line)) return true;
        if (line.length > 55) return true;
        return false;
      }

      function isProjectHeader(line, index, linesArray) {
        if (!line || !line.trim()) return false;
        const trimmed = line.trim();

        if (isExplicitTask(trimmed)) return false;

        // Explicit project header ending with :- or : e.g. "ReplyDM:-", "RankMyTrip:", "Beforever Backend:-"
        if (/^.{2,55}[:-]+$/.test(trimmed)) return true;

        // Markdown header / bracket format e.g. "## ReplyDM", "[ReplyDM]", "Project: ReplyDM", "**ReplyDM**"
        if (/^#+\s+/.test(trimmed) || /^\[.+\]$/.test(trimmed) || /^project\s*:\s*.+/i.test(trimmed) || /^\*\*[^*]+\*\*:?$/.test(trimmed)) return true;

        // Known project name
        const clean = trimmed.replace(/^[-•*#]+\s*/, '').replace(/[:-]+$/, '').trim();
        if (isKnownProjectName(clean)) return true;

        // Short title line (<= 45 chars) that does not match task action verbs
        if (trimmed.length <= 45 && !TASK_VERB_REGEX.test(trimmed)) {
          if (index === 0 && linesArray.length > 1) return true;
          if (index > 0 && linesArray[index - 1] === '') return true;
        }

        return false;
      }

      function cleanTaskLine(line) {
        let clean = line.replace(/^[-•*#]+\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim();
        let status = 'Done'; // Default to Done when status omitted

        const wipRegex = /[-—–=>:\s\(\[]+(wip|in\s*progress|working|in-progress|pending)[\)\]]*\s*$/i;
        const doneRegex = /[-—–=>:\s\(\[]+(done|completed|complete|finished|closed)[\)\]]*\s*$/i;
        const leaveRegex = /[-—–=>:\s\(\[]+(on\s*half\s*day|half\s*day|on\s*leave)[\)\]]*\s*$/i;

        if (wipRegex.test(clean)) {
          status = 'WIP';
          clean = clean.replace(wipRegex, '').trim();
        } else if (doneRegex.test(clean)) {
          status = 'Done';
          clean = clean.replace(doneRegex, '').trim();
        } else if (leaveRegex.test(clean)) {
          status = 'On Leave';
          clean = clean.replace(leaveRegex, '').trim();
        }

        clean = clean.replace(/[-—–=>:]+$/, '').trim();
        return { text: clean, status };
      }

      function cleanProjectName(line) {
        return line.replace(/^#+\s*/, '')
                   .replace(/^project\s*:\s*/i, '')
                   .replace(/^\[|\]$/g, '')
                   .replace(/^\*\*|\*\*$/g, '')
                   .replace(/^[-•*#]+\s*/, '')
                   .replace(/[:-]+$/, '')
                   .replace(/\s*General Tasks\s*$/i, '')
                   .trim();
      }

      const allLines = rawText.split('\n').map(l => l.trim());
      const projList = [];
      let currentProject = null;

      for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        if (!line) continue;

        if (isProjectHeader(line, i, allLines)) {
          const pName = cleanProjectName(line) || defaultProjectName;
          currentProject = { name: pName, tasks: [] };
          projList.push(currentProject);
        } else {
          if (!currentProject) {
            currentProject = { name: defaultProjectName, tasks: [] };
            projList.push(currentProject);
          }
          const parsed = cleanTaskLine(line);
          if (parsed.text) {
            currentProject.tasks.push(parsed);
          }
        }
      }

      return projList.filter(p => p.tasks && p.tasks.length > 0);
    }

    function getDefaultProjectForMember(memberName) {
      const norm = (memberName || '').toUpperCase().trim();
      if (norm.includes('HARSHAD')) return 'RankMyTrip';
      if (norm.includes('KIRAN')) return 'FirstText App';
      if (norm.includes('DHRUV')) return 'Crystal Wish app';
      if (norm.includes('PRANAV')) return "Happy Reward's Dashboard Application";
      if (norm.includes('KARTIK')) return 'Happy Reward Shopify';
      if (norm.includes('DEVERSH')) return 'SEC EDGAR Terminal';
      if (norm.includes('RADHEY')) return 'AI-powered SEO/marketing platform';
      if (norm.includes('AJAY')) return 'Alarm App';
      if (norm.includes('HASTI')) return 'AI Life Mentor';
      if (norm.includes('NISARG')) return 'QA & Testing';
      return 'General Tasks';
    }

    const memberDefaultProject = getDefaultProjectForMember(member);

    let parsedProjects = [];

    if (rawText) {
      parsedProjects = parseRawMemberInput(rawText, project || memberDefaultProject);
    } else if (Array.isArray(projects) && projects.length > 0) {
      parsedProjects = projects.map(p => {
        const pName = (p.name && p.name.trim()) ? p.name.trim() : memberDefaultProject;
        return {
          name: pName,
          tasks: typeof p.tasks === 'string' 
            ? parseRawMemberInput(p.tasks, pName)[0]?.tasks || []
            : (p.tasks || [])
        };
      }).filter(p => p.tasks && p.tasks.length > 0);
    } else if (tasks) {
      parsedProjects = parseRawMemberInput(tasks, project || memberDefaultProject);
    }

    if (parsedProjects.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one project with tasks is required.' });
    }

    const memberName = member.toUpperCase().trim();
    let memberRole = '';
    if (memberName.includes('DEVERSH') || memberName.includes('RADHEY')) memberRole = 'Nodejs Developer';
    else if (memberName.includes('AJAY') || memberName.includes('HASTI')) memberRole = 'Designer';
    else if (memberName.includes('NISARG')) memberRole = 'QA & Scrum Master';

    const validAttachments = Array.isArray(attachments) ? attachments.slice(0, 6) : [];

    const newMemberEntry = {
      name: memberName,
      role: memberRole,
      note: note || '',
      projects: parsedProjects,
      attachments: validAttachments,
      updatedAt: new Date().toISOString()
    };

    // Replace or append to daily draft
    const existingIndex = (draft.teamData || []).findIndex(m => m.name && m.name.toUpperCase() === memberName);
    if (existingIndex >= 0) {
      draft.teamData[existingIndex] = newMemberEntry;
    } else {
      if (!Array.isArray(draft.teamData)) draft.teamData = [];
      draft.teamData.push(newMemberEntry);
    }

    const sortedTeamData = dbRepo.sortTeamDataByRoster(draft.teamData);
    const newVersion = (draft.version || 0) + 1;
    const nowIso = new Date().toISOString();

    const savedDraft = await dbRepo.saveDailyDraft(todayDate, sortedTeamData, newVersion, nowIso);

    // Save permanently in database submissions table
    const submissionRecord = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      member: memberName,
      role: memberRole,
      note: note || '',
      projects: parsedProjects,
      attachments: validAttachments,
      date: todayDate,
      isoDate: todayIso,
      timestamp: nowIso
    };
    await dbRepo.addOrUpdateSubmission(submissionRecord);

    // Instantly notify Admin via Web Push
    try {
      sendPushToAdmins({
        title: `📋 ${member} Updated Tasks`,
        body: `${member} just updated/submitted their daily task report (${parsedProjects.length} project(s)).`,
        url: `/?updatedMember=${encodeURIComponent(memberName)}&notification=task_update`,
        tag: `task-submit-${memberName}`,
        data: {
          memberName: memberName,
          notificationType: 'task_update',
          projectsCount: String(parsedProjects.length),
          timestamp: nowIso
        }
      }).catch(err => console.error('Admin push notification error:', err.message));
    } catch (pushErr) {
      console.error('Error dispatching admin push:', pushErr.message);
    }

    res.json({
      success: true,
      message: `Tasks for ${member} across ${parsedProjects.length} project(s) recorded!`,
      draft: savedDraft,
      version: savedDraft.version,
      lastUpdated: savedDraft.lastUpdated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Draft Management
app.get('/api/draft', async (req, res) => {
  try {
    const today = getFormattedToday();
    const targetDate = req.query.date || today;
    if (targetDate === today && await isAfterAutoLeaveTime()) {
      await autoMarkPendingEmployeesLeave(today);
    }
    const draft = await dbRepo.getDailyDraft(targetDate);
    res.json({
      success: true,
      draft,
      version: draft.version || 0,
      lastUpdated: draft.lastUpdated || ''
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/draft', async (req, res) => {
  try {
    const { date, teamData, baseVersion, clientTimestamp, forceOverwrite, deletedMemberNames } = req.body;
    const targetDate = date || getFormattedToday();
    const incomingTeamData = Array.isArray(teamData) ? teamData : [];
    const deletedSet = new Set((Array.isArray(deletedMemberNames) ? deletedMemberNames : []).map(n => String(n).toUpperCase().trim()));

    let serverDraft = await dbRepo.getDailyDraft(targetDate);

    const serverMembersMap = new Map();
    if (Array.isArray(serverDraft.teamData)) {
      serverDraft.teamData.forEach(m => {
        if (m && m.name) serverMembersMap.set(m.name.toUpperCase().trim(), m);
      });
    }

    const incomingMembersMap = new Map();
    incomingTeamData.forEach(m => {
      if (m && m.name) incomingMembersMap.set(m.name.toUpperCase().trim(), m);
    });

    const mergedMembers = new Map();

    // 1. Preserve all existing server members unless explicitly deleted by Admin
    for (const [name, sMember] of serverMembersMap.entries()) {
      if (deletedSet.has(name)) {
        continue;
      }

      const cMember = incomingMembersMap.get(name);
      if (!cMember) {
        // Missing in incoming snapshot: PRESERVE server member submission!
        mergedMembers.set(name, sMember);
      } else {
        const sContent = JSON.stringify({ role: sMember.role || '', note: sMember.note || '', projects: sMember.projects || [], attachments: sMember.attachments || [] });
        const cContent = JSON.stringify({ role: cMember.role || '', note: cMember.note || '', projects: cMember.projects || [], attachments: cMember.attachments || [] });

        if (sContent === cContent) {
          mergedMembers.set(name, sMember);
        } else {
          const sUpdateTime = sMember.updatedAt ? new Date(sMember.updatedAt).getTime() : 0;
          const cUpdateTime = cMember.updatedAt ? new Date(cMember.updatedAt).getTime() : 0;

          if (sUpdateTime > cUpdateTime && cUpdateTime > 0) {
            mergedMembers.set(name, sMember);
          } else {
            mergedMembers.set(name, {
              ...cMember,
              attachments: (cMember.attachments && cMember.attachments.length > 0) ? cMember.attachments : (sMember.attachments || []),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    }

    // 2. Add any newly added members from client payload
    for (const [name, cMember] of incomingMembersMap.entries()) {
      if (deletedSet.has(name)) continue;
      if (!mergedMembers.has(name)) {
        mergedMembers.set(name, {
          ...cMember,
          updatedAt: new Date().toISOString()
        });
      }
    }

    const finalTeamData = dbRepo.sortTeamDataByRoster(Array.from(mergedMembers.values()));
    const newVersion = (serverDraft.version || 0) + 1;
    const nowIso = new Date().toISOString();

    const updatedDraft = await dbRepo.saveDailyDraft(targetDate, finalTeamData, newVersion, nowIso);

    // Sync final merged teamData to submissions log table
    try {
      if (Array.isArray(finalTeamData) && finalTeamData.length > 0) {
        for (const m of finalTeamData) {
          if (!m.name) continue;
          const mName = m.name.toUpperCase().trim();
          await dbRepo.addOrUpdateSubmission({
            id: `sub-${targetDate.replace(/\//g, '')}-${mName}`,
            member: mName,
            role: m.role || '',
            note: m.note || '',
            projects: m.projects || [],
            attachments: m.attachments || [],
            date: targetDate,
            isoDate: getIsoDate(),
            timestamp: m.updatedAt || nowIso
          });
        }
      }
    } catch (e) {
      console.error('Error syncing submissions from draft POST:', e.message);
    }

    res.json({
      success: true,
      message: 'Draft saved',
      draft: updatedDraft,
      version: newVersion,
      lastUpdated: updatedDraft.lastUpdated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submissions History & Filter API
app.get('/api/submissions', async (req, res) => {
  try {
    const filtered = await dbRepo.getSubmissions(req.query);
    res.json({
      success: true,
      count: filtered.length,
      submissions: filtered
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a submission log entry
app.delete('/api/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRepo.deleteSubmission(id);
    res.json({ success: true, message: 'Submission record removed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Config API
app.get('/api/config', async (req, res) => {
  try {
    const config = await dbRepo.getConfig();
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const saved = await dbRepo.saveConfig(req.body);
    res.json({ success: true, message: 'Configuration saved', config: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// History API
app.get('/api/history', async (req, res) => {
  try {
    const history = await dbRepo.getHistory();
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Firebase Client Config API
app.get('/api/firebase-config', (req, res) => {
  try {
    let cfg = null;
    if (process.env.FIREBASE_CONFIG) {
      try {
        cfg = JSON.parse(process.env.FIREBASE_CONFIG);
      } catch {
        cfg = JSON.parse(Buffer.from(process.env.FIREBASE_CONFIG, 'base64').toString('utf8'));
      }
    } else {
      const isVercel = Boolean(process.env.VERCEL);
      const dataDir = isVercel ? path.join(os.tmpdir(), 'task_automation_data') : path.join(__dirname, 'data');
      const cfgCandidates = [
        path.join(dataDir, 'firebase_config.json'),
        path.join(__dirname, 'data', 'firebase_config.json')
      ];
      for (const p of cfgCandidates) {
        if (fs.existsSync(p)) {
          cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
          break;
        }
      }
    }
    if (cfg) {
      res.json({ success: true, config: cfg, enabled: true });
    } else {
      res.json({ success: false, enabled: false, message: 'Firebase config not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Push Notification Endpoints
app.get('/api/push/public-key', (req, res) => {
  try {
    res.json({ success: true, publicKey: vapidKeys.publicKey });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/fcm/subscribe', async (req, res) => {
  try {
    const { token, fcmToken, role, member } = req.body;
    const registrationToken = token || fcmToken;
    if (!registrationToken) {
      return res.status(400).json({ success: false, error: 'FCM Token is required.' });
    }
    await dbRepo.savePushSubscription({
      id: `fcm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'fcm',
      fcmToken: registrationToken,
      role: role || 'employee',
      member: member || '',
      updatedAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Firebase Cloud Messaging token registered!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/fcm/unsubscribe', async (req, res) => {
  try {
    const { token, fcmToken } = req.body;
    const registrationToken = token || fcmToken;
    if (!registrationToken) {
      return res.status(400).json({ success: false, error: 'Token is required.' });
    }
    await dbRepo.removePushSubscription(null, registrationToken);
    res.json({ success: true, message: 'FCM token removed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { subscription, fcmToken, role, member } = req.body;
    if (fcmToken) {
      await dbRepo.savePushSubscription({
        id: `fcm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'fcm',
        fcmToken: fcmToken,
        role: role || 'employee',
        member: member || '',
        updatedAt: new Date().toISOString()
      });
      return res.json({ success: true, message: 'Firebase token subscription registered!' });
    }

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Subscription endpoint or fcmToken is required.' });
    }
    await dbRepo.savePushSubscription({
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'webpush',
      subscription: subscription,
      role: role || 'employee',
      member: member || '',
      updatedAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Push notification subscription registered!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const { endpoint, fcmToken } = req.body;
    if (!endpoint && !fcmToken) {
      return res.status(400).json({ success: false, error: 'Endpoint or fcmToken is required.' });
    }
    await dbRepo.removePushSubscription(endpoint, fcmToken);
    res.json({ success: true, message: 'Unsubscribed from push notifications.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Auto-Reminder & Auto-Dispatch Background Logic (Asia/Kolkata Timezone, Mon-Fri)
// -----------------------------------------------------------------------------
let lastDispatchedDate = '';
let last6pmReminderDate = '';
let last620pmReminderDate = '';
let lastAutoLeaveDate = '';

async function check6pmEmployeeReminder() {
  try {
    const config = await dbRepo.getConfig();
    const targetReminderTime = config.employeeReminderTime || '18:00';
    const cutoffTime = config.reminderTime || '18:30';
    const cutoffStr = formatTimeDisplay(cutoffTime);

    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now);

    const weekdayStr = parts.find(p => p.type === 'weekday')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    const timeStr = `${hour}:${minute}`;
    const todayDate = getFormattedToday();

    const isWorkingDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekdayStr);

    if (isWorkingDay && timeStr === targetReminderTime && last6pmReminderDate !== todayDate) {
      last6pmReminderDate = todayDate;
      console.log(`⏰ [Auto-Cron] Triggering ${targetReminderTime} (Mon-Fri) Push Reminder to pending Employees...`);
      sendPushToEmployees({
        title: `⏰ Daily Task Reminder (${formatTimeDisplay(targetReminderTime)})`,
        body: `Reminder: Please submit your daily task status report before the ${cutoffStr} cutoff!`,
        url: '/submit',
        tag: 'employee-task-reminder'
      }, { onlyPendingToday: true }).then(count => {
        console.log(`🔔 [Auto-Cron] ${targetReminderTime} reminder dispatched to ${count} pending employee device(s).`);
      }).catch(err => {
        console.error('Error dispatching push reminder:', err.message);
      });
    }
  } catch (err) {
    console.error('Error in employee reminder cron:', err.message);
  }
}

// 6:20 PM Reminder ONLY for employees who have NOT submitted tasks today
async function check620pmPendingReminder() {
  try {
    const config = await dbRepo.getConfig();
    const cutoffTime = config.reminderTime || '18:30';
    const cutoffStr = formatTimeDisplay(cutoffTime);

    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now);

    const weekdayStr = parts.find(p => p.type === 'weekday')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    const timeStr = `${hour}:${minute}`;
    const todayDate = getFormattedToday();

    const isWorkingDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekdayStr);
    const targetPendingTime = '18:20';

    if (isWorkingDay && timeStr === targetPendingTime && last620pmReminderDate !== todayDate) {
      last620pmReminderDate = todayDate;
      console.log(`⏰ [Auto-Cron] Triggering ${targetPendingTime} (Mon-Fri) Urgent Reminder to PENDING Employees only...`);
      sendPushToEmployees({
        title: `⏰ Urgent Reminder: Task Update Pending (${formatTimeDisplay(targetPendingTime)})`,
        body: `Reminder: You have not submitted your task update for today yet. Please submit now before the ${cutoffStr} cutoff!`,
        url: '/submit',
        tag: 'employee-pending-reminder'
      }, { onlyPendingToday: true }).then(count => {
        console.log(`🔔 [Auto-Cron] ${targetPendingTime} pending reminder dispatched to ${count} pending employee device(s).`);
      }).catch(err => {
        console.error('Error dispatching pending push reminder:', err.message);
      });
    }
  } catch (err) {
    console.error('Error in pending reminder cron:', err.message);
  }
}

async function check625pmAutoMarkLeave() {
  try {
    const config = await dbRepo.getConfig();
    const targetLeaveTime = config.autoLeaveTime || '18:25';

    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now);

    const weekdayStr = parts.find(p => p.type === 'weekday')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    const timeStr = `${hour}:${minute}`;
    const todayDate = getFormattedToday();

    const isWorkingDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekdayStr);

    if (isWorkingDay && timeStr === targetLeaveTime && lastAutoLeaveDate !== todayDate) {
      lastAutoLeaveDate = todayDate;
      console.log(`⏰ [Auto-Cron] Triggering ${targetLeaveTime} (Mon-Fri) Auto-Mark 'ON LEAVE' for pending employees...`);
      await autoMarkPendingEmployeesLeave(todayDate);
    }
  } catch (err) {
    console.error('Error in auto-leave cron:', err.message);
  }
}

function buildFormattedOutput(draft) {
  let output = `*RESPECTED SIR,*\n*ALL PROJECT STATUS*\n*DATE:-${draft.date || getFormattedToday()}*\n\n`;
  const sortedMembers = dbRepo.sortTeamDataByRoster(draft.teamData || []);
  sortedMembers.forEach(member => {
    let roleStr = member.role ? `(${member.role})` : '';
    let cleanNote = member.note ? member.note.replace(/^[:-]+|[:-]+$/g, '').trim() : '';
    let noteStr = cleanNote ? ` *${cleanNote}*` : '';

    if (member.projects && member.projects.length > 0) {
      member.projects.forEach((proj, pIdx) => {
        let cleanProj = proj.name ? proj.name.replace(/^[:-]+|[:-]+$/g, '').trim() : '';
        if (pIdx === 0) {
          let projDisplay = cleanProj ? ` ${cleanProj}:-` : ':-';
          let headerContent = member.role
            ? `${member.name}${roleStr}:-${projDisplay}`
            : `${member.name}:-${projDisplay}`;
          output += `*${headerContent}*${noteStr}\n\n`;
        } else {
          output += `*${cleanProj}:-*\n\n`;
        }
        (proj.tasks || []).forEach(t => {
          let tText = (t.text || '').trim();
          if (t.status === 'Done') output += `• ${tText} => Done\n`;
          else if (t.status === 'WIP') output += `• ${tText} => WIP\n`;
          else if (t.status === 'In Progress') output += `• ${tText} : In-progress\n`;
          else output += `• ${tText} => Done\n`;
        });
        output += `\n`;
      });
    } else {
      let headerContent = member.role ? `${member.name}${roleStr}:-` : `${member.name}:-`;
      output += `*${headerContent}*${noteStr}\n\n`;
    }
  });
  return output.trimEnd();
}

async function checkAndAutoDispatch() {
  try {
    const config = await dbRepo.getConfig();
    if (!config.autoDispatch || !config.webhookUrl) return;

    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now);

    const weekdayStr = parts.find(p => p.type === 'weekday')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    const currentTime = `${hour}:${minute}`;
    const todayStr = getFormattedToday();

    const isWorkingDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekdayStr);
    const targetTime = config.reminderTime || '18:30';

    if (isWorkingDay && currentTime === targetTime && lastDispatchedDate !== todayStr) {
      console.log(`⏰ [Auto-Cron] Triggering ${formatTimeDisplay(targetTime)} Daily Status Auto-Dispatch...`);
      // Ensure any pending employees are marked as ON LEAVE before dispatching
      await autoMarkPendingEmployeesLeave(todayStr);
      const draft = await dbRepo.getDailyDraft(todayStr);

      if (draft.teamData && draft.teamData.length > 0) {
        const text = buildFormattedOutput(draft);
        const response = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({ text }),
        });

        if (response.ok) {
          console.log(`✅ [Auto-Cron] Status Report automatically posted to Google Chat!`);
          lastDispatchedDate = todayStr;
          await dbRepo.addHistory({
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            formattedText: text,
            status: `Auto-Dispatched by Bot (${formatTimeDisplay(targetTime)})`
          });
        } else {
          console.error(`❌ [Auto-Cron] Webhook error:`, await response.text());
        }
      }
    }
  } catch (err) {
    console.error(`[Auto-Cron] Error:`, err.message);
  }
}

// Background scheduler running every 30 seconds
setInterval(() => {
  check6pmEmployeeReminder();
  check620pmPendingReminder();
  check625pmAutoMarkLeave();
  checkAndAutoDispatch();
}, 30000);

// Vercel Cron Endpoint for 6:00 PM Mon-Fri employee push reminder (All Employees)
app.get('/api/cron-reminder', async (req, res) => {
  try {
    const config = await dbRepo.getConfig();
    const cutoffStr = formatTimeDisplay(config.reminderTime || '18:30');
    const reminderStr = formatTimeDisplay(config.employeeReminderTime || '18:00');

    const count = await sendPushToEmployees({
      title: `⏰ Daily Task Reminder (${reminderStr})`,
      body: `Reminder: Please submit your daily task status report before the ${cutoffStr} cutoff!`,
      url: '/submit',
      tag: 'employee-task-reminder'
    }, { onlyPendingToday: true });
    return res.json({ success: true, message: `${reminderStr} employee push reminder dispatched to ${count} pending device(s)!` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Vercel Cron Endpoint for 6:20 PM Mon-Fri Urgent Push Reminder (Pending Employees Only)
app.get('/api/cron-reminder-pending', async (req, res) => {
  try {
    const config = await dbRepo.getConfig();
    const cutoffStr = formatTimeDisplay(config.reminderTime || '18:30');

    const count = await sendPushToEmployees({
      title: `⏰ Urgent Reminder: Task Update Pending (6:20 PM)`,
      body: `Reminder: You have not submitted your task update for today yet. Please submit now before the ${cutoffStr} cutoff!`,
      url: '/submit',
      tag: 'employee-pending-reminder'
    }, { onlyPendingToday: true });
    return res.json({ success: true, message: `6:20 PM urgent reminder dispatched to ${count} pending device(s)!` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Vercel Cron Endpoint for 6:25 PM Auto-marking ON LEAVE
app.get('/api/cron-auto-leave', async (req, res) => {
  try {
    const todayStr = getFormattedToday();
    const result = await autoMarkPendingEmployeesLeave(todayStr);
    return res.json({
      success: true,
      message: result.updated
        ? 'Pending employees marked as ON LEAVE successfully!'
        : 'No pending employees to update or already marked.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Vercel Cron Endpoint for auto-dispatch
app.get('/api/cron-dispatch', async (req, res) => {
  try {
    const config = await dbRepo.getConfig();
    if (!config.webhookUrl) {
      return res.status(400).json({ success: false, error: 'Webhook URL not configured' });
    }
    const todayStr = getFormattedToday();
    // Ensure any pending employees are marked ON LEAVE before dispatching
    await autoMarkPendingEmployeesLeave(todayStr);
    const draft = await dbRepo.getDailyDraft(todayStr);
    if (!draft.teamData || draft.teamData.length === 0) {
      return res.json({ success: true, message: 'No tasks to dispatch today.' });
    }

    const text = buildFormattedOutput(draft);
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text }),
    });

    if (response.ok) {
      await dbRepo.addHistory({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        formattedText: text,
        status: `Auto-Dispatched via Vercel Cron (${formatTimeDisplay(config.reminderTime)})`
      });
      return res.json({ success: true, message: 'Dispatched successfully via Vercel Cron!' });
    } else {
      return res.status(500).json({ success: false, error: await response.text() });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Endpoint to fetch latest HTTP request/response logs (admin query)
app.get('/api/admin/request-logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const logs = await dbRepo.getRequestLogs(limit);
    return res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// AI Assistant Query Endpoint
app.post('/api/ai-assistant', async (req, res) => {
  try {
    const { query, options } = req.body;
    const result = await aiAssistant.handleAiQuery(query, options);
    return res.json(result);
  } catch (err) {
    console.error('AI Assistant Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Start Server (Only listen if run directly, not in serverless)
// -----------------------------------------------------------------------------
function startServer(port = 3050) {
  const server = app.listen(port, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`\n======================================================`);
    console.log(`🚀 Scrum Task Automation Server running!`);
    console.log(`💻 Admin Dashboard : http://localhost:${port}`);
    console.log(`📱 Team Submit Link: http://${localIp}:${port}/submit`);
    console.log(`🗄️ Database Mode    : ${dbRepo.isDbConnected() ? 'Neon PostgreSQL (Drizzle ORM)' : 'Local File Storage (Set DATABASE_URL for Neon)'}`);
    console.log(`======================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer(process.env.PORT ? parseInt(process.env.PORT) : 3050);
}

module.exports = app;
