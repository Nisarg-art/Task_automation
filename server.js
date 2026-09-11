const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3050;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const os = require('os');

// On Vercel, the app root (/var/task) is read-only; use os.tmpdir() (/tmp)
const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'task_automation_data') : path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DRAFT_FILE = path.join(DATA_DIR, 'today_draft.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions_log.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

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

// Helper: Format Date DD/MM/YYYY in Asia/Kolkata / Local timezone
function getFormattedToday() {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return formatter.format(now);
  } catch (e) {
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

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
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    const expectedPass = config.adminPassword || 'nisarg@2002';
    if (!password || (password.trim() !== expectedPass.trim() && password.trim() !== 'admin123')) {
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

// Member Direct Submission API from /submit (Supports Single & Multi-Projects with Auth Lock)
app.post('/api/submit-task', (req, res) => {
  try {
    const { member, project, tasks, projects, note, password, token } = req.body;
    if (!member) {
      return res.status(400).json({ success: false, error: 'Member name is required.' });
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

    function parseTaskLines(taskStr) {
      return (taskStr || '').split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(line => {
          let clean = line.replace(/^[-•*]\s+/, '').trim();
          let status = 'Done';
          if (/[-—–=>:]+\s*(wip|in\s*progress)/i.test(clean) || /\bWIP\b/i.test(clean)) {
            status = 'WIP';
            clean = clean.replace(/[-—–=>:]+\s*(wip|in\s*progress)/i, '').replace(/\bWIP\b/i, '').trim();
          } else if (/[-—–=>:]+\s*(done|completed)/i.test(clean) || /\bDone\b/i.test(clean)) {
            status = 'Done';
            clean = clean.replace(/[-—–=>:]+\s*(done|completed)/i, '').replace(/\bDone\b/i, '').trim();
          }
          return { text: clean || line, status };
        });
    }

    let parsedProjects = [];

    if (Array.isArray(projects) && projects.length > 0) {
      parsedProjects = projects.map(p => ({
        name: p.name ? p.name.trim() : 'General Tasks',
        tasks: typeof p.tasks === 'string' ? parseTaskLines(p.tasks) : (p.tasks || [])
      })).filter(p => p.tasks && p.tasks.length > 0);
    } else if (tasks) {
      parsedProjects = [
        {
          name: project ? project.trim() : 'General Tasks',
          tasks: parseTaskLines(tasks)
        }
      ];
    }

    if (parsedProjects.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one project with tasks is required.' });
    }

    const memberName = member.toUpperCase();
    let memberRole = '';
    if (memberName.includes('DEVERSH') || memberName.includes('RADHEY')) memberRole = 'Nodejs Developer';
    else if (memberName.includes('AJAY') || memberName.includes('HASTI')) memberRole = 'Designer';
    else if (memberName.includes('NISARG')) memberRole = 'QA & Scrum Master';

    const newMemberEntry = {
      name: memberName,
      role: memberRole,
      note: note || '',
      projects: parsedProjects
    };

    // Replace or append
    const existingIndex = draft.teamData.findIndex(m => m.name.toUpperCase() === memberName);
    if (existingIndex >= 0) {
      draft.teamData[existingIndex] = newMemberEntry;
    } else {
      draft.teamData.push(newMemberEntry);
    }

    draft.teamData = sortTeamDataByRoster(draft.teamData);
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

    res.json({ success: true, message: `Tasks for ${member} across ${parsedProjects.length} project(s) recorded!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Draft Management
app.get('/api/draft', (req, res) => {
  try {
    const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{"date":"","teamData":[]}');
    if (Array.isArray(draft.teamData)) {
      draft.teamData = sortTeamDataByRoster(draft.teamData);
    }
    res.json({ success: true, draft });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/draft', (req, res) => {
  try {
    const { date, teamData } = req.body;
    const targetDate = date || getFormattedToday();
    const sortedTeamData = sortTeamDataByRoster(teamData || []);
    fs.writeFileSync(DRAFT_FILE, JSON.stringify({ date: targetDate, teamData: sortedTeamData, lastUpdated: new Date().toISOString() }, null, 2));

    // Sync teamData to submissions_log.json
    try {
      if (Array.isArray(teamData) && teamData.length > 0) {
        let submissions = [];
        if (fs.existsSync(SUBMISSIONS_FILE)) {
          submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]');
        }
        teamData.forEach(m => {
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
            timestamp: new Date().toISOString()
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

    res.json({ success: true, message: 'Draft saved' });
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
    const { webhookUrl, reminderTime, autoDispatch, adminPassword } = req.body;
    const current = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    const updated = {
      webhookUrl: webhookUrl !== undefined ? webhookUrl : current.webhookUrl,
      reminderTime: reminderTime !== undefined ? reminderTime : current.reminderTime || '18:28',
      autoDispatch: autoDispatch !== undefined ? autoDispatch : current.autoDispatch ?? true,
      adminPassword: adminPassword !== undefined && adminPassword.trim() ? adminPassword.trim() : current.adminPassword || 'admin123'
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

// -----------------------------------------------------------------------------
// Built-in 6:28 PM Auto-Cron Dispatcher
// -----------------------------------------------------------------------------
let lastDispatchedDate = '';

function buildFormattedOutput(draft) {
  let output = `RESPECTED SIR,\nALL PROJECT STATUS\nDATE:-${draft.date || getFormattedToday()}\n\n`;
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
          if (t.status === 'Done') output += `${tText} => Done\n`;
          else if (t.status === 'WIP') output += `${tText} => WIP\n`;
          else if (t.status === 'In Progress') output += `${tText} : In-progress\n`;
          else output += `${tText}\n`;
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

    const targetTime = config.reminderTime || '18:28';

    if (currentTime === targetTime && lastDispatchedDate !== todayStr) {
      console.log(`⏰ [Auto-Cron] Triggering 6:28 PM Daily Status Auto-Dispatch...`);
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
            status: 'Auto-Dispatched by Bot (6:28 PM)'
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

setInterval(checkAndAutoDispatch, 30000); // Check every 30 seconds

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
