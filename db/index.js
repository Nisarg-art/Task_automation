require('dotenv').config();
const { neon, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, desc, and, gte, lte, sql } = require('drizzle-orm');
const schema = require('./schema');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || '';

let db = null;
let sqlClient = null;
let isDbConnected = false;

function isPlaceholderDbUrl(url) {
  if (!url) return true;
  return url.includes('npg_samplepassword');
}

if (DATABASE_URL && (DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://'))) {
  if (isPlaceholderDbUrl(DATABASE_URL)) {
    console.log('ℹ️ DATABASE_URL contains placeholder credentials. Running in Local Storage mode.');
    console.log('👉 To enable Neon Cloud DB, paste your real Neon connection string into .env (https://console.neon.tech)');
    isDbConnected = false;
  } else {
    try {
      sqlClient = neon(DATABASE_URL);
      db = drizzle(sqlClient, { schema });
      isDbConnected = true;
      console.log('✅ Neon PostgreSQL client connected via Drizzle ORM');
    } catch (err) {
      console.error('⚠️ Failed to initialize Neon DB client:', err.message);
      isDbConnected = false;
    }
  }
} else {
  console.log('ℹ️ DATABASE_URL not configured. Running with fallback local storage.');
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

// Ensure database tables exist automatically on first connection
async function initDatabaseTables() {
  if (!isDbConnected || !sqlClient) return false;

  try {
    await sqlClient`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        role TEXT DEFAULT '',
        password TEXT DEFAULT '',
        created_at TEXT,
        updated_at TEXT
      );
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS daily_drafts (
        date TEXT PRIMARY KEY,
        team_data JSONB DEFAULT '[]'::jsonb,
        version INTEGER DEFAULT 0,
        last_updated TEXT DEFAULT ''
      );
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        member TEXT NOT NULL,
        role TEXT DEFAULT '',
        note TEXT DEFAULT '',
        projects JSONB DEFAULT '[]'::jsonb,
        attachments JSONB DEFAULT '[]'::jsonb,
        date TEXT NOT NULL,
        iso_date TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        formatted_text TEXT NOT NULL,
        status TEXT DEFAULT 'Sent to Google Chat',
        timestamp TEXT NOT NULL
      );
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS config (
        id TEXT PRIMARY KEY DEFAULT 'main',
        webhook_url TEXT DEFAULT '',
        reminder_time TEXT DEFAULT '18:28',
        employee_reminder_time TEXT DEFAULT '18:00',
        auto_leave_time TEXT DEFAULT '18:25',
        auto_dispatch BOOLEAN DEFAULT true,
        admin_password TEXT DEFAULT 'nisarg@2002',
        updated_at TEXT
      );
    `;

    try {
      await sqlClient`
        ALTER TABLE config ADD COLUMN IF NOT EXISTS auto_leave_time TEXT DEFAULT '18:25';
      `;
    } catch (colErr) { }

    await sqlClient`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        type TEXT DEFAULT 'webpush',
        endpoint TEXT,
        keys JSONB,
        fcm_token TEXT,
        role TEXT DEFAULT 'employee',
        member TEXT DEFAULT '',
        updated_at TEXT
      );
    `;

    await sqlClient`
      CREATE TABLE IF NOT EXISTS vapid_keys (
        id TEXT PRIMARY KEY DEFAULT 'main',
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL
      );
    `;

    // Seed default users if table is empty
    const existingUsers = await db.select().from(schema.users).limit(1);
    if (existingUsers.length === 0) {
      console.log('🌱 Seeding default team users into Neon DB...');
      for (const u of DEFAULT_USERS) {
        await db.insert(schema.users).values({
          id: u.id,
          name: u.name,
          role: u.role || '',
          password: u.password || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).onConflictDoNothing();
      }
    }

    // Seed default config if empty
    const existingConfig = await db.select().from(schema.config).where(eq(schema.config.id, 'main')).limit(1);
    if (existingConfig.length === 0) {
      console.log('🌱 Seeding initial configuration into Neon DB...');
      await db.insert(schema.config).values({
        id: 'main',
        webhookUrl: '',
        reminderTime: '18:28',
        employeeReminderTime: '18:00',
        autoDispatch: true,
        adminPassword: 'nisarg@2002',
        updatedAt: new Date().toISOString(),
      }).onConflictDoNothing();
    }

    console.log('✅ Neon DB tables verified and initialized successfully.');
    return true;
  } catch (err) {
    console.log(`ℹ️ Neon DB tables initialization notice: ${err.message}. Running with fallback local storage.`);
    isDbConnected = false;
    return false;
  }
}

// -----------------------------------------------------------------------------
// Repository Methods (with Automatic Neon DB / Local JSON Fallback)
// -----------------------------------------------------------------------------

// Local data fallback file paths
const os = require('os');
const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'task_automation_data') : path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DRAFT_FILE = path.join(DATA_DIR, 'today_draft.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions_log.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PUSH_SUBS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');
const VAPID_FILE = path.join(DATA_DIR, 'vapid_keys.json');

function ensureLocalDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) { }
}

// --- USERS ---
async function getUsers() {
  if (isDbConnected && db) {
    try {
      const rows = await db.select().from(schema.users);
      return rows.map(u => ({ id: u.id, name: u.name, role: u.role, password: u.password }));
    } catch (e) {
      console.error('DB error fetching users, using fallback:', e.message);
    }
  }
  ensureLocalDir();
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
    }
  } catch (e) { }
  return DEFAULT_USERS;
}

async function saveUsers(usersList) {
  if (isDbConnected && db && Array.isArray(usersList)) {
    try {
      for (const u of usersList) {
        await db.insert(schema.users).values({
          id: u.id || `u_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: u.name.toUpperCase().trim(),
          role: u.role || '',
          password: u.password || '',
          updatedAt: new Date().toISOString(),
        }).onConflictDoUpdate({
          target: schema.users.name,
          set: {
            role: u.role || '',
            password: u.password || '',
            updatedAt: new Date().toISOString(),
          }
        });
      }
    } catch (e) {
      console.error('DB error saving users:', e.message);
    }
  }
  ensureLocalDir();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersList, null, 2));
  } catch (e) { }
}

async function getUserByName(name) {
  if (!name) return null;
  const target = name.toUpperCase().trim();
  if (isDbConnected && db) {
    try {
      const rows = await db.select().from(schema.users).where(eq(schema.users.name, target)).limit(1);
      if (rows.length > 0) return rows[0];
    } catch (e) { }
  }
  const allUsers = await getUsers();
  return allUsers.find(u => u.name && u.name.toUpperCase() === target) || null;
}

// --- DAILY DRAFTS ---
async function getDailyDraft(targetDate) {
  if (!targetDate) return { date: '', teamData: [], version: 0, lastUpdated: '' };

  if (isDbConnected && db) {
    try {
      const rows = await db.select().from(schema.dailyDrafts).where(eq(schema.dailyDrafts.date, targetDate)).limit(1);
      if (rows.length > 0) {
        const d = rows[0];
        return {
          date: d.date,
          teamData: Array.isArray(d.teamData) ? sortTeamDataByRoster(d.teamData) : [],
          version: d.version || 0,
          lastUpdated: d.lastUpdated || '',
        };
      }
    } catch (e) {
      console.error('DB error fetching daily draft:', e.message);
    }
  }

  ensureLocalDir();
  try {
    if (fs.existsSync(DRAFT_FILE)) {
      const local = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{}');
      if (local.date === targetDate) {
        return {
          date: local.date,
          teamData: Array.isArray(local.teamData) ? sortTeamDataByRoster(local.teamData) : [],
          version: local.version || 0,
          lastUpdated: local.lastUpdated || '',
        };
      }
    }
  } catch (e) { }

  return { date: targetDate, teamData: [], version: 0, lastUpdated: '' };
}

async function saveDailyDraft(targetDate, teamData, version, lastUpdated) {
  const sorted = sortTeamDataByRoster(teamData || []);
  const ts = lastUpdated || new Date().toISOString();
  const ver = typeof version === 'number' ? version : 1;

  if (isDbConnected && db) {
    try {
      await db.insert(schema.dailyDrafts).values({
        date: targetDate,
        teamData: sorted,
        version: ver,
        lastUpdated: ts,
      }).onConflictDoUpdate({
        target: schema.dailyDrafts.date,
        set: {
          teamData: sorted,
          version: ver,
          lastUpdated: ts,
        }
      });
    } catch (e) {
      console.error('DB error saving daily draft:', e.message);
    }
  }

  ensureLocalDir();
  try {
    fs.writeFileSync(DRAFT_FILE, JSON.stringify({
      date: targetDate,
      teamData: sorted,
      version: ver,
      lastUpdated: ts,
    }, null, 2));
  } catch (e) { }

  return { date: targetDate, teamData: sorted, version: ver, lastUpdated: ts };
}

// --- SUBMISSIONS LOG ---
async function addOrUpdateSubmission(subRecord) {
  if (isDbConnected && db) {
    try {
      await db.insert(schema.submissions).values({
        id: subRecord.id,
        member: subRecord.member,
        role: subRecord.role || '',
        note: subRecord.note || '',
        projects: subRecord.projects || [],
        attachments: subRecord.attachments || [],
        date: subRecord.date,
        isoDate: subRecord.isoDate,
        timestamp: subRecord.timestamp || new Date().toISOString(),
      }).onConflictDoUpdate({
        target: schema.submissions.id,
        set: {
          member: subRecord.member,
          role: subRecord.role || '',
          note: subRecord.note || '',
          projects: subRecord.projects || [],
          attachments: subRecord.attachments || [],
          date: subRecord.date,
          isoDate: subRecord.isoDate,
          timestamp: subRecord.timestamp || new Date().toISOString(),
        }
      });
    } catch (e) {
      console.error('DB error adding submission:', e.message);
    }
  }

  ensureLocalDir();
  try {
    let submissions = [];
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]');
    }
    const existingIdx = submissions.findIndex(s => s.id === subRecord.id || (s.member === subRecord.member && s.date === subRecord.date));
    if (existingIdx >= 0) {
      submissions[existingIdx] = subRecord;
    } else {
      submissions.unshift(subRecord);
    }
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions.slice(0, 1000), null, 2));
  } catch (e) { }
}

async function getSubmissions(query = {}) {
  let list = [];
  if (isDbConnected && db) {
    try {
      const rows = await db.select().from(schema.submissions);
      list = rows.map(r => ({
        id: r.id,
        member: r.member,
        role: r.role || '',
        note: r.note || '',
        projects: r.projects || [],
        attachments: r.attachments || [],
        date: r.date,
        isoDate: r.isoDate,
        timestamp: r.timestamp,
      }));
    } catch (e) {
      console.error('DB error reading submissions:', e.message);
    }
  }

  if (list.length === 0) {
    ensureLocalDir();
    try {
      if (fs.existsSync(SUBMISSIONS_FILE)) {
        list = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]');
      }
    } catch (e) { }
  }

  const { member, period, date, startDate, endDate, search } = query;
  let filtered = [...list];

  if (member && member.toUpperCase() !== 'ALL') {
    const targetMember = member.toUpperCase().trim();
    filtered = filtered.filter(s => s.member && s.member.toUpperCase().includes(targetMember));
  }

  const refDateStr = date || new Date().toISOString().split('T')[0];
  let refDate = new Date(refDateStr);
  if (isNaN(refDate.getTime())) {
    refDate = new Date();
  }

  if (period === 'daily') {
    const d = String(refDate.getDate()).padStart(2, '0');
    const m = String(refDate.getMonth() + 1).padStart(2, '0');
    const y = refDate.getFullYear();
    const targetDateFormatted = `${d}/${m}/${y}`;
    const targetIso = refDate.toISOString().split('T')[0];
    filtered = filtered.filter(s => s.date === targetDateFormatted || s.isoDate === targetIso);
  } else if (period === 'weekly') {
    const endMs = refDate.getTime() + (24 * 60 * 60 * 1000);
    const startMs = endMs - (7 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(s => {
      const itemTime = new Date(s.timestamp || s.isoDate || s.date).getTime();
      return !isNaN(itemTime) && itemTime >= startMs && itemTime <= endMs;
    });
  } else if (period === 'monthly') {
    const targetMonth = refDate.getMonth();
    const targetYear = refDate.getFullYear();
    filtered = filtered.filter(s => {
      const itemDate = new Date(s.timestamp || s.isoDate || s.date);
      if (!isNaN(itemDate.getTime())) {
        return itemDate.getMonth() === targetMonth && itemDate.getFullYear() === targetYear;
      }
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

  filtered.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  return filtered;
}

async function deleteSubmission(id) {
  if (isDbConnected && db && id) {
    try {
      await db.delete(schema.submissions).where(eq(schema.submissions.id, id));
    } catch (e) {
      console.error('DB error deleting submission:', e.message);
    }
  }

  ensureLocalDir();
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]');
      const updated = submissions.filter(s => s.id !== id);
      fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(updated, null, 2));
    }
  } catch (e) { }
}

// --- CONFIG ---
async function getConfig() {
  if (isDbConnected && db) {
    try {
      const rows = await db.select().from(schema.config).where(eq(schema.config.id, 'main')).limit(1);
      if (rows.length > 0) {
        return {
          webhookUrl: rows[0].webhookUrl || '',
          reminderTime: rows[0].reminderTime || '18:28',
          employeeReminderTime: rows[0].employeeReminderTime || '18:00',
          autoLeaveTime: rows[0].autoLeaveTime || '18:25',
          autoDispatch: rows[0].autoDispatch ?? true,
          adminPassword: rows[0].adminPassword || 'nisarg@2002',
        };
      }
    } catch (e) {
      console.error('DB error fetching config:', e.message);
    }
  }

  ensureLocalDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    }
  } catch (e) { }

  return {
    webhookUrl: '',
    reminderTime: '18:28',
    employeeReminderTime: '18:00',
    autoLeaveTime: '18:25',
    autoDispatch: true,
    adminPassword: 'nisarg@2002',
  };
}

async function saveConfig(updates) {
  const current = await getConfig();
  const merged = {
    webhookUrl: updates.webhookUrl !== undefined ? updates.webhookUrl : current.webhookUrl,
    reminderTime: updates.reminderTime !== undefined ? updates.reminderTime : current.reminderTime || '18:28',
    employeeReminderTime: updates.employeeReminderTime !== undefined ? updates.employeeReminderTime : current.employeeReminderTime || '18:00',
    autoLeaveTime: updates.autoLeaveTime !== undefined ? updates.autoLeaveTime : current.autoLeaveTime || '18:25',
    autoDispatch: updates.autoDispatch !== undefined ? updates.autoDispatch : current.autoDispatch ?? true,
    adminPassword: updates.adminPassword !== undefined && updates.adminPassword.trim() ? updates.adminPassword.trim() : current.adminPassword || 'nisarg@2002',
  };

  if (isDbConnected && db) {
    try {
      await db.insert(schema.config).values({
        id: 'main',
        ...merged,
        updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: schema.config.id,
        set: {
          ...merged,
          updatedAt: new Date().toISOString(),
        }
      });
    } catch (e) {
      console.error('DB error saving config:', e.message);
    }
  }

  ensureLocalDir();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
  } catch (e) { }

  return merged;
}

// --- HISTORY ---
async function getHistory() {
  if (isDbConnected && db) {
    try {
      const rows = await db.select().from(schema.history);
      return rows.map(r => ({
        id: r.id,
        formattedText: r.formattedText,
        status: r.status,
        timestamp: r.timestamp,
      })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (e) {
      console.error('DB error reading history:', e.message);
    }
  }

  ensureLocalDir();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
    }
  } catch (e) { }

  return [];
}

async function addHistory(entry) {
  if (isDbConnected && db) {
    try {
      await db.insert(schema.history).values({
        id: entry.id || String(Date.now()),
        formattedText: entry.formattedText,
        status: entry.status || 'Sent to Google Chat',
        timestamp: entry.timestamp || new Date().toISOString(),
      }).onConflictDoNothing();
    } catch (e) {
      console.error('DB error writing history:', e.message);
    }
  }

  ensureLocalDir();
  try {
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
    }
    history.unshift(entry);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 100), null, 2));
  } catch (e) { }
}

// --- PUSH SUBSCRIPTIONS ---
async function getPushSubscriptions() {
  if (isDbConnected && db) {
    try {
      const rows = await db.select().from(schema.pushSubscriptions);
      return rows.map(r => ({
        id: r.id,
        type: r.type,
        endpoint: r.endpoint,
        subscription: r.endpoint ? { endpoint: r.endpoint, keys: r.keys } : null,
        fcmToken: r.fcmToken,
        role: r.role,
        member: r.member,
        updatedAt: r.updatedAt,
      }));
    } catch (e) {
      console.error('DB error fetching push subscriptions:', e.message);
    }
  }

  ensureLocalDir();
  try {
    if (fs.existsSync(PUSH_SUBS_FILE)) {
      return JSON.parse(fs.readFileSync(PUSH_SUBS_FILE, 'utf8') || '[]');
    }
  } catch (e) { }

  return [];
}

async function savePushSubscription(subRecord) {
  if (isDbConnected && db) {
    try {
      await db.insert(schema.pushSubscriptions).values({
        id: subRecord.id || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        type: subRecord.type || (subRecord.fcmToken ? 'fcm' : 'webpush'),
        endpoint: subRecord.subscription?.endpoint || subRecord.endpoint || null,
        keys: subRecord.subscription?.keys || subRecord.keys || null,
        fcmToken: subRecord.fcmToken || null,
        role: subRecord.role || 'employee',
        member: subRecord.member || '',
        updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: schema.pushSubscriptions.id,
        set: {
          endpoint: subRecord.subscription?.endpoint || subRecord.endpoint || null,
          keys: subRecord.subscription?.keys || subRecord.keys || null,
          fcmToken: subRecord.fcmToken || null,
          role: subRecord.role || 'employee',
          member: subRecord.member || '',
          updatedAt: new Date().toISOString(),
        }
      });
    } catch (e) {
      console.error('DB error saving push subscription:', e.message);
    }
  }

  ensureLocalDir();
  try {
    let subs = [];
    if (fs.existsSync(PUSH_SUBS_FILE)) {
      subs = JSON.parse(fs.readFileSync(PUSH_SUBS_FILE, 'utf8') || '[]');
    }
    const idx = subs.findIndex(s =>
      (subRecord.fcmToken && s.fcmToken === subRecord.fcmToken) ||
      (subRecord.subscription?.endpoint && s.subscription?.endpoint === subRecord.subscription.endpoint)
    );
    if (idx >= 0) {
      subs[idx] = subRecord;
    } else {
      subs.push(subRecord);
    }
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(subs, null, 2));
  } catch (e) { }
}

async function removePushSubscription(endpoint, fcmToken) {
  if (isDbConnected && db) {
    try {
      if (endpoint) {
        await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, endpoint));
      }
      if (fcmToken) {
        await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.fcmToken, fcmToken));
      }
    } catch (e) {
      console.error('DB error removing push subscription:', e.message);
    }
  }

  ensureLocalDir();
  try {
    if (fs.existsSync(PUSH_SUBS_FILE)) {
      let subs = JSON.parse(fs.readFileSync(PUSH_SUBS_FILE, 'utf8') || '[]');
      subs = subs.filter(s => {
        if (endpoint && s.subscription && s.subscription.endpoint === endpoint) return false;
        if (fcmToken && s.fcmToken === fcmToken) return false;
        return true;
      });
      fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(subs, null, 2));
    }
  } catch (e) { }
}

// --- VAPID KEYS ---
async function getVapidKeys() {
  if (isDbConnected && db) {
    try {
      const rows = await db.select().from(schema.vapidKeys).where(eq(schema.vapidKeys.id, 'main')).limit(1);
      if (rows.length > 0) {
        return { publicKey: rows[0].publicKey, privateKey: rows[0].privateKey };
      }
    } catch (e) { }
  }

  ensureLocalDir();
  try {
    if (fs.existsSync(VAPID_FILE)) {
      return JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8') || '{}');
    }
  } catch (e) { }

  return { publicKey: '', privateKey: '' };
}

async function saveVapidKeys(keys) {
  if (isDbConnected && db) {
    try {
      await db.insert(schema.vapidKeys).values({
        id: 'main',
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
      }).onConflictDoUpdate({
        target: schema.vapidKeys.id,
        set: {
          publicKey: keys.publicKey,
          privateKey: keys.privateKey,
        }
      });
    } catch (e) { }
  }

  ensureLocalDir();
  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));
  } catch (e) { }
}

module.exports = {
  db,
  schema,
  isDbConnected: () => isDbConnected,
  initDatabaseTables,
  sortTeamDataByRoster,
  MASTER_ROSTER_ORDER,
  DEFAULT_USERS,
  getUsers,
  saveUsers,
  getUserByName,
  getDailyDraft,
  saveDailyDraft,
  addOrUpdateSubmission,
  getSubmissions,
  deleteSubmission,
  getConfig,
  saveConfig,
  getHistory,
  addHistory,
  getPushSubscriptions,
  savePushSubscription,
  removePushSubscription,
  getVapidKeys,
  saveVapidKeys,
};
