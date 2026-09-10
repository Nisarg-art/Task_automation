const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3050;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DRAFT_FILE = path.join(DATA_DIR, 'today_draft.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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

const os = require('os');

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

// Helper: Format Date DD/MM/YYYY
function getFormattedToday() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
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

// Member Direct Submission API from /submit (Supports Single & Multi-Projects)
app.post('/api/submit-task', (req, res) => {
  try {
    const { member, project, tasks, projects, note } = req.body;
    if (!member) {
      return res.status(400).json({ success: false, error: 'Member name is required.' });
    }

    const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{"date":"","teamData":[]}');
    draft.date = getFormattedToday();

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
            clean = clean.replace(/[-—–=>:]+\s*(done|completed)/i, '').replace(/\bDone\b/i.test(clean), '').trim();
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

    fs.writeFileSync(DRAFT_FILE, JSON.stringify(draft, null, 2));
    res.json({ success: true, message: `Tasks for ${member} across ${parsedProjects.length} project(s) recorded!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Draft Management
app.get('/api/draft', (req, res) => {
  try {
    const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8') || '{"date":"","teamData":[]}');
    res.json({ success: true, draft });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/draft', (req, res) => {
  try {
    const { date, teamData } = req.body;
    fs.writeFileSync(DRAFT_FILE, JSON.stringify({ date, teamData, lastUpdated: new Date().toISOString() }, null, 2));
    res.json({ success: true, message: 'Draft saved' });
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
    const { webhookUrl, reminderTime, autoDispatch } = req.body;
    const current = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
    const updated = {
      webhookUrl: webhookUrl !== undefined ? webhookUrl : current.webhookUrl,
      reminderTime: reminderTime !== undefined ? reminderTime : current.reminderTime || '18:28',
      autoDispatch: autoDispatch !== undefined ? autoDispatch : current.autoDispatch ?? true
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
  (draft.teamData || []).forEach(member => {
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
