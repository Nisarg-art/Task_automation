const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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

const os = require('os');
const webpush = require('web-push');
const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

// On Vercel, the app root (/var/task) is read-only; use os.tmpdir() (/tmp)
const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'task_automation_data') : path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DRAFT_FILE = path.join(DATA_DIR, 'today_draft.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions_log.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PUSH_SUBS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');
const VAPID_FILE = path.join(DATA_DIR, 'vapid_keys.json');
const FIREBASE_CONFIG_FILE = path.join(DATA_DIR, 'firebase_config.json');
const FIREBASE_SA_FILE = path.join(DATA_DIR, 'firebase_service_account.json');

// Initialize Firebase Admin SDK
let firebaseApp = null;
let firebaseMessaging = null;

try {
  let saData = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      saData = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      saData = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8'));
    }
  } else {
    const saCandidates = [
      FIREBASE_SA_FILE,
      path.join(__dirname, 'data', 'firebase_service_account.json')
    ];
    for (const p of saCandidates) {
      if (fs.existsSync(p)) {
        saData = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
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
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(VAPID_FILE)) {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8') || '{}');
  }
  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
  }
  webpush.setVapidDetails(
    'mailto:admin@taskautomation.local',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} catch (vapidErr) {
  console.error('Error setting up VAPID keys:', vapidErr.message);
}

if (!fs.existsSync(PUSH_SUBS_FILE)) {
  fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify([]));
}

function getPushSubscriptions() {
  try {
    if (fs.existsSync(PUSH_SUBS_FILE)) {
      return JSON.parse(fs.readFileSync(PUSH_SUBS_FILE, 'utf8') || '[]');
    }
  } catch (e) { }
  return [];
}

function savePushSubscriptions(subs) {
  try {
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(subs, null, 2));
  } catch (e) {
    console.error('Failed to save push subscriptions:', e.message);
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

// Helper: Get set of member names who have already submitted their status update today
function getTodaySubmittedMembersSet() {
  const submitted = new Set();
  const today = getFormattedToday();

  try {
    if (fs.existsSync(DRAFT_FILE)) {
      const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{}');
      if (draft.date === today && Array.isArray(draft.teamData)) {
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
    }
  } catch (e) {
    console.error('Error reading draft for submitted members:', e.message);
  }

  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const logs = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]');
      logs.forEach(log => {
        if (log.date === today && log.member) {
          submitted.add(log.member.trim().toUpperCase());
        }
      });
    }
  } catch (e) {
    console.error('Error reading submissions log:', e.message);
  }

  return submitted;
}

async function sendPushToEmployees(payload, options = {}) {
  const subs = getPushSubscriptions();
  const validSubs = [];
  const fcmTokens = [];
  let sentCount = 0;

  const onlyPending = options.onlyPendingToday !== false;
  const submittedSet = onlyPending ? getTodaySubmittedMembersSet() : new Set();

  for (const sub of subs) {
    if (sub.role === 'admin') {
      validSubs.push(sub);
      continue;
    }

    // If only pending members should receive reminders, skip users who already submitted today
    if (onlyPending && sub.member) {
      const normMember = sub.member.trim().toUpperCase();
      if (submittedSet.has(normMember)) {
        // User has already given their update today! Keep subscription valid, but skip reminder.
        validSubs.push(sub);
        continue;
      }
    }

    // Firebase Cloud Messaging Token
    if (sub.fcmToken) {
      fcmTokens.push({ token: sub.fcmToken, subRecord: sub });
      continue;
    }

    // WebPush Subscription
    if (sub.subscription && sub.subscription.endpoint) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
        validSubs.push(sub);
        sentCount++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`Cleaned up expired push subscription for ${sub.member || 'employee'}`);
        } else {
          console.error('Push error to employee:', err.message);
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
      fcmResponse.responses.forEach((resp, idx) => {
        if (resp.success) {
          validSubs.push(fcmTokens[idx].subRecord);
        } else {
          const errCode = resp.error ? resp.error.code : '';
          if (errCode === 'messaging/invalid-registration-token' ||
              errCode === 'messaging/registration-token-not-registered') {
            console.log(`Cleaned up invalid FCM token for ${fcmTokens[idx].subRecord.member || 'employee'}`);
          } else {
            validSubs.push(fcmTokens[idx].subRecord);
          }
        }
      });
    } catch (fcmErr) {
      console.error('FCM Multicast error to employees:', fcmErr.message);
      fcmTokens.forEach(t => validSubs.push(t.subRecord));
    }
  }

  if (validSubs.length !== subs.length) {
    savePushSubscriptions(validSubs);
  }
  return sentCount;
}

async function sendPushToAdmins(payload) {
  const subs = getPushSubscriptions();
  const validSubs = [];
  const fcmTokens = [];
  let sentCount = 0;

  for (const sub of subs) {
    if (sub.role !== 'admin') {
      validSubs.push(sub);
      continue;
    }

    // Firebase Cloud Messaging Token
    if (sub.fcmToken) {
      fcmTokens.push({ token: sub.fcmToken, subRecord: sub });
      continue;
    }

    // WebPush Subscription
    if (sub.subscription && sub.subscription.endpoint) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
        validSubs.push(sub);
        sentCount++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`Cleaned up expired push subscription for admin`);
        } else {
          console.error('Push error to admin:', err.message);
          validSubs.push(sub);
        }
      }
    }
  }

  // Send to FCM Admin devices
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
      fcmResponse.responses.forEach((resp, idx) => {
        if (resp.success) {
          validSubs.push(fcmTokens[idx].subRecord);
        } else {
          const errCode = resp.error ? resp.error.code : '';
          if (errCode === 'messaging/invalid-registration-token' ||
              errCode === 'messaging/registration-token-not-registered') {
            console.log(`Cleaned up invalid FCM token for admin`);
          } else {
            validSubs.push(fcmTokens[idx].subRecord);
          }
        }
      });
    } catch (fcmErr) {
      console.error('FCM Multicast error to admins:', fcmErr.message);
      fcmTokens.forEach(t => validSubs.push(t.subRecord));
    }
  }

  if (validSubs.length !== subs.length) {
    savePushSubscriptions(validSubs);
  }
  return sentCount;
}

const DEFAULT_USERS = [
  { id: "u1", name: "HARSHAD", role: "", password: "Harsh#842" },
  { id: "u2", name: "KIRAN", role: "", password: "Kiran#519" },
  { id: "u3", name: "DHRUV", role: "", password: "Dhruv#638" },
  { id: "u4", name: "PRANAV", role: "", password: "Pran#247" },
  { id: "u5", name: "KARTIK", role: "", password: "Kart#816" },
  { id: "u6", name: "DEVERSH", role: "Nodejs Developer", password: "Deve#379" },
  { id: "u7", name: "RADHEY", role: "Nodejs Developer", password: "Radh#592" },
  { id: "u8", name: "AJAY", role: "Designer", password: "Ajay#481" },
  { id: "u9", name: "HASTI", role: "Designer", password: "Hast#726" },
  { id: "u10", name: "NISARG", role: "QA & Scrum Master", password: "nisarg@2002" }
];

const MASTER_ROSTER_ORDER = [
  'HARSHAD',
  'KIRAN',
  'DHRUV',
  'PRANAV',
  'KARTIK',
  'DEVERSH',
  'RADHEY',
  'AJAY',
  'HASTI',
  'NISARG'
];

function sortTeamDataByRoster(teamData) {
  if (!Array.isArray(teamData)) return [];
  return [...teamData].sort((a, b) => {
    const nameA = (a.name || a.member || '').toUpperCase().trim();
    const nameB = (b.name || b.member || '').toUpperCase().trim();
    let idxA = MASTER_ROSTER_ORDER.indexOf(nameA);
    let idxB = MASTER_ROSTER_ORDER.indexOf(nameB);
    if (idxA === -1) idxA = 999;
    if (idxB === -1) idxB = 999;
    return idxA - idxB;
  });
}

// Token Helpers (Permanent Non-Expiring Session Tokens)
function generateUserToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    role: user.role || '',
    sig: 'scrum_auth_v1'
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function verifyUserToken(tokenStr) {
  if (!tokenStr) return null;
  try {
    const raw = Buffer.from(tokenStr, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && parsed.sig === 'scrum_auth_v1') {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
      const match = users.find(u => u.name.toUpperCase() === parsed.name.toUpperCase());
      return match || { name: parsed.name, role: parsed.role || '' };
    }
    return null;
  } catch (e) {
    return null;
  }
}

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

// Helper: Check if current time in Asia/Kolkata is after cutoff time (6:28 PM)
function isAfterCutoffTime() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
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

// Ensure data directory exists and seed initial files
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // If on Vercel, copy initial config/draft/submissions/users from package if exists
  const localDataDir = path.join(__dirname, 'data');
  if (isVercel && fs.existsSync(localDataDir)) {
    try {
      if (!fs.existsSync(CONFIG_FILE) && fs.existsSync(path.join(localDataDir, 'config.json'))) {
        fs.copyFileSync(path.join(localDataDir, 'config.json'), CONFIG_FILE);
      }
      if (!fs.existsSync(DRAFT_FILE) && fs.existsSync(path.join(localDataDir, 'today_draft.json'))) {
        fs.copyFileSync(path.join(localDataDir, 'today_draft.json'), DRAFT_FILE);
      }
      if (!fs.existsSync(SUBMISSIONS_FILE) && fs.existsSync(path.join(localDataDir, 'submissions_log.json'))) {
        fs.copyFileSync(path.join(localDataDir, 'submissions_log.json'), SUBMISSIONS_FILE);
      }
      if (!fs.existsSync(USERS_FILE) && fs.existsSync(path.join(localDataDir, 'users.json'))) {
        fs.copyFileSync(path.join(localDataDir, 'users.json'), USERS_FILE);
      }
    } catch (e) { }
  }

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2));
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({
      webhookUrl: '',
      reminderTime: '18:28',
      autoDispatch: true
    }));
  }
  if (!fs.existsSync(DRAFT_FILE)) {
    fs.writeFileSync(DRAFT_FILE, JSON.stringify({ date: '', teamData: [] }));
  }
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    // Seed with existing draft if available
    let initialSubmissions = [];
    if (fs.existsSync(DRAFT_FILE)) {
      try {
        const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{}');
        const draftDate = draft.date || getFormattedToday();
        if (Array.isArray(draft.teamData)) {
          initialSubmissions = draft.teamData.map((m, idx) => ({
            id: `seed-${Date.now()}-${idx}`,
            member: m.name,
            role: m.role || '',
            note: m.note || '',
            projects: m.projects || [],
            date: draftDate,
            isoDate: getIsoDate(),
            timestamp: new Date().toISOString()
          }));
        }
      } catch (e) { }
    }
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(initialSubmissions, null, 2));
  }
} catch (err) {
  console.error('Error initializing data directory:', err.message);
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

    // Auto save to history
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
    const newEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      formattedText: text,
      status: 'Sent to Google Chat'
    };
    history.unshift(newEntry);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 100), null, 2));

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
app.post('/api/auth/admin-login', (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(401).json({ success: false, error: 'Password is required.' });
    }
    const inputPass = String(password).trim();
    let config = {};
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    } catch { }
    let users = [];
    try {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
    } catch { }
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

app.post('/api/auth/login', (req, res) => {
  try {
    const { member, password } = req.body;
    if (!member || !password) {
      return res.status(400).json({ success: false, error: 'Member name and password are required.' });
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
    const user = users.find(u => u.name.toUpperCase() === member.toUpperCase().trim());

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

app.get('/api/auth/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token;
    const user = verifyUserToken(token);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid.' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users/update', (req, res) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users)) {
      return res.status(400).json({ success: false, error: 'Invalid users array.' });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true, message: 'User credentials updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check submission status, user draft, and 6:28 PM lock state
app.get('/api/submission-status', (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token;
    const authUser = verifyUserToken(token);
    const memberName = (req.query.member || (authUser ? authUser.name : '')).toUpperCase().trim();

    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    const cutoffTime = config.reminderTime || '18:28';
    const locked = isAfterCutoffTime();

    let existingSubmission = null;
    if (memberName) {
      const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{"date":"","teamData":[]}');
      const found = (draft.teamData || []).find(m => m.name.toUpperCase() === memberName);
      if (found) {
        let rawText = '';
        (found.projects || []).forEach(p => {
          rawText += `${p.name}\n`;
          (p.tasks || []).forEach(t => {
            rawText += `${t.text} => ${t.status || 'Done'}\n`;
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
      }
    }

    res.json({
      success: true,
      isLocked: locked,
      cutoffTime: cutoffTime,
      existingSubmission: existingSubmission
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Member Direct Submission API from /submit (Supports Single & Multi-Projects with Auth Lock & 6:28 PM Cutoff)
app.post('/api/submit-task', (req, res) => {
  try {
    const { member, project, tasks, projects, note, password, token, rawText, attachments } = req.body;
    if (!member) {
      return res.status(400).json({ success: false, error: 'Member name is required.' });
    }

    // Cutoff Enforcement: Submissions/Edits close at cutoff time
    if (isAfterCutoffTime()) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
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
    let authUser = verifyUserToken(authToken);

    if (!authUser && password) {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
      const userMatch = users.find(u => u.name.toUpperCase() === member.toUpperCase());
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
    const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{"date":"","teamData":[]}');
    draft.date = todayDate;

    function parseRawMemberInput(rawText, defaultProjectName = 'General Tasks') {
      if (!rawText || !rawText.trim()) return [];

      const trimmed = rawText.trim();
      const blocks = trimmed.split(/\n\s*\n+/);
      const projList = [];

      if (blocks.length > 1) {
        for (const block of blocks) {
          const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          if (lines.length === 0) continue;

          let projName = defaultProjectName;
          let taskLines = lines;

          const firstLine = lines[0];
          const isFirstLineBullet = /^[-•*]\s+/.test(firstLine) || /^\d+[\.\)]\s+/.test(firstLine);
          const isFirstLineExplicitHeader = /[:-]+$/.test(firstLine);
          const hasStatusInFirstLine = /[-—–=>:]+\s*(done|completed|complete|wip|in\s*progress)/i.test(firstLine) || /\b(DONE|WIP)\b/i.test(firstLine);

          if ((isFirstLineExplicitHeader || (!isFirstLineBullet && !hasStatusInFirstLine && firstLine.length < 80)) && lines.length > 1) {
            projName = firstLine.replace(/^[-•*#]+\s*/, '').replace(/[:-]+$/, '').trim() || defaultProjectName;
            taskLines = lines.slice(1);
          } else if (isFirstLineExplicitHeader && lines.length === 1) {
            projName = firstLine.replace(/^[-•*#]+\s*/, '').replace(/[:-]+$/, '').trim() || defaultProjectName;
            taskLines = [];
          }

          const tasks = [];
          for (const line of taskLines) {
            let clean = line.replace(/^[-•*]\s+/, '').replace(/^\d+[\.\)]\s+/, '').trim();
            let status = 'Done';

            if (/[-—–=>:]+\s*(wip|in\s*progress|working)/i.test(clean) || /\bWIP\b/i.test(clean)) {
              status = 'WIP';
              clean = clean.replace(/[-—–=>:]+\s*(wip|in\s*progress|working)/i, '').replace(/\bWIP\b/i, '').trim();
            } else if (/[-—–=>:]+\s*(done|completed|complete)/i.test(clean) || /\bDONE\b/i.test(clean) || /\bDone\b/.test(clean)) {
              status = 'Done';
              clean = clean.replace(/[-—–=>:]+\s*(done|completed|complete)/i, '').replace(/\bDONE\b/i, '').trim();
            }

            clean = clean.replace(/[-—–=>:]+$/, '').trim();
            if (clean) {
              tasks.push({ text: clean, status });
            }
          }

          if (tasks.length > 0) {
            projList.push({ name: projName, tasks });
          }
        }
      } else {
        const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let curProj = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isBullet = /^[-•*]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line);
          const isExplicitHeader = /[:-]+$/.test(line);
          const hasStatus = /[-—–=>:]+\s*(done|completed|complete|wip|in\s*progress)/i.test(line) || /\b(DONE|WIP)\b/i.test(line);

          const isProjectHeader = isExplicitHeader || (i === 0 && !hasStatus && !isBullet && lines.length > 1 && line.length < 80);

          if (isProjectHeader) {
            let cleanProjName = line.replace(/^[-•*#]+\s*/, '').replace(/[:-]+$/, '').trim();
            curProj = {
              name: cleanProjName || defaultProjectName,
              tasks: []
            };
            projList.push(curProj);
          } else {
            if (!curProj) {
              curProj = { name: defaultProjectName, tasks: [] };
              projList.push(curProj);
            }

            let clean = line.replace(/^[-•*]\s+/, '').replace(/^\d+[\.\)]\s+/, '').trim();
            let status = 'Done';

            if (/[-—–=>:]+\s*(wip|in\s*progress|working)/i.test(clean) || /\bWIP\b/i.test(clean)) {
              status = 'WIP';
              clean = clean.replace(/[-—–=>:]+\s*(wip|in\s*progress|working)/i, '').replace(/\bWIP\b/i, '').trim();
            } else if (/[-—–=>:]+\s*(done|completed|complete)/i.test(clean) || /\bDONE\b/i.test(clean) || /\bDone\b/.test(clean)) {
              status = 'Done';
              clean = clean.replace(/[-—–=>:]+\s*(done|completed|complete)/i, '').replace(/\bDONE\b/i, '').trim();
            }

            clean = clean.replace(/[-—–=>:]+$/, '').trim();
            if (clean) {
              curProj.tasks.push({ text: clean, status });
            }
          }
        }
      }

      return projList.filter(p => p.tasks && p.tasks.length > 0);
    }

    let parsedProjects = [];

    if (req.body.rawText) {
      parsedProjects = parseRawMemberInput(req.body.rawText, project || 'General Tasks');
    } else if (Array.isArray(projects) && projects.length > 0) {
      parsedProjects = projects.map(p => ({
        name: p.name ? p.name.trim() : 'General Tasks',
        tasks: typeof p.tasks === 'string' 
          ? parseRawMemberInput(p.tasks, p.name || 'General Tasks')[0]?.tasks || []
          : (p.tasks || [])
      })).filter(p => p.tasks && p.tasks.length > 0);
    } else if (tasks) {
      parsedProjects = parseRawMemberInput(tasks, project || 'General Tasks');
    }

    if (parsedProjects.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one project with tasks is required.' });
    }

    const memberName = member.toUpperCase();
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

    // Replace or append
    const existingIndex = draft.teamData.findIndex(m => m.name.toUpperCase() === memberName);
    if (existingIndex >= 0) {
      draft.teamData[existingIndex] = newMemberEntry;
    } else {
      draft.teamData.push(newMemberEntry);
    }

    draft.teamData = sortTeamDataByRoster(draft.teamData);
    draft.version = (draft.version || 0) + 1;
    draft.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DRAFT_FILE, JSON.stringify(draft, null, 2));

    // Log to SUBMISSIONS_FILE for historical filtering (Daily/Weekly/Monthly)
    try {
      let submissions = [];
      if (fs.existsSync(SUBMISSIONS_FILE)) {
        submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]');
      }
      const existingSubIndex = submissions.findIndex(s =>
        s.member && s.member.toUpperCase() === memberName && (s.date === todayDate || s.isoDate === todayIso)
      );

      const submissionRecord = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        member: memberName,
        role: memberRole,
        note: note || '',
        projects: parsedProjects,
        attachments: validAttachments,
        date: todayDate,
        isoDate: todayIso,
        timestamp: new Date().toISOString()
      };

      if (existingSubIndex >= 0) {
        submissions[existingSubIndex] = submissionRecord;
      } else {
        submissions.unshift(submissionRecord);
      }
      fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions.slice(0, 1000), null, 2));
    } catch (subErr) {
      console.error('Error recording submission log:', subErr.message);
    }

    // Instantly notify Admin via Web Push
    try {
      sendPushToAdmins({
        title: `📋 ${member} Updated Tasks`,
        body: `${member} just updated/submitted their daily task report (${parsedProjects.length} project(s)).`,
        url: '/',
        tag: `task-submit-${memberName}`
      }).catch(err => console.error('Admin push notification error:', err.message));
    } catch (pushErr) {
      console.error('Error dispatching admin push:', pushErr.message);
    }

    res.json({ success: true, message: `Tasks for ${member} across ${parsedProjects.length} project(s) recorded!`, draft, version: draft.version, lastUpdated: draft.lastUpdated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Draft Management
app.get('/api/draft', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{"date":"","teamData":[],"version":0}');
    if (Array.isArray(draft.teamData)) {
      draft.teamData = sortTeamDataByRoster(draft.teamData);
    }
    res.json({ success: true, draft, version: draft.version || 0, lastUpdated: draft.lastUpdated || '' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/draft', (req, res) => {
  try {
    const { date, teamData, baseVersion, clientTimestamp, forceOverwrite, deletedMemberNames } = req.body;
    const targetDate = date || getFormattedToday();
    const incomingTeamData = Array.isArray(teamData) ? teamData : [];
    const deletedSet = new Set((Array.isArray(deletedMemberNames) ? deletedMemberNames : []).map(n => String(n).toUpperCase().trim()));

    let serverDraft = { date: targetDate, teamData: [], version: 0 };
    try {
      if (fs.existsSync(DRAFT_FILE)) {
        serverDraft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{"date":"","teamData":[],"version":0}');
      }
    } catch (e) { }

    // If date changed to a new day, reset server draft
    if (serverDraft.date && serverDraft.date !== targetDate) {
      serverDraft = { date: targetDate, teamData: [], version: 0 };
    }

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
        continue; // Explicitly deleted by Admin
      }

      const cMember = incomingMembersMap.get(name);
      if (!cMember) {
        // Missing in incoming client snapshot: PRESERVE server member submission!
        mergedMembers.set(name, sMember);
      } else {
        // In both: check content
        const sContent = JSON.stringify({ role: sMember.role || '', note: sMember.note || '', projects: sMember.projects || [], attachments: sMember.attachments || [] });
        const cContent = JSON.stringify({ role: cMember.role || '', note: cMember.note || '', projects: cMember.projects || [], attachments: cMember.attachments || [] });

        if (sContent === cContent) {
          mergedMembers.set(name, sMember);
        } else {
          // Client has edits for this member
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

    const finalTeamData = sortTeamDataByRoster(Array.from(mergedMembers.values()));
    const newVersion = (serverDraft.version || 0) + 1;

    const updatedDraft = {
      date: targetDate,
      teamData: finalTeamData,
      version: newVersion,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(DRAFT_FILE, JSON.stringify(updatedDraft, null, 2));

    // Sync final merged teamData to submissions_log.json
    try {
      if (Array.isArray(sortedTeamData) && sortedTeamData.length > 0) {
        let submissions = [];
        if (fs.existsSync(SUBMISSIONS_FILE)) {
          submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]');
        }
        sortedTeamData.forEach(m => {
          if (!m.name) return;
          const mName = m.name.toUpperCase();
          const existingIdx = submissions.findIndex(s =>
            s.member && s.member.toUpperCase() === mName && s.date === targetDate
          );
          const rec = {
            id: existingIdx >= 0 ? submissions[existingIdx].id : `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            member: mName,
            role: m.role || '',
            note: m.note || '',
            projects: m.projects || [],
            date: targetDate,
            isoDate: getIsoDate(),
            timestamp: m.updatedAt || new Date().toISOString()
          };
          if (existingIdx >= 0) {
            submissions[existingIdx] = rec;
          } else {
            submissions.unshift(rec);
          }
        });
        fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions.slice(0, 1000), null, 2));
      }
    } catch (e) { }

    res.json({ success: true, message: 'Draft saved', draft: updatedDraft, version: newVersion, lastUpdated: updatedDraft.lastUpdated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submissions History & Filter API (Daily, Weekly, Monthly, By Member & Date)
app.get('/api/submissions', (req, res) => {
  try {
    let submissions = [];
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]');
    }

    const { member, period, date, startDate, endDate, search } = req.query;

    let filtered = [...submissions];

    // Filter by Member
    if (member && member.toUpperCase() !== 'ALL') {
      const targetMember = member.toUpperCase().trim();
      filtered = filtered.filter(s => s.member && s.member.toUpperCase().includes(targetMember));
    }

    // Reference Date calculation
    const refDateStr = date || getIsoDate();
    let refDate = new Date(refDateStr);
    if (isNaN(refDate.getTime())) {
      refDate = new Date();
    }

    // Filter by Period
    if (period === 'daily') {
      const targetDateFormatted = getFormattedToday(refDate);
      const targetIso = getIsoDate(refDate);
      filtered = filtered.filter(s => s.date === targetDateFormatted || s.isoDate === targetIso);
    } else if (period === 'weekly') {
      // Past 7 days from refDate
      const endMs = refDate.getTime() + (24 * 60 * 60 * 1000); // end of refDate day
      const startMs = endMs - (7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(s => {
        const itemTime = new Date(s.timestamp || s.isoDate || s.date).getTime();
        return !isNaN(itemTime) && itemTime >= startMs && itemTime <= endMs;
      });
    } else if (period === 'monthly') {
      // Past 30 days or same Month & Year
      const targetMonth = refDate.getMonth();
      const targetYear = refDate.getFullYear();
      filtered = filtered.filter(s => {
        const itemDate = new Date(s.timestamp || s.isoDate || s.date);
        if (!isNaN(itemDate.getTime())) {
          return itemDate.getMonth() === targetMonth && itemDate.getFullYear() === targetYear;
        }
        // Fallback for DD/MM/YYYY
        if (s.date && s.date.includes('/')) {
          const parts = s.date.split('/');
          return parseInt(parts[1], 10) === targetMonth + 1 && parseInt(parts[2], 10) === targetYear;
        }
        return true;
      });
    } else if (startDate && endDate) {
      const sMs = new Date(startDate).getTime();
      const eMs = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);
      filtered = filtered.filter(s => {
        const itemTime = new Date(s.timestamp || s.isoDate || s.date).getTime();
        return !isNaN(itemTime) && itemTime >= sMs && itemTime <= eMs;
      });
    }

    // Filter by Search Query
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(s => {
        const memberMatch = (s.member || '').toLowerCase().includes(q);
        const noteMatch = (s.note || '').toLowerCase().includes(q);
        const projectMatch = (s.projects || []).some(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.tasks || []).some(t => (typeof t === 'string' ? t : (t.text || '')).toLowerCase().includes(q))
        );
        return memberMatch || noteMatch || projectMatch;
      });
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

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
app.delete('/api/submissions/:id', (req, res) => {
  try {
    const { id } = req.params;
    let submissions = [];
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]');
    }
    const updated = submissions.filter(s => s.id !== id);
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(updated, null, 2));
    res.json({ success: true, message: 'Submission record removed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Config API
app.get('/api/config', (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const { webhookUrl, reminderTime, employeeReminderTime, autoDispatch, adminPassword } = req.body;
    const current = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    const updated = {
      webhookUrl: webhookUrl !== undefined ? webhookUrl : current.webhookUrl,
      reminderTime: reminderTime !== undefined ? reminderTime : current.reminderTime || '18:28',
      employeeReminderTime: employeeReminderTime !== undefined ? employeeReminderTime : current.employeeReminderTime || '16:05',
      autoDispatch: autoDispatch !== undefined ? autoDispatch : current.autoDispatch ?? true,
      adminPassword: adminPassword !== undefined && adminPassword.trim() ? adminPassword.trim() : current.adminPassword || 'nisarg@2002'
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
    res.json({ success: true, message: 'Configuration saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// History API
app.get('/api/history', (req, res) => {
  try {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
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
      const cfgCandidates = [
        FIREBASE_CONFIG_FILE,
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

app.post('/api/fcm/subscribe', (req, res) => {
  try {
    const { token, fcmToken, role, member } = req.body;
    const registrationToken = token || fcmToken;
    if (!registrationToken) {
      return res.status(400).json({ success: false, error: 'FCM Token is required.' });
    }
    const subs = getPushSubscriptions();
    const existingIdx = subs.findIndex(s => s.fcmToken === registrationToken);
    const subRecord = {
      id: `fcm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'fcm',
      fcmToken: registrationToken,
      role: role || 'employee',
      member: member || '',
      updatedAt: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      subs[existingIdx] = subRecord;
    } else {
      subs.push(subRecord);
    }
    savePushSubscriptions(subs);
    res.json({ success: true, message: 'Firebase Cloud Messaging token registered!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/fcm/unsubscribe', (req, res) => {
  try {
    const { token, fcmToken } = req.body;
    const registrationToken = token || fcmToken;
    if (!registrationToken) {
      return res.status(400).json({ success: false, error: 'Token is required.' });
    }
    const subs = getPushSubscriptions();
    const filtered = subs.filter(s => s.fcmToken !== registrationToken);
    savePushSubscriptions(filtered);
    res.json({ success: true, message: 'FCM token removed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/push/subscribe', (req, res) => {
  try {
    const { subscription, fcmToken, role, member } = req.body;
    if (fcmToken) {
      const subs = getPushSubscriptions();
      const existingIdx = subs.findIndex(s => s.fcmToken === fcmToken);
      const subRecord = {
        id: `fcm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'fcm',
        fcmToken: fcmToken,
        role: role || 'employee',
        member: member || '',
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        subs[existingIdx] = subRecord;
      } else {
        subs.push(subRecord);
      }
      savePushSubscriptions(subs);
      return res.json({ success: true, message: 'Firebase token subscription registered!' });
    }

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Subscription endpoint or fcmToken is required.' });
    }
    const subs = getPushSubscriptions();
    const existingIdx = subs.findIndex(s => s.subscription && s.subscription.endpoint === subscription.endpoint);
    const subRecord = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'webpush',
      subscription: subscription,
      role: role || 'employee',
      member: member || '',
      updatedAt: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      subs[existingIdx] = subRecord;
    } else {
      subs.push(subRecord);
    }
    savePushSubscriptions(subs);
    res.json({ success: true, message: 'Push notification subscription registered!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/push/unsubscribe', (req, res) => {
  try {
    const { endpoint, fcmToken } = req.body;
    if (!endpoint && !fcmToken) {
      return res.status(400).json({ success: false, error: 'Endpoint or fcmToken is required.' });
    }
    const subs = getPushSubscriptions();
    const filtered = subs.filter(s => {
      if (endpoint && s.subscription && s.subscription.endpoint === endpoint) return false;
      if (fcmToken && s.fcmToken === fcmToken) return false;
      return true;
    });
    savePushSubscriptions(filtered);
    res.json({ success: true, message: 'Unsubscribed from push notifications.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/push/test', async (req, res) => {
  try {
    const { role, title, body } = req.body;
    const testPayload = {
      title: title || '🧪 Scrum Notification Test',
      body: body || (role === 'admin' ? 'Live Admin alert is working!' : 'Daily 6:00 PM task reminder is working!'),
      url: role === 'admin' ? '/' : '/submit',
      tag: 'test-push-notification'
    };
    let count = 0;
    if (role === 'admin') {
      count = await sendPushToAdmins(testPayload);
    } else {
      count = await sendPushToEmployees(testPayload);
    }
    res.json({ success: true, message: `Test push sent to ${count} ${role || 'employee'} device(s)!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Built-in 6:00 PM (Mon-Fri) Working Day Push Reminder & 6:28 PM Auto-Cron
// -----------------------------------------------------------------------------
let lastDispatchedDate = '';
let last6pmReminderDate = '';

function check6pmEmployeeReminder() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    const targetReminderTime = config.employeeReminderTime || '18:00';
    const cutoffTime = config.reminderTime || '18:15';
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

    // Monday through Friday: Mon, Tue, Wed, Thu, Fri
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

function buildFormattedOutput(draft) {
  let output = `*RESPECTED SIR,*\n*ALL PROJECT STATUS*\n*DATE:-${draft.date || getFormattedToday()}*\n\n`;
  const sortedMembers = sortTeamDataByRoster(draft.teamData || []);
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
          else output += `• ${tText}\n`;
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
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    if (!config.autoDispatch || !config.webhookUrl) return;

    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;
    const todayStr = getFormattedToday();

    const targetTime = config.reminderTime || '18:15';

    if (currentTime === targetTime && lastDispatchedDate !== todayStr) {
      console.log(`⏰ [Auto-Cron] Triggering ${formatTimeDisplay(targetTime)} Daily Status Auto-Dispatch...`);
      const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{"date":"","teamData":[]}');

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

          const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
          history.unshift({
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            formattedText: text,
            status: `Auto-Dispatched by Bot (${formatTimeDisplay(targetTime)})`
          });
          fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 100), null, 2));
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
  checkAndAutoDispatch();
}, 30000);

// Vercel Cron Endpoint for 6:00 PM Mon-Fri employee push reminder
app.get('/api/cron-reminder', async (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    const cutoffStr = formatTimeDisplay(config.reminderTime || '18:15');
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

// Vercel Cron Endpoint for 6:28 PM auto-dispatch
app.get('/api/cron-dispatch', async (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    if (!config.webhookUrl) {
      return res.status(400).json({ success: false, error: 'Webhook URL not configured' });
    }
    const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{"date":"","teamData":[]}');
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
      return res.json({ success: true, message: 'Dispatched successfully via Vercel Cron!' });
    } else {
      return res.status(500).json({ success: false, error: await response.text() });
    }
  } catch (err) {
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
