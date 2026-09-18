// Scrum Task Automator - Client Script (Real-time Aggregator & 6:28 PM Dispatcher)

const DEFAULT_TEAM_ROSTER = [
  { name: 'HARSHAD', role: '', defaultProject: 'RankMyTrip' },
  { name: 'KIRAN', role: '', defaultProject: 'FirstText App' },
  { name: 'DHRUV', role: '', defaultProject: 'Crystal Wish app' },
  { name: 'PRANAV', role: '', defaultProject: "Happy Reward's Dashboard Application" },
  { name: 'KARTIK', role: '', defaultProject: 'Happy Reward Shopify' },
  { name: 'DEVERSH', role: 'Nodejs Developer', defaultProject: 'SEC EDGAR Terminal' },
  { name: 'RADHEY', role: 'Nodejs Developer', defaultProject: 'AI-powered SEO/marketing platform' },
  { name: 'AJAY', role: 'Designer', defaultProject: 'Alarm App' },
  { name: 'HASTI', role: 'Designer', defaultProject: 'AI Life Mentor' },
  { name: 'NISARG', role: 'QA & Scrum Master', defaultProject: 'General Tasks' }
];

function sortTeamDataByRoster(teamData) {
  if (!Array.isArray(teamData)) return [];
  const rosterOrder = DEFAULT_TEAM_ROSTER.map(m => m.name.toUpperCase());
  return [...teamData].sort((a, b) => {
    const nameA = (a.name || a.member || '').toUpperCase().trim();
    const nameB = (b.name || b.member || '').toUpperCase().trim();
    let idxA = rosterOrder.indexOf(nameA);
    let idxB = rosterOrder.indexOf(nameB);
    if (idxA === -1) idxA = 999;
    if (idxB === -1) idxB = 999;
    return idxA - idxB;
  });
}

const SAMPLE_09_09_TEXT = `HARSHAD:- RankMyTrip:-

Tabbar UI => Done
Add Vehicle Screen UI => Done
Vehicle Success Screen UI => Done
How Did You Find Us Screen UI => Done
Drive Safe, Always Terms Privacy Screen UI => Done
Setting up your account Screen UI => Done
Car Select Brand Screen UI => Done
Car Select Brand Model Screen UI => Done
Drive Tab Screen UI => Done
Drive History List Screen UI => Done
Drive History Speed Distribution Screen UI => Done
Drive History G-Force Distribution Screen UI => WIP

KIRAN:- FirstText App:-

Fix bugs (3) => Done

SECOND NUMBER APP:- General Tasks:-

Fix bugs (4) => Done

SWEET SANTA APP:- General Tasks:-

Add premium flow => Done
Add new build => Done

THE CRYSTAL WISH APP:- General Tasks:-

Project setup => Done
Estimate sheet => Done
Add task in freedcamp => Done
Splash screen => Done
No internet screen => Done
Add packages => Done
Onboarding first => Done

DHRUV:- Crystal Wish app:-

research on Semantic Search => Done
script for add data => Done
generate audio api => Done

PRANAV:- Happy Reward's Dashboard Application:-

Enhanced and optimized the overall Dashboard UI/UX, improving usability, consistency, intuitive navigation, and overall user experience. Completed and successfully deployed the updated dashboard at https://happy-rewards-frontend.vercel.app . => Done

Happy Reward's INGENICO Application:-

Actively developing the Happy Rewards application for Ingenico AXIUM payment terminals, implementing SDK integrations, payment workflows, device capabilities, and security architecture ! => Done

KARTIK:- Happy Reward Shopify:- ON HALF DAY

Disabled the automated review message, added SMS credentials for Boss Vape, and created a video demonstrating how to update the Checkout Extension => Done
Implemented a promotional message for carts above $50 to encourage customers to spend $100 or more to earn additional points, and created a video demonstrating the functionality => Done

HAMILTON DABBAWALA:- General Tasks:-

Investigated and verified the issue where Membership visits were not being deducted properly => Done

VIP CANNABIS:- General Tasks:-

Added and configured background synchronization scripts on the server to sync all Orders and Products automatically => Done

DEVERSH(Nodejs Developer):- SEC EDGAR Terminal:-

Update TradeDetailModal styles and improve accessibility => Done
Update ingestion status timestamps and remove unused section from LandingPage => Done
Simplify active watchlist handling and clean up unused code in WatchlistManagementView => Done
Implement robust Stripe webhook handling and plan synchronization logic => Done
PlanGuard logic to support free tier and refine billing access test cases => Done
Subscription cancellation endpoint, improve trial status logic, and allow deletion of final watchlist => Done

RADHEY(Nodejs Developer):- AI-powered SEO/marketing platform:-

Merge all changes of Social module to main and deploy on vercel => Done
Analyze Search Atlas Ads Module and Investigate Its Internal Workflows => Done
Understand how google ads works => Done
Plan entire Architecture and list all features of ad module => Done
Explore and understand Google ads api => Done

AJAY(Designer):- Alarm App:-

Alarm Screen with multiple themes => Done
Habit Alarm Module => WIP

HASTI:- (Designer):- AI Life Mentor:-

Edit App Flow => Done

EXTRA TASK:- General Tasks:-

Exploring Figma Agent => Done
AI Models for Design => Done

NISARG:- (QA & Scrum Master):-

Do regression testing on PrivateLine second number app => Done
Do UI testing on FirstText app and raised a bug in freedcamp => Done
Discussed the issues I faced in the GLP-1 Tracker app with Dhruv => Done`;

// Helper: Format Date DD/MM/YYYY
function getFormattedToday() {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
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

// Helper: Format ISO Date YYYY-MM-DD
function getIsoToday(dateObj = new Date()) {
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

// App State
let state = {
  date: getFormattedToday(),
  webhookUrl: '',
  reminderTime: '18:28',
  teamData: [],
  history: [],
  filter: {
    period: 'daily',
    date: getIsoToday(),
    member: 'ALL',
    search: '',
    results: []
  }
};

// DOM Elements
const reportDateInput = document.getElementById('reportDate');
const singleChatInput = document.getElementById('singleChatInput');
const quickMemberSelect = document.getElementById('quickMemberSelect');
const btnMergeSingle = document.getElementById('btnMergeSingle');
const btnQuickHarshad = document.getElementById('btnQuickHarshad');
const rawTextInput = document.getElementById('rawTextInput');
const formattedOutputText = document.getElementById('formattedOutputText');
const btnParseRaw = document.getElementById('btnParseRaw');
const btnLoadSample = document.getElementById('btnLoadSample');
const btnClearInput = document.getElementById('btnClearInput');
const btnCopyFormat = document.getElementById('btnCopyFormat');
const btnSendChat = document.getElementById('btnSendChat');
const btnQuickCheckDone = document.getElementById('btnQuickCheckDone');
const btnOpenSettings = document.getElementById('btnOpenSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnSaveWebhook = document.getElementById('btnSaveWebhook');
const btnTestWebhook = document.getElementById('btnTestWebhook');
const settingsModal = document.getElementById('settingsModal');
const webhookUrlInput = document.getElementById('webhookUrlInput');
const reminderTimeInput = document.getElementById('reminderTimeInput');
const displayReminderTime = document.getElementById('displayReminderTime');
const reminderBadge = document.getElementById('reminderBadge');
const reminderBanner = document.getElementById('reminderBanner');
const btnDismissBanner = document.getElementById('btnDismissBanner');
const webhookTestResult = document.getElementById('webhookTestResult');
const webhookBadge = document.getElementById('webhookBadge');
const statWebhook = document.getElementById('statWebhook');
const membersContainer = document.getElementById('membersContainer');
const rosterPills = document.getElementById('rosterPills');
const trackerCount = document.getElementById('trackerCount');
const btnAddMember = document.getElementById('btnAddMember');
const btnPreloadTeam = document.getElementById('btnPreloadTeam');
const btnClearAll = document.getElementById('btnClearAll');
const historyList = document.getElementById('historyList');

// Filter & Calendar DOM Elements
const historyDatePicker = document.getElementById('historyDatePicker');
const historyMemberSelect = document.getElementById('historyMemberSelect');
const historySearchInput = document.getElementById('historySearchInput');
const periodToggleGroup = document.getElementById('periodToggleGroup');
const btnApplyFilter = document.getElementById('btnApplyFilter');
const btnResetFilter = document.getElementById('btnResetFilter');
const btnDateToday = document.getElementById('btnDateToday');
const btnDateYesterday = document.getElementById('btnDateYesterday');
const btnCopyFilteredSummary = document.getElementById('btnCopyFilteredSummary');
const btnLoadFilteredToMaster = document.getElementById('btnLoadFilteredToMaster');
const filterSummaryText = document.getElementById('filterSummaryText');
const fStatSubmissions = document.getElementById('fStatSubmissions');
const fStatMembers = document.getElementById('fStatMembers');
const fStatDone = document.getElementById('fStatDone');
const fStatWIP = document.getElementById('fStatWIP');
const historyResultsContainer = document.getElementById('historyResultsContainer');

// Stats Elements
const statMembers = document.getElementById('statMembers');
const statProjects = document.getElementById('statProjects');
const statDone = document.getElementById('statDone');
const statWIP = document.getElementById('statWIP');

// Admin Auth DOM Elements
const ADMIN_AUTH_KEY = 'scrum_admin_auth_v1';
const adminGateModal = document.getElementById('adminGateModal');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminAuthPassword = document.getElementById('adminAuthPassword');
const adminLoginError = document.getElementById('adminLoginError');
const adminLoginErrorText = document.getElementById('adminLoginErrorText');
const btnAdminLoginSubmit = document.getElementById('btnAdminLoginSubmit');
const btnAdminLogout = document.getElementById('btnAdminLogout');
const adminPasswordInputConfig = document.getElementById('adminPasswordInputConfig');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  reportDateInput.value = state.date;
  if (historyDatePicker) historyDatePicker.value = state.filter.date;
  
  checkAdminAuth();
  await loadConfig();
  await loadHistory();
  await loadTodayDraft();
  await fetchAndRenderSubmissions();

  setupEventListeners();
  setupFilterEventListeners();
  setupAdminAuthListeners();
  startReminderClock();
  initAdminPushServiceWorker();
});

function checkAdminAuth() {
  const token = localStorage.getItem(ADMIN_AUTH_KEY);
  if (!token) {
    if (adminGateModal) adminGateModal.classList.remove('hidden');
  } else {
    if (adminGateModal) adminGateModal.classList.add('hidden');
  }
}

function setupAdminAuthListeners() {
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = adminAuthPassword.value.trim();
      if (!password) return;

      btnAdminLoginSubmit.disabled = true;
      btnAdminLoginSubmit.textContent = 'Verifying...';
      adminLoginError.classList.add('hidden');

      try {
        const res = await fetch('/api/auth/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();

        if (data.success && data.token) {
          localStorage.setItem(ADMIN_AUTH_KEY, data.token);
          adminGateModal.classList.add('hidden');
          adminAuthPassword.value = '';
          showToast('👑 Welcome back, Nisarg! Admin unlocked.', 'success');
          await loadTodayDraft(false, true);
          await fetchAndRenderSubmissions();
        } else {
          adminLoginError.classList.remove('hidden');
          adminLoginErrorText.textContent = data.error || 'Incorrect Admin password.';
        }
      } catch (err) {
        adminLoginError.classList.remove('hidden');
        adminLoginErrorText.textContent = 'Connection error: ' + err.message;
      } finally {
        btnAdminLoginSubmit.disabled = false;
        btnAdminLoginSubmit.textContent = '🔓 Unlock Admin Dashboard';
      }
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      if (confirm('Lock Admin Dashboard and log out?')) {
        localStorage.removeItem(ADMIN_AUTH_KEY);
        if (adminGateModal) adminGateModal.classList.remove('hidden');
        showToast('Admin Dashboard locked.', 'info');
      }
    });
  }
}

function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');

      if (tabId === 'history-tab') {
        loadHistory();
      } else if (tabId === 'filter-tab') {
        fetchAndRenderSubmissions();
      }
    });
  });

  // Date Change
  reportDateInput.addEventListener('input', (e) => {
    state.date = e.target.value.trim() || getFormattedToday();
    generateFormattedOutput();
    saveTodayDraft(true);
  });

  // Manual Live Sync Button
  const btnRefreshLiveDraft = document.getElementById('btnRefreshLiveDraft');
  if (btnRefreshLiveDraft) {
    btnRefreshLiveDraft.addEventListener('click', async () => {
      btnRefreshLiveDraft.disabled = true;
      btnRefreshLiveDraft.textContent = '🔄 Syncing...';
      await loadTodayDraft(false, true);
      await fetchAndRenderSubmissions();
      showToast('⚡ Live submissions synced!', 'success');
      btnRefreshLiveDraft.disabled = false;
      btnRefreshLiveDraft.textContent = '🔄 Sync Now';
    });
  }

  // Lightbox Modal Close Listeners
  const lightboxModal = document.getElementById('lightboxModal');
  const btnLightboxClose = document.getElementById('btnLightboxClose');
  if (btnLightboxClose) {
    btnLightboxClose.addEventListener('click', closeAdminLightbox);
  }
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeAdminLightbox();
    });
  }

  // Merge Single 1-on-1 Chat Update
  btnMergeSingle.addEventListener('click', mergeSingleUpdate);

  // Quick Test Sample Update
  btnQuickHarshad.addEventListener('click', () => {
    singleChatInput.value = `HARSHAD:- RankMyTrip:-
Tabbar UI => Done
Add Vehicle Screen UI => Done
Drive History G-Force Distribution Screen UI => WIP`;
    showToast('Sample 1-on-1 update loaded into box. Click Merge Update!', 'info');
  });

  // Bulk Parse Raw
  btnParseRaw.addEventListener('click', () => {
    const text = rawTextInput.value.trim();
    if (!text) {
      showToast('Please paste tasks text first', 'warning');
      return;
    }
    state.teamData = parseRawTasks(text);
    renderBuilder();
    generateFormattedOutput();
    renderChecklistTracker();
    saveTodayDraft(true);
    showToast('Parsed and updated today\'s master report!', 'success');
  });

  // Load Sample
  btnLoadSample.addEventListener('click', () => {
    rawTextInput.value = SAMPLE_09_09_TEXT;
    state.teamData = parseRawTasks(SAMPLE_09_09_TEXT);
    renderBuilder();
    generateFormattedOutput();
    renderChecklistTracker();
    saveTodayDraft(true);
    showToast('Loaded 09/09 sample status report!', 'info');
  });

  // Copy Team Portal Link
  const btnCopyTeamLink = document.getElementById('btnCopyTeamLink');
  if (btnCopyTeamLink) {
    btnCopyTeamLink.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/info');
        const data = await res.json();
        const submitUrl = data.submitUrl || `${window.location.origin}/submit`;
        navigator.clipboard.writeText(submitUrl).then(() => {
          showToast(`📋 Copied Team Submit Link: ${submitUrl}`, 'success');
        });
      } catch (e) {
        const submitUrl = `${window.location.origin}/submit`;
        navigator.clipboard.writeText(submitUrl).then(() => {
          showToast(`📋 Copied Team Submit Link: ${submitUrl}`, 'success');
        });
      }
    });
  }

  // Clear Input
  btnClearInput.addEventListener('click', () => {
    rawTextInput.value = '';
    state.teamData = [];
    renderBuilder();
    generateFormattedOutput();
    renderChecklistTracker();
    saveTodayDraft(true);
  });

  // Copy Formatted Output
  btnCopyFormat.addEventListener('click', () => {
    const text = formattedOutputText.getAttribute('data-plain-text') || formattedOutputText.textContent;
    if (!text) {
      showToast('Nothing to copy!', 'error');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied formatted status to clipboard!', 'success');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copied formatted status to clipboard!', 'success');
    });
  });

  // Send to Google Chat
  btnSendChat.addEventListener('click', sendToGoogleChat);
  btnQuickCheckDone.addEventListener('click', sendToGoogleChat);

  // Settings Modal
  btnOpenSettings.addEventListener('click', openSettingsModal);
  reminderBadge.addEventListener('click', openSettingsModal);

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  btnSaveWebhook.addEventListener('click', saveConfig);
  btnTestWebhook.addEventListener('click', testWebhook);

  btnDismissBanner.addEventListener('click', () => {
    reminderBanner.classList.add('hidden');
  });

  // Builder Actions
  btnAddMember.addEventListener('click', () => {
    state.teamData.push({
      name: 'NEW MEMBER',
      role: '',
      note: '',
      projects: [
        {
          name: 'Project Name',
          tasks: [
            { text: 'Task description', status: 'Done' }
          ]
        }
      ]
    });
    renderBuilder();
    generateFormattedOutput();
    renderChecklistTracker();
    saveTodayDraft(true);
  });

  btnPreloadTeam.addEventListener('click', () => {
    rawTextInput.value = SAMPLE_09_09_TEXT;
    state.teamData = parseRawTasks(SAMPLE_09_09_TEXT);
    renderBuilder();
    generateFormattedOutput();
    renderChecklistTracker();
    saveTodayDraft(true);
    showToast('Loaded full team template!', 'success');
  });

  btnClearAll.addEventListener('click', () => {
    if (confirm('Clear today\'s master report and start fresh?')) {
      state.teamData = [];
      rawTextInput.value = '';
      singleChatInput.value = '';
      renderBuilder();
      generateFormattedOutput();
      renderChecklistTracker();
      saveTodayDraft(true);
      showToast('Cleared today\'s report draft', 'info');
    }
  });

  // Settings Sub-Tabs
  document.querySelectorAll('.settings-tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
      tabBtn.classList.add('active');
      const targetId = tabBtn.getAttribute('data-target');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');

      if (targetId === 'settings-passwords-tab') {
        loadUserPasswords();
      }
    });
  });

  // Copy All Passcodes Button
  const btnCopyAllPasscodes = document.getElementById('btnCopyAllPasscodes');
  if (btnCopyAllPasscodes) {
    btnCopyAllPasscodes.addEventListener('click', copyAllPasscodes);
  }
}

async function openSettingsModal() {
  webhookUrlInput.value = state.webhookUrl || '';
  reminderTimeInput.value = state.reminderTime || '18:28';
  webhookTestResult.classList.add('hidden');
  settingsModal.classList.remove('hidden');
  await loadUserPasswords();
}

let cachedUsers = [];

async function loadUserPasswords() {
  const container = document.getElementById('userPasswordsList');
  if (!container) return;

  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      cachedUsers = data.users;
      renderUserPasswordsList(data.users);
    }
  } catch (e) {
    console.error('Failed to load user passwords:', e);
  }
}

function renderUserPasswordsList(users) {
  const container = document.getElementById('userPasswordsList');
  if (!container) return;
  container.innerHTML = '';

  users.forEach(u => {
    const row = document.createElement('div');
    row.className = 'user-password-row';

    const info = document.createElement('div');
    info.className = 'user-password-info';

    const name = document.createElement('span');
    name.className = 'user-pw-name';
    name.textContent = u.name;
    info.appendChild(name);

    if (u.role) {
      const role = document.createElement('span');
      role.className = 'role-tag-badge';
      role.textContent = u.role;
      info.appendChild(role);
    }

    const inputWrap = document.createElement('div');
    inputWrap.className = 'user-pw-input-wrap';

    const passInput = document.createElement('input');
    passInput.type = 'text';
    passInput.className = 'user-pw-field';
    passInput.value = u.password || '';
    passInput.setAttribute('data-id', u.id);
    passInput.addEventListener('input', (e) => {
      u.password = e.target.value.trim();
    });

    const btnCopyOne = document.createElement('button');
    btnCopyOne.type = 'button';
    btnCopyOne.className = 'btn btn-xs btn-ghost';
    btnCopyOne.title = `Copy passcode for ${u.name}`;
    btnCopyOne.textContent = '📋';
    btnCopyOne.addEventListener('click', () => {
      const textToCopy = `Hi ${u.name}, your Daily Status portal link is: ${window.location.origin}/submit\nYour Passcode is: ${u.password}`;
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast(`Copied login credentials for ${u.name}!`, 'success');
      });
    });

    inputWrap.appendChild(passInput);
    inputWrap.appendChild(btnCopyOne);

    row.appendChild(info);
    row.appendChild(inputWrap);
    container.appendChild(row);
  });
}

function copyAllPasscodes() {
  if (cachedUsers.length === 0) return;
  let text = `🔐 TEAM MEMBER PORTAL CREDENTIALS\nSubmit Link: ${window.location.origin}/submit\n\n`;
  cachedUsers.forEach(u => {
    let roleStr = u.role ? ` (${u.role})` : '';
    text += `• ${u.name}${roleStr} ➔ Passcode: ${u.password}\n`;
  });

  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Copied all employee credentials to clipboard!', 'success');
  });
}

function parseMemberProjectsAndTasks(rawText, defaultProjectName = 'General Tasks') {
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

// -----------------------------------------------------------------------------
// Single 1-on-1 Chat Update Ingestion Engine
// -----------------------------------------------------------------------------
function mergeSingleUpdate() {
  const text = singleChatInput.value.trim();
  if (!text) {
    showToast('Please paste the update text received from the team member', 'warning');
    return;
  }

  const selectedTarget = quickMemberSelect.value;
  let parsedMembers = parseRawTasks(text);

  if (parsedMembers.length === 0) {
    if (selectedTarget && selectedTarget !== 'AUTO') {
      const parsedProjects = parseMemberProjectsAndTasks(text, getDefaultProjectForMember(selectedTarget));
      parsedMembers = [{
        name: selectedTarget,
        role: getRoleForMember(selectedTarget),
        note: '',
        projects: parsedProjects.length > 0 ? parsedProjects : [{
          name: getDefaultProjectForMember(selectedTarget),
          tasks: text.split('\n').filter(l => l.trim()).map(l => parseTaskStatus(l))
        }]
      }];
    } else {
      showToast('Could not detect member name. Please select a member from the dropdown or include their name.', 'error');
      return;
    }
  }

  // Merge each parsed member into state.teamData
  parsedMembers.forEach(newMember => {
    const existingIndex = state.teamData.findIndex(m => m.name.toUpperCase() === newMember.name.toUpperCase());

    if (existingIndex >= 0) {
      // Update existing member
      state.teamData[existingIndex] = newMember;
    } else {
      // Append new member
      state.teamData.push(newMember);
    }
  });

  state.teamData = sortTeamDataByRoster(state.teamData);

  // Re-render UI & Save Draft
  renderBuilder();
  generateFormattedOutput();
  renderChecklistTracker();
  saveTodayDraft(true);

  singleChatInput.value = '';
  showToast(`✓ Merged update for ${parsedMembers.map(m => m.name).join(', ')} into today's report!`, 'success');
}

function getRoleForMember(name) {
  const match = DEFAULT_TEAM_ROSTER.find(m => m.name.toUpperCase() === name.toUpperCase());
  return match ? match.role : '';
}

function getDefaultProjectForMember(name) {
  const match = DEFAULT_TEAM_ROSTER.find(m => m.name.toUpperCase() === name.toUpperCase());
  return match ? match.defaultProject : 'General Tasks';
}

// -----------------------------------------------------------------------------
// Submission Tracker Checklist (Clean & Uncluttered: Grey when Pending, Green when Submitted)
// -----------------------------------------------------------------------------
function renderChecklistTracker() {
  rosterPills.innerHTML = '';
  let submittedCount = 0;

  const currentNames = state.teamData
    .filter(m => (m.projects && m.projects.length > 0 && m.projects.some(p => p.tasks && p.tasks.length > 0)) || (m.note && m.note.trim() && !m.note.toUpperCase().includes('LEAVE')))
    .map(m => (m.name || '').toUpperCase().trim());

  DEFAULT_TEAM_ROSTER.forEach(member => {
    const isSubmitted = currentNames.includes(member.name.toUpperCase());
    const memberData = state.teamData.find(m => (m.name || '').toUpperCase().trim() === member.name.toUpperCase());
    const isLeave = memberData && (memberData.note || '').toUpperCase().includes('LEAVE');
    if (isSubmitted || isLeave) submittedCount++;

    const pill = document.createElement('div');
    if (isLeave) {
      pill.className = 'roster-pill leave';
      pill.innerHTML = `
        <span class="pill-dot red"></span>
        <span>${member.name} (Leave)</span>
      `;
    } else {
      pill.className = `roster-pill ${isSubmitted ? 'submitted' : 'pending'}`;
      pill.innerHTML = `
        <span class="pill-dot ${isSubmitted ? 'green' : 'grey'}"></span>
        <span>${member.name}</span>
      `;
    }

    pill.addEventListener('click', () => {
      quickMemberSelect.value = member.name;
      document.querySelector('[data-tab="single-drop-tab"]').click();
      singleChatInput.focus();
      showToast(`Ready to drop update for ${member.name}`, 'info');
    });

    rosterPills.appendChild(pill);
  });

  trackerCount.textContent = `${submittedCount} / ${DEFAULT_TEAM_ROSTER.length} Received`;
}

// -----------------------------------------------------------------------------
// Ultra-Clean Parser & Formatting Engine
// -----------------------------------------------------------------------------
function parseRawTasks(text) {
  if (!text || !text.trim()) return [];

  const lines = text.split('\n');
  const members = [];
  let currentMember = null;
  let currentProject = null;

  for (let i = 0; i < lines.length; i++) {
    let rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Ignore top headers
    if (/^[*_]*(RESPECTED SIR|ALL PROJECT STATUS|DATE\s*:-)/i.test(rawLine)) {
      continue;
    }

    // Check for Member line:
    // e.g. "HARSHAD:- RankMyTrip:-", "DEVERSH(Nodejs Developer):- SEC EDGAR Terminal:-"
    // "**HASTI: (Designer):- AI Life Mentor:- **", "KARTIK:- Happy Reward Shopify:- ON HALF DAY"
    // "EXTRA TASK:- General Tasks:-"
    const cleanedLine = rawLine.replace(/^\*\*|\*\*$/g, '').trim();

    // Check if line matches Member header
    const memberHeaderMatch = cleanedLine.match(/^([A-Z0-9\s&_\-\./\(\)]+?)(?:\s*\(([^)]+)\))?\s*:\s*[-—–]?\s*(.*?)$/i);

    if (memberHeaderMatch && isLikelyMember(memberHeaderMatch[1])) {
      let memberName = memberHeaderMatch[1].replace(/[-—–:]+$/g, '').trim().toUpperCase();
      let role = memberHeaderMatch[2] ? memberHeaderMatch[2].trim() : '';
      let remaining = memberHeaderMatch[3] ? memberHeaderMatch[3].trim() : '';

      // Clean up role if it was inside memberName or remaining
      if (!role && memberName.includes('(') && memberName.includes(')')) {
        const rMatch = memberName.match(/^(.*?)\s*\((.*?)\)$/);
        if (rMatch) {
          memberName = rMatch[1].trim();
          role = rMatch[2].trim();
        }
      }

      let note = '';
      let projectName = '';

      if (remaining.toUpperCase().includes('ON HALF DAY') || remaining.toUpperCase().includes('ON LEAVE')) {
        if (remaining.includes(':-') || remaining.includes(':')) {
          const parts = remaining.split(/[:-]+/);
          projectName = parts[0].trim();
          note = parts.slice(1).join(' ').trim();
        } else {
          note = remaining;
        }
      } else if (remaining) {
        projectName = remaining.replace(/^[-—–:]+|[-—–:]+$/g, '').trim();
      }

      currentMember = {
        name: memberName,
        role: role,
        note: note,
        projects: []
      };
      members.push(currentMember);

      if (projectName) {
        currentProject = {
          name: projectName,
          tasks: []
        };
        currentMember.projects.push(currentProject);
      } else {
        currentProject = null;
      }
      continue;
    }

    // Check if line is a secondary project header under current member
    // e.g. "SECOND NUMBER APP:- General Tasks:-", "SWEET SANTA APP:- General Tasks:-", "Second Number App:-"
    const projectMatch = cleanedLine.match(/^([A-Za-z0-9\s&'\-\.\/]+?)(?::\s*[-—–]?|[-—–]\s*:|:-)(?:\s*General Tasks\s*:-?)?$/i);
    if (projectMatch && currentMember && !isLikelyTask(cleanedLine)) {
      let projName = projectMatch[1].replace(/^[-—–:]+|[-—–:]+$/g, '').trim();
      currentProject = {
        name: projName,
        tasks: []
      };
      currentMember.projects.push(currentProject);
      continue;
    }

    // Otherwise, this line is a task
    if (currentMember) {
      if (!currentProject) {
        if (currentMember.projects.length === 0) {
          currentProject = { name: getDefaultProjectForMember(currentMember.name), tasks: [] };
          currentMember.projects.push(currentProject);
        } else {
          currentProject = currentMember.projects[currentMember.projects.length - 1];
        }
      }

      const parsedTask = parseTaskStatus(cleanedLine);
      if (parsedTask.text) {
        currentProject.tasks.push(parsedTask);
      }
    }
  }

  return sortTeamDataByRoster(members);
}

function isLikelyMember(str) {
  if (!str) return false;
  const clean = str.trim().toUpperCase();
  const nonMembers = ['RESPECTED', 'ALL', 'DATE', 'NOTE', 'TODAY', 'PROJECT', 'TASK'];
  if (nonMembers.includes(clean)) return false;

  const isRoster = DEFAULT_TEAM_ROSTER.some(m => {
    const mName = m.name.toUpperCase();
    return clean === mName || clean.startsWith(mName + '(') || clean.startsWith(mName + ' ');
  });
  if (isRoster) return true;

  // Project names or task words are NOT members
  const knownProjects = ['RANKMYTRIP', 'FIRSTTEXT', 'CRYSTAL WISH', 'HAPPY REWARD', 'SEC EDGAR', 'BEFOREVER', 'ALARM', 'AI LIFE', 'QA & TESTING', 'REPLYDM', 'SECOND NUMBER', 'SWEET SANTA'];
  if (knownProjects.some(p => clean.includes(p))) return false;

  const taskVerbs = /^(VALIDATE|TEST|START|CREATE|FIX|UPDATE|IMPLEMENT|BUILD|DEPLOY|DO|CHECK|ADD|MODIFY|RESEARCH|MEETING|CALL|WORK|REVIEW|RESOLVE|DESIGN|SETUP|CONFIGURE|ENHANCE)/;
  if (taskVerbs.test(clean)) return false;

  return clean.length >= 2 && clean.length <= 30;
}

function isLikelyTask(str) {
  if (!str) return false;
  const lower = str.toLowerCase();
  return lower.includes('->') || 
         lower.includes('=>') || 
         lower.includes('done') || 
         lower.includes('wip') || 
         lower.includes('in-progress') || 
         lower.includes('complete') ||
         lower.startsWith('fix') ||
         lower.startsWith('change') ||
         lower.startsWith('add') ||
         lower.startsWith('meeting') ||
         lower.startsWith('validate') ||
         lower.startsWith('create') ||
         lower.startsWith('implement') ||
         lower.startsWith('do ') ||
         lower.startsWith('test');
}

function parseTaskStatus(line) {
  let cleaned = line.replace(/^\*\*|\*\*$/g, '').replace(/^[-•*]\s+/, '').trim();
  let status = 'Done';
  let taskText = cleaned;

  // Pattern matchers
  const doneRegex = /[-—–=>:]+\s*(done|completed|complete)\s*$/i;
  const wipRegex = /[-—–=>:]+\s*(wip|in\s*progress|in-progress|working)\s*$/i;
  const halfDayRegex = /[-—–=>:]+\s*(on half day|half day)\s*$/i;

  if (wipRegex.test(cleaned)) {
    status = 'WIP';
    taskText = cleaned.replace(wipRegex, '').trim();
  } else if (doneRegex.test(cleaned)) {
    status = 'Done';
    taskText = cleaned.replace(doneRegex, '').trim();
  } else if (halfDayRegex.test(cleaned)) {
    status = 'On Half Day';
    taskText = cleaned.replace(halfDayRegex, '').trim();
  } else if (/(\s+Done)$/i.test(cleaned)) {
    status = 'Done';
    taskText = cleaned.replace(/(\s+Done)$/i, '').trim();
  } else if (/(\s+WIP)$/i.test(cleaned)) {
    status = 'WIP';
    taskText = cleaned.replace(/(\s+WIP)$/i, '').trim();
  }

  // Clean trailing punctuation / arrows
  taskText = taskText.replace(/[-—–=>:]+$/, '').replace(/^\*\*|\*\*$/g, '').trim();

  return {
    raw: line,
    text: taskText || cleaned,
    status: status
  };
}

function generateFormattedOutput() {
  state.teamData = sortTeamDataByRoster(state.teamData);
  let plainText = '';
  plainText += `*RESPECTED SIR,*\n`;
  plainText += `*ALL PROJECT STATUS*\n`;
  plainText += `*DATE:-${state.date}*\n\n`;

  let htmlPreview = '';
  htmlPreview += `<strong>RESPECTED SIR,</strong>\n`;
  htmlPreview += `<strong>ALL PROJECT STATUS</strong>\n`;
  htmlPreview += `<strong>DATE:-${state.date}</strong>\n\n`;

  let totalMembers = state.teamData.length;
  let totalProjects = 0;
  let totalDone = 0;
  let totalWIP = 0;

  if (state.teamData.length === 0) {
    plainText += `(Waiting for team updates to be submitted...)\n`;
    htmlPreview += `<div class="empty-preview-notice" style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 13px; font-weight: 500; border: 1px dashed var(--border-color); border-radius: 8px; margin-top: 10px;">⏳ <em>No team updates submitted yet for today.<br>Members can submit at <strong>/submit</strong> or use the Single Drop tab above.</em></div>\n`;
  }

  state.teamData.forEach((member, mIdx) => {
    let roleStr = member.role ? `(${member.role})` : '';
    let cleanNote = member.note ? member.note.replace(/^[:-]+|[:-]+$/g, '').trim() : '';

    // Plain text note & HTML red note
    let notePlainText = cleanNote ? ` *${cleanNote}*` : '';
    let noteHtml = cleanNote ? ` <span class="attendance-red-bold" style="color: #ef4444; font-weight: 800; background: rgba(239, 68, 68, 0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.4);">*${cleanNote}*</span>` : '';

    if (member.projects && member.projects.length > 0) {
      member.projects.forEach((proj, pIdx) => {
        totalProjects++;
        let cleanProjName = proj.name ? proj.name.replace(/^[:-]+|[:-]+$/g, '').trim() : '';

        if (pIdx === 0) {
          let projDisplay = cleanProjName ? ` ${cleanProjName}:-` : ':-';
          let headerContent = member.role 
            ? `${member.name}${roleStr}:-${projDisplay}` 
            : `${member.name}:-${projDisplay}`;

          plainText += `*${headerContent}*${notePlainText}\n\n`;
          htmlPreview += `<strong class="header-bold">*${headerContent}*</strong>${noteHtml}\n\n`;
        } else {
          // Secondary project
          plainText += `*${cleanProjName}:-*\n\n`;
          htmlPreview += `<strong class="header-bold">*${cleanProjName}:-*</strong>\n\n`;
        }

        // Render tasks with bullet points
        if (proj.tasks && proj.tasks.length > 0) {
          proj.tasks.forEach(t => {
            let taskText = t.text.trim();
            if (t.status === 'Done') {
              totalDone++;
              plainText += `• ${taskText} => Done\n`;
              htmlPreview += `• ${taskText} => <span style="color: #10b981; font-weight: 600;">Done</span>\n`;
            } else if (t.status === 'WIP') {
              totalWIP++;
              plainText += `• ${taskText} => WIP\n`;
              htmlPreview += `• ${taskText} => <span style="color: #f59e0b; font-weight: 600;">WIP</span>\n`;
            } else if (t.status === 'In Progress') {
              totalWIP++;
              plainText += `• ${taskText} : In-progress\n`;
              htmlPreview += `• ${taskText} : <span style="color: #f59e0b; font-weight: 600;">In-progress</span>\n`;
            } else {
              totalDone++;
              plainText += `• ${taskText} => Done\n`;
              htmlPreview += `• ${taskText} => <span style="color: #10b981; font-weight: 600;">Done</span>\n`;
            }
          });
        }
        plainText += `\n`;
        htmlPreview += `\n`;
      });
    } else {
      let headerContent = member.role ? `${member.name}${roleStr}:-` : `${member.name}:-`;
      plainText += `*${headerContent}*${notePlainText}\n\n`;
      htmlPreview += `<strong class="header-bold">*${headerContent}*</strong>${noteHtml}\n\n`;
    }
  });

  formattedOutputText.innerHTML = htmlPreview.trimEnd();
  formattedOutputText.setAttribute('data-plain-text', plainText.trimEnd());

  if (rawTextInput && !isUserTyping) {
    rawTextInput.value = plainText.trimEnd();
  }

  // Update Stats
  statMembers.textContent = totalMembers;
  statProjects.textContent = totalProjects;
  statDone.textContent = totalDone;
  statWIP.textContent = totalWIP;

  const now = new Date();
  document.getElementById('previewTimestamp').textContent = `Today at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// -----------------------------------------------------------------------------
// Interactive Builder UI
// -----------------------------------------------------------------------------
function renderBuilder() {
  membersContainer.innerHTML = '';
  state.teamData = sortTeamDataByRoster(state.teamData);

  if (state.teamData.length === 0) {
    membersContainer.innerHTML = '<div class="empty-state">No members loaded yet. Drop updates in "Quick 1-on-1 Chat Drop" or load template.</div>';
    return;
  }

  state.teamData.forEach((member, mIdx) => {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.setAttribute('data-member-name', (member.name || '').toUpperCase().trim());

    const cardHeader = document.createElement('div');
    cardHeader.className = 'member-card-header';

    const infoInputs = document.createElement('div');
    infoInputs.className = 'member-info-inputs';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'input-field input-name';
    nameInput.value = member.name;
    nameInput.addEventListener('input', (e) => {
      hasUnsavedChanges = true;
      if (member.name) editedMemberNames.add(member.name.toUpperCase());
      member.name = e.target.value.toUpperCase();
      if (member.name) editedMemberNames.add(member.name.toUpperCase());
      generateFormattedOutput();
      renderChecklistTracker();
      saveTodayDraft(false);
    });
    nameInput.addEventListener('blur', () => {
      if (hasUnsavedChanges) saveTodayDraft(true);
    });

    const roleInput = document.createElement('input');
    roleInput.type = 'text';
    roleInput.className = 'input-field input-role';
    roleInput.placeholder = 'Role (e.g. Nodejs Developer)';
    roleInput.value = member.role;
    roleInput.addEventListener('input', (e) => {
      hasUnsavedChanges = true;
      if (member.name) editedMemberNames.add(member.name.toUpperCase());
      member.role = e.target.value;
      generateFormattedOutput();
      saveTodayDraft(false);
    });
    roleInput.addEventListener('blur', () => {
      if (hasUnsavedChanges) saveTodayDraft(true);
    });

    const noteSelect = document.createElement('select');
    noteSelect.className = 'input-field input-role';
    const noteOptions = [
      { label: 'Full Day', val: '' },
      { label: 'ON HALF DAY', val: 'ON HALF DAY' },
      { label: 'ON LEAVE', val: 'ON LEAVE' },
      { label: 'WFH', val: 'WFH' }
    ];
    noteOptions.forEach(opt => {
      const optEl = document.createElement('option');
      optEl.value = opt.val;
      optEl.textContent = opt.label;
      if ((member.note || '').toUpperCase() === opt.val) optEl.selected = true;
      noteSelect.appendChild(optEl);
    });
    noteSelect.addEventListener('change', (e) => {
      hasUnsavedChanges = true;
      if (member.name) editedMemberNames.add(member.name.toUpperCase());
      member.note = e.target.value;
      generateFormattedOutput();
      saveTodayDraft(true);
    });

    infoInputs.appendChild(nameInput);
    infoInputs.appendChild(roleInput);
    infoInputs.appendChild(noteSelect);

    const btnDeleteMember = document.createElement('button');
    btnDeleteMember.className = 'btn btn-xs btn-ghost text-red';
    btnDeleteMember.innerHTML = '&times; Remove';
    btnDeleteMember.addEventListener('click', () => {
      hasUnsavedChanges = true;
      if (member.name) {
        editedMemberNames.add(member.name.toUpperCase());
        explicitlyDeletedMembers.add(member.name.toUpperCase());
      }
      state.teamData.splice(mIdx, 1);
      renderBuilder();
      generateFormattedOutput();
      renderChecklistTracker();
      saveTodayDraft(true);
    });

    cardHeader.appendChild(infoInputs);
    cardHeader.appendChild(btnDeleteMember);
    card.appendChild(cardHeader);

    // Projects
    member.projects.forEach((proj, pIdx) => {
      const projBlock = document.createElement('div');
      projBlock.style.marginTop = '8px';

      const projHeader = document.createElement('div');
      projHeader.style.display = 'flex';
      projHeader.style.alignItems = 'center';
      projHeader.style.gap = '8px';
      projHeader.style.marginBottom = '6px';

      const projInput = document.createElement('input');
      projInput.type = 'text';
      projInput.className = 'input-field input-project';
      projInput.value = proj.name;
      projInput.addEventListener('input', (e) => {
        hasUnsavedChanges = true;
        if (member.name) editedMemberNames.add(member.name.toUpperCase());
        proj.name = e.target.value;
        generateFormattedOutput();
        saveTodayDraft(false);
      });
      projInput.addEventListener('blur', () => {
        if (hasUnsavedChanges) saveTodayDraft(true);
      });

      const btnAddTask = document.createElement('button');
      btnAddTask.className = 'btn btn-xs btn-outline';
      btnAddTask.textContent = '+ Add Task';
      btnAddTask.addEventListener('click', () => {
        hasUnsavedChanges = true;
        if (member.name) editedMemberNames.add(member.name.toUpperCase());
        proj.tasks.push({ text: 'New task update', status: 'Done' });
        renderBuilder();
        generateFormattedOutput();
        saveTodayDraft(true);
      });

      const btnDeleteProj = document.createElement('button');
      btnDeleteProj.className = 'btn btn-xs btn-ghost text-red';
      btnDeleteProj.textContent = 'Del Proj';
      btnDeleteProj.addEventListener('click', () => {
        hasUnsavedChanges = true;
        if (member.name) editedMemberNames.add(member.name.toUpperCase());
        member.projects.splice(pIdx, 1);
        renderBuilder();
        generateFormattedOutput();
        saveTodayDraft(true);
      });

      projHeader.appendChild(projInput);
      projHeader.appendChild(btnAddTask);
      if (member.projects.length > 1) {
        projHeader.appendChild(btnDeleteProj);
      }
      projBlock.appendChild(projHeader);

      // Tasks
      const taskList = document.createElement('div');
      taskList.className = 'task-list';

      proj.tasks.forEach((t, tIdx) => {
        const taskRow = document.createElement('div');
        taskRow.className = 'task-item-row';

        const taskInput = document.createElement('input');
        taskInput.type = 'text';
        taskInput.className = 'task-input';
        taskInput.value = t.text;
        taskInput.addEventListener('input', (e) => {
          hasUnsavedChanges = true;
          if (member.name) editedMemberNames.add(member.name.toUpperCase());
          t.text = e.target.value;
          generateFormattedOutput();
          saveTodayDraft(false);
        });
        taskInput.addEventListener('blur', () => {
          if (hasUnsavedChanges) saveTodayDraft(true);
        });

        const statusSelect = document.createElement('select');
        statusSelect.className = 'status-select';
        ['Done', 'WIP', 'In Progress', 'On Half Day'].forEach(opt => {
          const optEl = document.createElement('option');
          optEl.value = opt;
          optEl.textContent = opt;
          if (t.status === opt) optEl.selected = true;
          statusSelect.appendChild(optEl);
        });

        statusSelect.addEventListener('change', (e) => {
          hasUnsavedChanges = true;
          if (member.name) editedMemberNames.add(member.name.toUpperCase());
          t.status = e.target.value;
          generateFormattedOutput();
          saveTodayDraft(true);
        });

        const btnDelTask = document.createElement('button');
        btnDelTask.className = 'btn btn-xs btn-ghost text-red';
        btnDelTask.innerHTML = '&times;';
        btnDelTask.addEventListener('click', () => {
          hasUnsavedChanges = true;
          if (member.name) editedMemberNames.add(member.name.toUpperCase());
          proj.tasks.splice(tIdx, 1);
          renderBuilder();
          generateFormattedOutput();
          saveTodayDraft(true);
        });

        taskRow.appendChild(taskInput);
        taskRow.appendChild(statusSelect);
        taskRow.appendChild(btnDelTask);
        taskList.appendChild(taskRow);
      });

      projBlock.appendChild(taskList);
      card.appendChild(projBlock);
    });

    const btnAddProj = document.createElement('button');
    btnAddProj.className = 'btn btn-xs btn-outline';
    btnAddProj.style.marginTop = '6px';
    btnAddProj.textContent = '+ Add Another Project';
    btnAddProj.addEventListener('click', () => {
      hasUnsavedChanges = true;
      if (member.name) editedMemberNames.add(member.name.toUpperCase());
      member.projects.push({ name: 'New Project', tasks: [{ text: 'Task 1', status: 'Done' }] });
      renderBuilder();
      generateFormattedOutput();
      saveTodayDraft(true);
    });
    card.appendChild(btnAddProj);

    // Attached Proof Photos / Screenshots
    if (member.attachments && Array.isArray(member.attachments) && member.attachments.length > 0) {
      const attachWrap = document.createElement('div');
      attachWrap.style.marginTop = '10px';
      attachWrap.style.paddingTop = '8px';
      attachWrap.style.borderTop = '1px solid rgba(255, 255, 255, 0.08)';

      const attachHead = document.createElement('div');
      attachHead.style.fontSize = '0.74rem';
      attachHead.style.color = '#38bdf8';
      attachHead.style.fontWeight = '600';
      attachHead.style.marginBottom = '6px';
      attachHead.innerHTML = `📸 <span>Attached Proof / Screenshots (${member.attachments.length})</span>`;
      attachWrap.appendChild(attachHead);

      const thumbsWrap = document.createElement('div');
      thumbsWrap.className = 'attachment-previews-wrap';

      member.attachments.forEach(att => {
        const thumb = document.createElement('div');
        thumb.className = 'attachment-thumb-card';
        thumb.title = `Click to zoom: ${att.name || 'Screenshot'}`;
        const img = document.createElement('img');
        img.src = att.dataUrl;
        img.alt = att.name || 'Screenshot';
        thumb.appendChild(img);
        thumb.addEventListener('click', () => {
          openAdminLightbox(att.dataUrl, `${member.name} - ${att.name || 'Screenshot'}`);
        });
        thumbsWrap.appendChild(thumb);
      });

      attachWrap.appendChild(thumbsWrap);
      card.appendChild(attachWrap);
    }

    membersContainer.appendChild(card);
  });
}

// -----------------------------------------------------------------------------
// Daily Reminder Timer (6:28 PM Alert)
// -----------------------------------------------------------------------------
function startReminderClock() {
  setInterval(checkReminderTime, 30000); // check every 30s
  checkReminderTime();
}

function checkReminderTime() {
  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;

  const targetTime = state.reminderTime || '18:28';

  if (currentTime === targetTime) {
    reminderBanner.classList.remove('hidden');
    showToast('🔔 6:28 PM! Daily status is ready for quick check & send!', 'warning');
  }
}

// -----------------------------------------------------------------------------
// Google Chat Webhook & API Calls
// -----------------------------------------------------------------------------
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.config) {
      state.webhookUrl = data.config.webhookUrl || '';
      state.reminderTime = data.config.reminderTime || '18:28';
      webhookUrlInput.value = state.webhookUrl;
      reminderTimeInput.value = state.reminderTime;
      displayReminderTime.textContent = formatTimeDisplay(state.reminderTime);
      updateWebhookStatus(Boolean(state.webhookUrl));
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '6:28 PM';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 || 12;
  return `${displayHours}:${String(m).padStart(2, '0')} ${period}`;
}

async function saveConfig() {
  const url = webhookUrlInput.value.trim();
  const time = reminderTimeInput.value.trim() || '18:28';

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: url, reminderTime: time })
    });
    const data = await res.json();

    // Also update users if loaded
    if (cachedUsers && cachedUsers.length > 0) {
      await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: cachedUsers })
      });
    }

    if (data.success) {
      state.webhookUrl = url;
      state.reminderTime = time;
      displayReminderTime.textContent = formatTimeDisplay(time);
      updateWebhookStatus(Boolean(url));
      settingsModal.classList.add('hidden');
      showToast('Settings & Passwords saved successfully!', 'success');
    }
  } catch (err) {
    showToast('Error saving settings: ' + err.message, 'error');
  }
}

async function testWebhook() {
  const url = webhookUrlInput.value.trim();
  if (!url) {
    showToast('Please enter a Webhook URL first', 'error');
    return;
  }

  webhookTestResult.classList.remove('hidden', 'success', 'error');
  webhookTestResult.textContent = 'Testing webhook connection...';

  try {
    const testMsg = `🔔 *Scrum Master Bot Test Message*\nStatus Automator connection verified successfully at ${new Date().toLocaleTimeString()}!`;
    const res = await fetch('/api/send-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: url, text: testMsg })
    });
    const data = await res.json();

    if (data.success) {
      webhookTestResult.className = 'webhook-test-results success';
      webhookTestResult.textContent = '✓ Webhook connected! Test message sent to your Google Chat space.';
    } else {
      webhookTestResult.className = 'webhook-test-results error';
      webhookTestResult.textContent = `✗ Error: ${data.error}`;
    }
  } catch (err) {
    webhookTestResult.className = 'webhook-test-results error';
    webhookTestResult.textContent = `✗ Connection failed: ${err.message}`;
  }
}

function updateWebhookStatus(isConfigured) {
  if (isConfigured) {
    webhookBadge.className = 'status-indicator-dot dot-green';
    statWebhook.textContent = 'Connected (Google Chat)';
    statWebhook.style.color = 'var(--success)';
  } else {
    webhookBadge.className = 'status-indicator-dot dot-gray';
    statWebhook.textContent = 'Not Configured';
    statWebhook.style.color = 'var(--text-muted)';
  }
}

async function sendToGoogleChat() {
  if (!state.webhookUrl) {
    openSettingsModal();
    showToast('Please set your Google Chat Webhook URL first!', 'warning');
    return;
  }

  const text = formattedOutputText.getAttribute('data-plain-text') || formattedOutputText.textContent;
  if (!text.trim()) {
    showToast('Cannot send an empty report!', 'error');
    return;
  }

  btnSendChat.disabled = true;
  btnSendChat.innerHTML = `Sending...`;

  try {
    const res = await fetch('/api/send-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: state.webhookUrl, text: text })
    });
    const data = await res.json();

    if (data.success) {
      showToast('🚀 Status report posted to Sir\'s Google Chat space!', 'success');
      loadHistory();
    } else {
      showToast('Failed to send: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Error sending to Google Chat: ' + err.message, 'error');
  } finally {
    btnSendChat.disabled = false;
    btnSendChat.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Send to Sir's Group`;
  }
}

// -----------------------------------------------------------------------------
// Daily Draft Persistence & Real-Time Live Sync (Conflict-Free & Debounced)
// -----------------------------------------------------------------------------
let lastDraftHash = '';
let lastSyncedVersion = 0;
let isUserTyping = false;
let isSaving = false;
let lastLocalEditTime = 0;
let saveDebounceTimer = null;
let pendingSave = false;
let hasUnsavedChanges = false;
let editedMemberNames = new Set();
let explicitlyDeletedMembers = new Set();

// Track when user is typing or interacting with inputs to avoid interrupting their work
document.addEventListener('input', (e) => {
  if (e.target.closest('#builder-tab') || e.target.id === 'rawTextInput' || e.target.closest('#single-drop-tab')) {
    isUserTyping = true;
    hasUnsavedChanges = true;
    lastLocalEditTime = Date.now();
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      isUserTyping = false;
    }, 2500);
  }
});

document.addEventListener('focusin', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    if (e.target.closest('#builder-tab') || e.target.id === 'rawTextInput' || e.target.closest('#single-drop-tab')) {
      isUserTyping = true;
      lastLocalEditTime = Date.now();
    }
  }
});

document.addEventListener('focusout', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    if (e.target.closest('#builder-tab') || e.target.id === 'rawTextInput' || e.target.closest('#single-drop-tab')) {
      // Only flush save on blur if there were actual unsaved local changes
      if (hasUnsavedChanges) {
        saveTodayDraft(true);
      }
      setTimeout(() => {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
          isUserTyping = false;
        }
      }, 500);
    }
  }
});

async function saveTodayDraft(immediate = false, forceOverwrite = false) {
  lastLocalEditTime = Date.now();
  hasUnsavedChanges = true;
  
  if (!immediate) {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      executeSaveTodayDraft(forceOverwrite);
    }, 400);
    return;
  }

  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = null;
  }
  await executeSaveTodayDraft(forceOverwrite);
}

async function executeSaveTodayDraft(forceOverwrite = false) {
  if (isSaving) {
    pendingSave = true;
    return;
  }

  const snapshotDate = state.date;
  const snapshotData = JSON.parse(JSON.stringify(state.teamData));
  const snapshotHash = JSON.stringify({ date: snapshotDate || '', teamData: sortTeamDataByRoster(snapshotData) });
  const deletedSnapshot = Array.from(explicitlyDeletedMembers);

  // If there are no unsaved changes and hash matches and no deleted members, don't perform redundant network writes
  if (!hasUnsavedChanges && !forceOverwrite && snapshotHash === lastDraftHash && deletedSnapshot.length === 0) {
    return;
  }

  isSaving = true;
  pendingSave = false;

  try {
    const res = await fetch('/api/draft', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ 
        date: snapshotDate, 
        teamData: snapshotData,
        baseVersion: lastSyncedVersion,
        clientTimestamp: new Date(lastLocalEditTime || Date.now()).toISOString(),
        forceOverwrite: forceOverwrite,
        deletedMemberNames: deletedSnapshot
      })
    });
    const data = await res.json();
    if (data.success) {
      hasUnsavedChanges = false;
      editedMemberNames.clear();
      explicitlyDeletedMembers.clear();
      if (data.version) lastSyncedVersion = data.version;
      if (data.draft && Array.isArray(data.draft.teamData)) {
        state.teamData = sortTeamDataByRoster(data.draft.teamData);
        lastDraftHash = JSON.stringify({ date: state.date || '', teamData: state.teamData });
      } else {
        lastDraftHash = snapshotHash;
      }
    }
  } catch (err) {
    console.error('Failed to save draft:', err);
  } finally {
    isSaving = false;
    if (pendingSave) {
      pendingSave = false;
      executeSaveTodayDraft(forceOverwrite);
    }
  }
}

async function loadTodayDraft(isAutoPoll = false, forceRefresh = false) {
  // If user is actively typing or saving, skip auto-polling UI redraw to avoid losing cursor
  if (isAutoPoll && (isSaving || isUserTyping || (Date.now() - lastLocalEditTime < 1500))) {
    return;
  }

  try {
    const res = await fetch(`/api/draft?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
    });
    const data = await res.json();
    const liveSyncStatus = document.getElementById('liveSyncStatus');
    if (liveSyncStatus) {
      liveSyncStatus.style.opacity = '1';
    }

    if (data.draft && Array.isArray(data.draft.teamData)) {
      const sortedIncoming = sortTeamDataByRoster(data.draft.teamData);
      const incomingHash = JSON.stringify({ date: data.draft.date || '', teamData: sortedIncoming });
      const currentLocalHash = JSON.stringify({ date: state.date || '', teamData: sortTeamDataByRoster(state.teamData) });

      // If server data matches local data exactly, just sync hash & return
      if (incomingHash === currentLocalHash) {
        lastDraftHash = incomingHash;
        if (data.version) lastSyncedVersion = data.version;
        return;
      }

      // If it's an auto-poll and local edits happened very recently, do NOT overwrite
      if (isAutoPoll && (Date.now() - lastLocalEditTime < 2000)) {
        return;
      }

      // If admin has unsaved local changes, do NOT clobber edited members, but merge background updates from server
      if (hasUnsavedChanges && isAutoPoll && !forceRefresh) {
        let changed = false;
        const localMembers = [...state.teamData];
        sortedIncoming.forEach(inMember => {
          const mUpper = inMember.name ? inMember.name.toUpperCase() : '';
          // Only update if admin has NOT edited this member locally
          if (mUpper && !editedMemberNames.has(mUpper)) {
            const locIdx = localMembers.findIndex(m => m.name && m.name.toUpperCase() === mUpper);
            if (locIdx >= 0) {
              if (JSON.stringify(localMembers[locIdx]) !== JSON.stringify(inMember)) {
                localMembers[locIdx] = inMember;
                changed = true;
              }
            } else {
              localMembers.push(inMember);
              changed = true;
            }
          }
        });

        if (changed) {
          state.teamData = sortTeamDataByRoster(localMembers);
          renderBuilder();
          generateFormattedOutput();
          renderChecklistTracker();
          if (typeof fetchAndRenderSubmissions === 'function') {
            fetchAndRenderSubmissions();
          }
        }
        return;
      }

      if (incomingHash !== lastDraftHash || forceRefresh) {
        // Detect newly submitted members for notification
        if (isAutoPoll && state.teamData && state.teamData.length > 0) {
          const oldNames = state.teamData.map(m => m.name);
          const newNames = sortedIncoming.map(m => m.name);
          const added = newNames.filter(n => !oldNames.includes(n));
          if (added.length > 0) {
            showToast(`🔔 Live Update: ${added.join(', ')} submitted their daily status!`, 'success');
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
              try {
                new Notification(`📋 ${added.join(', ')} Submitted Tasks`, {
                  body: `New daily status report submitted for today's 6:28 PM report.`,
                  icon: '/favicon.ico'
                });
              } catch (e) { }
            }
          } else {
            showToast(`🔔 Live Update: Daily tasks updated!`, 'info');
          }
        }

        lastDraftHash = incomingHash;
        if (data.version) lastSyncedVersion = data.version;
        state.teamData = sortedIncoming;
        if (data.draft.date) {
          state.date = data.draft.date;
          if (reportDateInput) reportDateInput.value = state.date;
        } else {
          state.date = getFormattedToday();
          if (reportDateInput) reportDateInput.value = state.date;
        }

        renderBuilder();
        generateFormattedOutput();
        renderChecklistTracker();

        // Also update Calendar & Member Filter if active/loaded
        if (typeof fetchAndRenderSubmissions === 'function') {
          fetchAndRenderSubmissions();
        }
      }
    } else if (!isAutoPoll) {
      state.date = getFormattedToday();
      if (reportDateInput) reportDateInput.value = state.date;
      state.teamData = [];
      renderBuilder();
      generateFormattedOutput();
      renderChecklistTracker();
      if (typeof fetchAndRenderSubmissions === 'function') {
        fetchAndRenderSubmissions();
      }
    }
  } catch (err) {
    if (!isAutoPoll) console.error('Failed to load draft:', err);
  }
}

// Poll server every 2 seconds for live updates from /submit
setInterval(() => {
  loadTodayDraft(true);
}, 2000);

// Sync when user switches back to this browser tab (only if not actively editing)
window.addEventListener('focus', () => {
  if (!hasUnsavedChanges && Date.now() - lastLocalEditTime > 1500) {
    loadTodayDraft(false, true);
    if (typeof fetchAndRenderSubmissions === 'function') {
      fetchAndRenderSubmissions();
    }
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !hasUnsavedChanges && Date.now() - lastLocalEditTime > 1500) {
    loadTodayDraft(false, true);
    if (typeof fetchAndRenderSubmissions === 'function') {
      fetchAndRenderSubmissions();
    }
  }
});

// -----------------------------------------------------------------------------
// Calendar & Member Filter Engine (Daily, Weekly, Monthly & User Dropdown)
// -----------------------------------------------------------------------------
let searchDebounceTimer = null;

function setupFilterEventListeners() {
  if (!periodToggleGroup) return;

  // Period Toggle Buttons (Daily, Weekly, Monthly, All)
  periodToggleGroup.querySelectorAll('.period-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      periodToggleGroup.querySelectorAll('.period-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filter.period = pill.getAttribute('data-period') || 'daily';
      fetchAndRenderSubmissions();
    });
  });

  // Calendar Date Picker Input
  if (historyDatePicker) {
    historyDatePicker.addEventListener('change', (e) => {
      state.filter.date = e.target.value || getIsoToday();
      fetchAndRenderSubmissions();
    });
  }

  // Member Dropdown Select
  if (historyMemberSelect) {
    historyMemberSelect.addEventListener('change', (e) => {
      state.filter.member = e.target.value || 'ALL';
      fetchAndRenderSubmissions();
    });
  }

  // Search Input with Debounce
  if (historySearchInput) {
    historySearchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        state.filter.search = e.target.value.trim();
        fetchAndRenderSubmissions();
      }, 200);
    });
  }

  // Apply Filter Button
  if (btnApplyFilter) {
    btnApplyFilter.addEventListener('click', () => {
      fetchAndRenderSubmissions();
      showToast('Filters applied successfully!', 'info');
    });
  }

  // Reset Filter Button
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
      state.filter.period = 'daily';
      state.filter.date = getIsoToday();
      state.filter.member = 'ALL';
      state.filter.search = '';

      if (historyDatePicker) historyDatePicker.value = state.filter.date;
      if (historyMemberSelect) historyMemberSelect.value = 'ALL';
      if (historySearchInput) historySearchInput.value = '';
      if (periodToggleGroup) {
        periodToggleGroup.querySelectorAll('.period-pill').forEach(p => {
          p.classList.toggle('active', p.getAttribute('data-period') === 'daily');
        });
      }

      fetchAndRenderSubmissions();
      showToast('Filter reset to today (All Members)', 'info');
    });
  }

  // Quick Date: Today
  if (btnDateToday) {
    btnDateToday.addEventListener('click', () => {
      state.filter.date = getIsoToday();
      if (historyDatePicker) historyDatePicker.value = state.filter.date;
      fetchAndRenderSubmissions();
      showToast('Set date filter to Today', 'info');
    });
  }

  // Quick Date: Yesterday
  if (btnDateYesterday) {
    btnDateYesterday.addEventListener('click', () => {
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      state.filter.date = getIsoToday(yDate);
      if (historyDatePicker) historyDatePicker.value = state.filter.date;
      fetchAndRenderSubmissions();
      showToast('Set date filter to Yesterday', 'info');
    });
  }

  // Copy Filtered Summary
  if (btnCopyFilteredSummary) {
    btnCopyFilteredSummary.addEventListener('click', () => {
      if (!state.filter.results || state.filter.results.length === 0) {
        showToast('No filtered submissions to copy!', 'warning');
        return;
      }
      const summaryText = buildFormattedSummaryFromSubmissions(state.filter.results);
      navigator.clipboard.writeText(summaryText).then(() => {
        showToast(`📋 Copied summary for ${state.filter.results.length} member(s) to clipboard!`, 'success');
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = summaryText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(`📋 Copied summary for ${state.filter.results.length} member(s)!`, 'success');
      });
    });
  }

  // Load Filtered to Live Master Draft
  if (btnLoadFilteredToMaster) {
    btnLoadFilteredToMaster.addEventListener('click', () => {
      if (!state.filter.results || state.filter.results.length === 0) {
        showToast('No filtered submissions to load!', 'warning');
        return;
      }
      if (confirm(`Load all ${state.filter.results.length} filtered submission(s) into today's Live Master report?`)) {
        state.filter.results.forEach(sub => {
          const mName = (sub.member || '').toUpperCase();
          const existingIdx = state.teamData.findIndex(m => m.name.toUpperCase() === mName);
          const memberEntry = {
            name: mName,
            role: sub.role || '',
            note: sub.note || '',
            projects: sub.projects || []
          };
          if (existingIdx >= 0) {
            state.teamData[existingIdx] = memberEntry;
          } else {
            state.teamData.push(memberEntry);
          }
        });

        state.teamData = sortTeamDataByRoster(state.teamData);
        renderBuilder();
        generateFormattedOutput();
        renderChecklistTracker();
        saveTodayDraft(true);
        showToast(`⚡ Loaded ${state.filter.results.length} member(s) into Master Draft!`, 'success');
        document.querySelector('[data-tab="single-drop-tab"]').click();
      }
    });
  }
}

async function fetchAndRenderSubmissions() {
  if (!historyResultsContainer) return;

  try {
    const params = new URLSearchParams();
    if (state.filter.period) params.append('period', state.filter.period);
    if (state.filter.date) params.append('date', state.filter.date);
    if (state.filter.member && state.filter.member !== 'ALL') params.append('member', state.filter.member);
    if (state.filter.search) params.append('search', state.filter.search);

    const res = await fetch(`/api/submissions?${params.toString()}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.submissions)) {
      state.filter.results = data.submissions;
      renderFilterSummary(data.submissions);
      renderSubmissionCards(data.submissions);
    } else {
      state.filter.results = [];
      renderFilterSummary([]);
      renderSubmissionCards([]);
    }
  } catch (err) {
    console.error('Error fetching submissions:', err);
  }
}

function renderFilterSummary(submissions) {
  if (!filterSummaryText) return;

  // Period label
  let periodLabel = 'Daily';
  if (state.filter.period === 'weekly') periodLabel = 'Weekly (7 Days)';
  else if (state.filter.period === 'monthly') periodLabel = 'Monthly (30 Days)';
  else if (state.filter.period === 'all') periodLabel = 'All Time';

  // Member label
  const memberLabel = state.filter.member === 'ALL' ? 'All Team Members' : state.filter.member;

  // Date display
  let dateDisplay = state.filter.date;
  if (state.filter.date) {
    const dParts = state.filter.date.split('-');
    if (dParts.length === 3) {
      dateDisplay = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
    }
  }

  let text = `Showing: <strong>${periodLabel}</strong>`;
  if (state.filter.period !== 'all') {
    text += ` (${dateDisplay})`;
  }
  text += ` for <strong>${memberLabel}</strong>`;

  if (state.filter.search) {
    text += ` • Matching "<em>${state.filter.search}</em>"`;
  }

  filterSummaryText.innerHTML = text;

  // Calculate Metrics
  const totalSubmissions = submissions.length;
  const uniqueMembers = new Set(submissions.map(s => (s.member || '').toUpperCase())).size;
  let doneCount = 0;
  let wipCount = 0;

  submissions.forEach(s => {
    (s.projects || []).forEach(p => {
      (p.tasks || []).forEach(t => {
        const status = typeof t === 'string' ? '' : (t.status || '');
        if (status === 'Done') doneCount++;
        else if (status === 'WIP' || status === 'In Progress') wipCount++;
      });
    });
  });

  if (fStatSubmissions) fStatSubmissions.textContent = totalSubmissions;
  if (fStatMembers) fStatMembers.textContent = uniqueMembers;
  if (fStatDone) fStatDone.textContent = doneCount;
  if (fStatWIP) fStatWIP.textContent = wipCount;
}

function renderSubmissionCards(submissions) {
  if (!historyResultsContainer) return;
  historyResultsContainer.innerHTML = '';

  if (submissions.length === 0) {
    historyResultsContainer.innerHTML = `
      <div class="empty-history-box">
        <div class="empty-history-icon">📭</div>
        <strong style="color: #cbd5e1; font-size: 1rem;">No Task Submissions Found</strong>
        <p style="font-size: 0.82rem; color: #64748b; max-width: 420px;">
          No member updates match your selected date (<strong>${state.filter.date}</strong>), period (<strong>${state.filter.period}</strong>), or member (<strong>${state.filter.member}</strong>).
        </p>
        <button class="btn btn-xs btn-outline" onclick="document.getElementById('btnResetFilter').click()">Reset Filters</button>
      </div>
    `;
    return;
  }

  submissions.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'history-member-card';

    // Top Header
    const topRow = document.createElement('div');
    topRow.className = 'history-member-top';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'history-member-title-group';

    const initial = (item.member || 'U').charAt(0).toUpperCase();
    const avatar = document.createElement('div');
    avatar.className = 'member-avatar-pill';
    avatar.textContent = initial;

    const nameHeading = document.createElement('span');
    nameHeading.className = 'member-name-heading';
    nameHeading.textContent = item.member || 'UNKNOWN';

    titleGroup.appendChild(avatar);
    titleGroup.appendChild(nameHeading);

    if (item.role) {
      const roleTag = document.createElement('span');
      roleTag.className = 'role-tag-badge';
      roleTag.textContent = item.role;
      titleGroup.appendChild(roleTag);
    }

    // Date tag
    const dateTag = document.createElement('span');
    dateTag.className = 'date-tag-badge';
    let timeStr = '';
    if (item.timestamp) {
      try {
        const tDate = new Date(item.timestamp);
        timeStr = ' • ' + tDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}
    }
    dateTag.textContent = `📅 ${item.date || 'Date'}${timeStr}`;
    titleGroup.appendChild(dateTag);

    // Attendance Note Tag
    if (item.note) {
      const noteTag = document.createElement('span');
      const upperNote = item.note.toUpperCase();
      if (upperNote.includes('HALF DAY')) noteTag.className = 'note-tag-half-day';
      else if (upperNote.includes('LEAVE')) noteTag.className = 'note-tag-leave';
      else if (upperNote.includes('HOME') || upperNote.includes('WFH')) noteTag.className = 'note-tag-wfh';
      else noteTag.className = 'note-tag-half-day';
      noteTag.textContent = item.note;
      titleGroup.appendChild(noteTag);
    }

    // Header Actions
    const cardActions = document.createElement('div');
    cardActions.className = 'history-card-actions';

    // Copy Button
    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn btn-xs btn-secondary';
    btnCopy.title = 'Copy this member\'s tasks';
    btnCopy.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      Copy
    `;
    btnCopy.addEventListener('click', () => {
      const singleText = buildSingleMemberText(item);
      navigator.clipboard.writeText(singleText).then(() => {
        showToast(`Copied tasks for ${item.member}!`, 'success');
      });
    });

    // Load to Master Draft Button
    const btnLoad = document.createElement('button');
    btnLoad.className = 'btn btn-xs btn-outline';
    btnLoad.title = 'Merge this update into today\'s live draft';
    btnLoad.innerHTML = `⚡ Load`;
    btnLoad.addEventListener('click', () => {
      const mName = (item.member || '').toUpperCase();
      const existingIdx = state.teamData.findIndex(m => m.name.toUpperCase() === mName);
      const memberEntry = {
        name: mName,
        role: item.role || '',
        note: item.note || '',
        projects: item.projects || []
      };
      if (existingIdx >= 0) {
        state.teamData[existingIdx] = memberEntry;
      } else {
        state.teamData.push(memberEntry);
      }
      state.teamData = sortTeamDataByRoster(state.teamData);
      renderBuilder();
      generateFormattedOutput();
      renderChecklistTracker();
      saveTodayDraft(true);
      showToast(`Merged ${item.member}'s update into Live Master Draft!`, 'success');
    });

    // Delete Button
    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-xs btn-ghost text-red';
    btnDel.title = 'Delete this record';
    btnDel.innerHTML = `&times;`;
    btnDel.addEventListener('click', async () => {
      if (confirm(`Remove submission log for ${item.member} on ${item.date}?`)) {
        try {
          const delRes = await fetch(`/api/submissions/${item.id}`, { method: 'DELETE' });
          const delData = await delRes.json();
          if (delData.success) {
            showToast(`Submission removed`, 'info');
            fetchAndRenderSubmissions();
          }
        } catch (e) {
          showToast(`Delete failed: ${e.message}`, 'error');
        }
      }
    });

    cardActions.appendChild(btnCopy);
    cardActions.appendChild(btnLoad);
    cardActions.appendChild(btnDel);

    topRow.appendChild(titleGroup);
    topRow.appendChild(cardActions);
    card.appendChild(topRow);

    // Projects Container
    const projContainer = document.createElement('div');
    projContainer.className = 'history-projects-container';

    (item.projects || []).forEach(proj => {
      const projBlock = document.createElement('div');
      projBlock.className = 'history-project-block';

      const projName = document.createElement('div');
      projName.className = 'history-project-name';
      projName.innerHTML = `<span>📁</span> <span>${proj.name || 'General Tasks'}</span>`;
      projBlock.appendChild(projName);

      const tasksList = document.createElement('ul');
      tasksList.className = 'history-tasks-list';

      (proj.tasks || []).forEach(t => {
        const tText = typeof t === 'string' ? t : (t.text || '');
        const tStatus = typeof t === 'string' ? 'Done' : (t.status || 'Done');

        const taskItem = document.createElement('li');
        taskItem.className = 'history-task-item';

        const textSpan = document.createElement('span');
        textSpan.className = 'history-task-item-text';
        textSpan.textContent = `• ${tText}`;

        const statusBadge = document.createElement('span');
        statusBadge.className = `task-status-badge ${tStatus.toLowerCase() === 'wip' || tStatus.toLowerCase() === 'in progress' ? 'wip' : 'done'}`;
        statusBadge.textContent = tStatus === 'Done' ? '=> Done' : '=> WIP';

        taskItem.appendChild(textSpan);
        taskItem.appendChild(statusBadge);
        tasksList.appendChild(taskItem);
      });

      projBlock.appendChild(tasksList);
      projContainer.appendChild(projBlock);
    });

    // Attached Proof Photos / Screenshots
    if (item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0) {
      const attachWrap = document.createElement('div');
      attachWrap.style.marginTop = '12px';
      attachWrap.style.paddingTop = '10px';
      attachWrap.style.borderTop = '1px solid rgba(255, 255, 255, 0.08)';

      const attachHeader = document.createElement('div');
      attachHeader.style.fontSize = '0.78rem';
      attachHeader.style.color = '#38bdf8';
      attachHeader.style.fontWeight = '600';
      attachHeader.style.marginBottom = '6px';
      attachHeader.style.display = 'flex';
      attachHeader.style.alignItems = 'center';
      attachHeader.style.gap = '6px';
      attachHeader.innerHTML = `📸 <span>Attached Proof / Screenshots (${item.attachments.length})</span>`;
      attachWrap.appendChild(attachHeader);

      const thumbsRow = document.createElement('div');
      thumbsRow.className = 'attachment-previews-wrap';

      item.attachments.forEach(att => {
        const thumb = document.createElement('div');
        thumb.className = 'attachment-thumb-card';
        thumb.title = `Click to zoom: ${att.name || 'Screenshot'}`;
        const img = document.createElement('img');
        img.src = att.dataUrl;
        img.alt = att.name || 'Screenshot';
        thumb.appendChild(img);
        thumb.addEventListener('click', () => {
          openAdminLightbox(att.dataUrl, `${item.member} - ${att.name || 'Screenshot'}`);
        });
        thumbsRow.appendChild(thumb);
      });

      attachWrap.appendChild(thumbsRow);
      projContainer.appendChild(attachWrap);
    }

    card.appendChild(projContainer);
    historyResultsContainer.appendChild(card);
  });
}

function buildSingleMemberText(item) {
  let output = '';
  let roleStr = item.role ? `(${item.role})` : '';
  let cleanNote = item.note ? item.note.replace(/^[:-]+|[:-]+$/g, '').trim() : '';
  let noteStr = cleanNote ? ` *${cleanNote}*` : '';

  if (item.projects && item.projects.length > 0) {
    item.projects.forEach((proj, pIdx) => {
      let cleanProj = proj.name ? proj.name.replace(/^[:-]+|[:-]+$/g, '').trim() : '';
      if (pIdx === 0) {
        let projDisplay = cleanProj ? ` ${cleanProj}:-` : ':-';
        let headerContent = item.role ? `${item.member}${roleStr}:-${projDisplay}` : `${item.member}:-${projDisplay}`;
        output += `*${headerContent}*${noteStr}\n\n`;
      } else {
        output += `*${cleanProj}:-*\n\n`;
      }
      (proj.tasks || []).forEach(t => {
        let tText = typeof t === 'string' ? t : (t.text || '');
        let tStatus = typeof t === 'string' ? 'Done' : (t.status || 'Done');
        if (tStatus === 'Done') output += `• ${tText} => Done\n`;
        else if (tStatus === 'WIP') output += `• ${tText} => WIP\n`;
        else output += `• ${tText}\n`;
      });
      output += '\n';
    });
  }
  return output.trimEnd();
}

function buildFormattedSummaryFromSubmissions(submissions) {
  let dateTitle = state.filter.date || getFormattedToday();
  if (state.filter.date && state.filter.date.includes('-')) {
    const parts = state.filter.date.split('-');
    dateTitle = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  let output = `*RESPECTED SIR,*\n*ALL PROJECT STATUS*\n*DATE:-${dateTitle}*\n\n`;
  const sortedSubs = sortTeamDataByRoster(submissions);
  sortedSubs.forEach(sub => {
    output += buildSingleMemberText(sub) + '\n\n';
  });
  return output.trimEnd();
}

// -----------------------------------------------------------------------------
// History
// -----------------------------------------------------------------------------
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    if (data.success && data.history) {
      state.history = data.history;
      renderHistory();
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

function renderHistory() {
  historyList.innerHTML = '';
  if (state.history.length === 0) {
    historyList.innerHTML = '<div class="empty-state">No past reports saved yet. Send your first report to see history!</div>';
    return;
  }

  state.history.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'history-card';

    const info = document.createElement('div');
    info.className = 'history-card-info';

    const date = new Date(item.timestamp);
    const dateFormatted = date.toLocaleString();

    const titleEl = document.createElement('div');
    titleEl.className = 'history-date';
    titleEl.textContent = `Report • ${dateFormatted}`;

    const metaEl = document.createElement('div');
    metaEl.className = 'history-meta';
    metaEl.textContent = `Status: ${item.status || 'Sent'}`;

    info.appendChild(titleEl);
    info.appendChild(metaEl);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    const btnLoad = document.createElement('button');
    btnLoad.className = 'btn btn-xs btn-outline';
    btnLoad.textContent = 'Load Draft';
    btnLoad.addEventListener('click', () => {
      rawTextInput.value = item.formattedText;
      state.teamData = parseRawTasks(item.formattedText);
      renderBuilder();
      generateFormattedOutput();
      renderChecklistTracker();
      saveTodayDraft(true);
      showToast('Loaded past report into editor!', 'info');
      document.querySelector('[data-tab="single-drop-tab"]').click();
    });

    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn btn-xs btn-secondary';
    btnCopy.textContent = 'Copy';
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(item.formattedText);
      showToast('Copied history report to clipboard', 'success');
    });

    actions.appendChild(btnLoad);
    actions.appendChild(btnCopy);

    card.appendChild(info);
    card.appendChild(actions);
    historyList.appendChild(card);
  });
}

// -----------------------------------------------------------------------------
// Image Lightbox Viewer Controller
// -----------------------------------------------------------------------------
function openAdminLightbox(src, title) {
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxTitle = document.getElementById('lightboxTitle');
  if (!lightboxModal) return;
  if (lightboxImg) lightboxImg.src = src;
  if (lightboxTitle) lightboxTitle.textContent = title ? `📸 ${title}` : '📸 Screenshot Proof';
  lightboxModal.classList.remove('hidden');
}

function closeAdminLightbox() {
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  if (!lightboxModal) return;
  lightboxModal.classList.add('hidden');
  if (lightboxImg) lightboxImg.src = '';
}

// -----------------------------------------------------------------------------
// Toast Notifications
// -----------------------------------------------------------------------------
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.textContent = message;

  if (type === 'success') {
    toastIcon.textContent = '✓';
    toastIcon.style.background = 'var(--success)';
  } else if (type === 'error') {
    toastIcon.textContent = '✗';
    toastIcon.style.background = 'var(--danger)';
  } else if (type === 'warning') {
    toastIcon.textContent = '!';
    toastIcon.style.background = 'var(--warning)';
  } else {
    toastIcon.textContent = 'ℹ';
    toastIcon.style.background = 'var(--accent-primary)';
  }

  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// -----------------------------------------------------------------------------
// Admin Push Notifications (Firebase Cloud Messaging + Web Push)
// -----------------------------------------------------------------------------
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

let adminSwRegistration = null;
let isAdminPushSubscribed = false;
let adminFcmToken = null;
let adminFirebaseConfig = null;
let adminFcmMessaging = null;

async function initAdminPushServiceWorker() {
  const btnAdminPushToggle = document.getElementById('btnAdminPushToggle');
  const btnAdminSettingsPushToggle = document.getElementById('btnAdminSettingsPushToggle');

  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      adminSwRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      
      // Fetch Firebase config & initialize
      try {
        const fbRes = await fetch('/api/firebase-config');
        const fbData = await fbRes.json();
        if (fbData.success && fbData.config && typeof firebase !== 'undefined') {
          adminFirebaseConfig = fbData.config;
          if (!firebase.apps.length) {
            firebase.initializeApp(adminFirebaseConfig);
          }
          adminFcmMessaging = firebase.messaging();
          
          // Foreground notification handling
          adminFcmMessaging.onMessage((payload) => {
            const title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || '🔔 Scrum Admin Alert';
            const body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || 'New task submission received.';
            const memberName = (payload.data && payload.data.memberName) || '';

            showToast(`🔔 ${title}: ${body}`, 'info');
            loadTodayDraft(false, true).then(() => {
              if (memberName) {
                showTaskUpdateNotificationModal(memberName, payload.data || {});
              }
            });

            if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
              try {
                new Notification(title, {
                  body: body,
                  icon: '/favicon.ico',
                  tag: 'admin-submission-alert'
                });
              } catch (e) {}
            }
          });
        }
      } catch (cfgErr) {
        console.warn('Admin Firebase init notice:', cfgErr.message);
      }

      // Listen for notification clicks communicated by the Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && (event.data.type === 'TASK_NOTIFICATION_CLICK' || event.data.type === 'TASK_UPDATE_NOTIFICATION')) {
          const url = event.data.url || '';
          let memberName = '';
          if (event.data.data && event.data.data.memberName) {
            memberName = event.data.data.memberName;
          } else if (url.includes('updatedMember=')) {
            try {
              const u = new URL(url, window.location.origin);
              memberName = u.searchParams.get('updatedMember') || '';
            } catch (e) {}
          }
          if (memberName) {
            loadTodayDraft(false, true).then(() => {
              showTaskUpdateNotificationModal(memberName, event.data.data || {});
            });
          }
        }
      });

      await checkAdminPushSubscription();
    } catch (err) {
      console.error('Admin Service Worker registration failed:', err);
    }
  } else {
    if (btnAdminPushToggle) btnAdminPushToggle.style.display = 'none';
    if (btnAdminSettingsPushToggle) btnAdminSettingsPushToggle.style.display = 'none';
  }

  if (btnAdminPushToggle) {
    btnAdminPushToggle.addEventListener('click', toggleAdminPushSubscription);
  }
  if (btnAdminSettingsPushToggle) {
    btnAdminSettingsPushToggle.addEventListener('click', toggleAdminPushSubscription);
  }
}

async function checkAdminPushSubscription() {
  if (!adminSwRegistration) return;
  try {
    const sub = await adminSwRegistration.pushManager.getSubscription();
    const storedToken = localStorage.getItem('fcm_admin_token');
    isAdminPushSubscribed = !(sub === null) || Boolean(storedToken);
    updateAdminPushUI();
  } catch (e) {
    console.error('Error checking admin push subscription:', e);
  }
}

function updateAdminPushUI() {
  const btnAdminPushToggle = document.getElementById('btnAdminPushToggle');
  const adminPushIcon = document.getElementById('adminPushIcon');
  const adminPushText = document.getElementById('adminPushText');
  const adminSettingsPushText = document.getElementById('adminSettingsPushText');
  const btnAdminSettingsPushToggle = document.getElementById('btnAdminSettingsPushToggle');

  if (isAdminPushSubscribed) {
    if (adminPushIcon) adminPushIcon.textContent = '🔔';
    if (adminPushText) adminPushText.textContent = 'Task Alerts On';
    if (btnAdminPushToggle) {
      btnAdminPushToggle.classList.add('btn-primary');
      btnAdminPushToggle.classList.remove('btn-secondary');
      btnAdminPushToggle.title = 'Instant task update notifications are active on this device!';
    }
    if (adminSettingsPushText) adminSettingsPushText.textContent = 'Push Alerts: Active';
    if (btnAdminSettingsPushToggle) {
      btnAdminSettingsPushToggle.classList.add('btn-primary');
      btnAdminSettingsPushToggle.classList.remove('btn-outline');
    }
  } else {
    if (adminPushIcon) adminPushIcon.textContent = '🔕';
    if (adminPushText) adminPushText.textContent = 'Push Alerts Off';
    if (btnAdminPushToggle) {
      btnAdminPushToggle.classList.remove('btn-primary');
      btnAdminPushToggle.classList.add('btn-secondary');
      btnAdminPushToggle.title = 'Click to enable instant task update notifications on this device';
    }
    if (adminSettingsPushText) adminSettingsPushText.textContent = 'Enable Task Alerts';
    if (btnAdminSettingsPushToggle) {
      btnAdminSettingsPushToggle.classList.remove('btn-primary');
      btnAdminSettingsPushToggle.classList.add('btn-outline');
    }
  }
}

// -----------------------------------------------------------------------------
// Task Update Notification Modal & Member Card Highlight
// -----------------------------------------------------------------------------
function showTaskUpdateNotificationModal(memberName, payloadDetails = {}) {
  if (!memberName) return;
  const norm = memberName.toUpperCase().trim();
  const modal = document.getElementById('taskUpdateAlertModal');
  const memberEl = document.getElementById('taskUpdateAlertMember');
  const roleEl = document.getElementById('taskUpdateAlertRole');
  const tsEl = document.getElementById('taskUpdateAlertTimestamp');
  const descEl = document.getElementById('taskUpdateAlertDesc');
  const listEl = document.getElementById('taskUpdateAlertProjectsList');
  const btnFocus = document.getElementById('btnFocusTaskUpdateMember');
  const btnDismiss = document.getElementById('btnDismissTaskUpdateModal');
  const btnClose = document.getElementById('btnCloseTaskUpdateModal');

  if (!modal) {
    showToast(`📋 ${memberName} just submitted their daily task update!`, 'success');
    highlightUpdatedMember(norm);
    return;
  }

  // Find member in loaded team data
  const memberData = (state.teamData || []).find(m => (m.name || '').toUpperCase().trim() === norm);

  if (memberEl) memberEl.textContent = memberData ? memberData.name : norm;
  if (roleEl) roleEl.textContent = (memberData && memberData.role) ? memberData.role : 'Team Member';
  if (tsEl) {
    const timeStr = payloadDetails.timestamp ? new Date(payloadDetails.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    tsEl.textContent = `Submitted at ${timeStr} • Daily Scrum Draft Updated`;
  }
  if (descEl) {
    const projCount = (memberData && memberData.projects) ? memberData.projects.length : (payloadDetails.projectsCount || 1);
    descEl.textContent = `${memberData ? memberData.name : norm} has submitted task updates across ${projCount} project(s).`;
  }

  if (listEl) {
    listEl.innerHTML = '';
    if (memberData && Array.isArray(memberData.projects) && memberData.projects.length > 0) {
      memberData.projects.forEach(proj => {
        const projBox = document.createElement('div');
        projBox.className = 'task-update-project-box';

        const pHeader = document.createElement('div');
        pHeader.className = 'task-update-proj-header';
        pHeader.innerHTML = `<span>📁</span> <span>${escapeHtml(proj.name || 'General Tasks')}</span>`;
        projBox.appendChild(pHeader);

        if (Array.isArray(proj.tasks) && proj.tasks.length > 0) {
          proj.tasks.forEach(t => {
            const tItem = document.createElement('div');
            tItem.className = 'task-update-task-item';
            const isDone = (t.status === 'Done');
            const pillClass = isDone ? 'task-status-pill-done' : 'task-status-pill-wip';
            const pillText = isDone ? '✓ Done' : '⏳ WIP';
            tItem.innerHTML = `<span class="${pillClass}">${pillText}</span> <span>${escapeHtml(t.text || '')}</span>`;
            projBox.appendChild(tItem);
          });
        } else {
          const emptyTasks = document.createElement('div');
          emptyTasks.style.fontSize = '0.78rem';
          emptyTasks.style.color = '#94a3b8';
          emptyTasks.textContent = 'No detailed sub-tasks listed.';
          projBox.appendChild(emptyTasks);
        }
        listEl.appendChild(projBox);
      });
    } else {
      const fallbackBox = document.createElement('div');
      fallbackBox.className = 'task-update-project-box';
      fallbackBox.innerHTML = `<div style="font-size:0.82rem; color:#cbd5e1;">📋 Tasks submitted and synced into the daily scrum draft. Click below to inspect their card.</div>`;
      listEl.appendChild(fallbackBox);
    }
  }

  // Show the modal
  modal.classList.remove('hidden');

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  if (btnClose) btnClose.onclick = closeModal;
  if (btnDismiss) btnDismiss.onclick = closeModal;
  if (btnFocus) {
    btnFocus.onclick = () => {
      closeModal();
      highlightUpdatedMember(norm);
    };
  }

  // Also immediately highlight the card in the background
  highlightUpdatedMember(norm);
}

function highlightUpdatedMember(memberName, retryCount = 0) {
  if (!memberName) return;
  const norm = memberName.toUpperCase().trim();
  const cards = document.querySelectorAll('.member-card');
  let targetCard = null;

  for (const c of cards) {
    if (c.getAttribute('data-member-name') === norm) {
      targetCard = c;
      break;
    }
  }

  if (targetCard) {
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetCard.classList.add('highlight-pulse');

    // Add glowing live update badge in card header
    const header = targetCard.querySelector('.member-card-header');
    if (header && !header.querySelector('.live-update-badge')) {
      const badge = document.createElement('span');
      badge.className = 'live-update-badge';
      badge.textContent = '⚡ UPDATED JUST NOW';
      header.appendChild(badge);
      setTimeout(() => {
        if (badge.parentNode) badge.parentNode.removeChild(badge);
      }, 9000);
    }

    setTimeout(() => {
      targetCard.classList.remove('highlight-pulse');
    }, 6000);
  } else if (retryCount < 15) {
    setTimeout(() => highlightUpdatedMember(memberName, retryCount + 1), 250);
  }
}

// Check if launched from a Task Update Push Notification click
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const updatedMember = urlParams.get('updatedMember');
  if (updatedMember) {
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => {
      loadTodayDraft(false, true).then(() => {
        showTaskUpdateNotificationModal(updatedMember);
      });
    }, 450);
  }
});

async function toggleAdminPushSubscription() {
  if (!adminSwRegistration) {
    showToast('Push notifications not supported in this browser', 'warning');
    return;
  }

  try {
    if (isAdminPushSubscribed) {
      const sub = await adminSwRegistration.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      const storedToken = localStorage.getItem('fcm_admin_token');
      if (storedToken) {
        await fetch('/api/fcm/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: storedToken })
        });
        localStorage.removeItem('fcm_admin_token');
      }
      isAdminPushSubscribed = false;
      showToast('Admin Push Alerts disabled on this device', 'info');
    } else {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Notification permission was blocked in browser settings', 'error');
        return;
      }

      // Try FCM Token registration
      if (adminFcmMessaging && adminFirebaseConfig && adminFirebaseConfig.vapidKey) {
        try {
          const token = await adminFcmMessaging.getToken({
            vapidKey: adminFirebaseConfig.vapidKey,
            serviceWorkerRegistration: adminSwRegistration
          });
          if (token) {
            adminFcmToken = token;
            localStorage.setItem('fcm_admin_token', token);
            await fetch('/api/fcm/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token,
                role: 'admin',
                member: 'Nisarg (Admin)'
              })
            });
          }
        } catch (fcmErr) {
          console.warn('Admin FCM Token error, fallback to WebPush:', fcmErr.message);
        }
      }

      // Dual / Fallback WebPush registration
      try {
        const res = await fetch('/api/push/public-key');
        const data = await res.json();
        if (data.success && data.publicKey) {
          const appServerKey = urlBase64ToUint8Array(data.publicKey);
          const subscription = await adminSwRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: appServerKey
          });

          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: subscription,
              role: 'admin',
              member: 'Nisarg (Admin)'
            })
          });
        }
      } catch (wpErr) {
        console.warn('Admin WebPush subscribe error:', wpErr.message);
      }

      isAdminPushSubscribed = true;
      showToast('🔔 Admin Push Alerts enabled! You will be notified whenever employees submit tasks.', 'success');
    }
  } catch (err) {
    console.error('Error toggling admin push:', err);
    showToast('Failed to update push alerts: ' + err.message, 'error');
  } finally {
    updateAdminPushUI();
  }
}

// =============================================================================
// AI Scrum Assistant Frontend Client
// =============================================================================

function renderAiMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/_(.*?)_/gim, '<em>$1</em>');

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr>');

  // Bullet points
  html = html.replace(/^\s*•\s+(.*$)/gim, '<div style="display:flex;align-items:flex-start;gap:6px;margin:2px 0 4px 6px;"><span>•</span><div>$1</div></div>');
  html = html.replace(/^\s*↳\s+(.*$)/gim, '<div style="margin-left:18px;color:#93c5fd;font-size:0.82rem;">↳ $1</div>');

  // Line breaks
  html = html.replace(/\n\n/g, '<div style="height:6px;"></div>');
  html = html.replace(/\n/g, '<br>');

  return html;
}

function initAiAssistant() {
  const btnOpenAiAssistant = document.getElementById('btnOpenAiAssistant');
  const btnFloatingAi = document.getElementById('btnFloatingAi');
  const aiAssistantModal = document.getElementById('aiAssistantModal');
  const btnCloseAiModal = document.getElementById('btnCloseAiModal');
  const aiChatForm = document.getElementById('aiChatForm');
  const aiChatInput = document.getElementById('aiChatInput');
  const aiChatMessages = document.getElementById('aiChatMessages');
  const aiQuickChips = document.getElementById('aiQuickChips');
  const btnClearAiChat = document.getElementById('btnClearAiChat');

  if (!aiAssistantModal) return;

  function openAiModal() {
    aiAssistantModal.classList.remove('hidden');
    setTimeout(() => {
      if (aiChatInput) aiChatInput.focus();
    }, 150);
  }

  function closeAiModal() {
    aiAssistantModal.classList.add('hidden');
  }

  if (btnOpenAiAssistant) btnOpenAiAssistant.addEventListener('click', openAiModal);
  if (btnFloatingAi) btnFloatingAi.addEventListener('click', openAiModal);
  if (btnCloseAiModal) btnCloseAiModal.addEventListener('click', closeAiModal);

  // Close on outside backdrop click
  aiAssistantModal.addEventListener('click', (e) => {
    if (e.target === aiAssistantModal) closeAiModal();
  });

  // Handle Quick Chips
  if (aiQuickChips) {
    aiQuickChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.ai-chip');
      if (chip) {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt && aiChatInput) {
          aiChatInput.value = prompt;
          submitAiQuery(prompt);
        }
      }
    });
  }

  // Handle Clear Chat
  if (btnClearAiChat) {
    btnClearAiChat.addEventListener('click', () => {
      aiChatMessages.innerHTML = `
        <div class="ai-message ai-bot-message">
          <div class="ai-msg-avatar">✨</div>
          <div class="ai-msg-bubble">
            <div class="ai-msg-text">
              👋 Conversation cleared! Ask me anything about your team's daily status updates, members, or projects.
            </div>
          </div>
        </div>
      `;
    });
  }

  // Submit Query
  async function submitAiQuery(userText) {
    const q = (userText || (aiChatInput ? aiChatInput.value : '')).trim();
    if (!q) return;

    if (aiChatInput) aiChatInput.value = '';

    // Append User Message Bubble
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'ai-message ai-user-message';
    userMsgEl.innerHTML = `
      <div class="ai-msg-avatar">👤</div>
      <div class="ai-msg-bubble">
        <div class="ai-msg-text">${q.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
    `;
    aiChatMessages.appendChild(userMsgEl);

    // Append Typing Indicator Bubble
    const typingId = 'typing-' + Date.now();
    const typingEl = document.createElement('div');
    typingEl.className = 'ai-message ai-bot-message';
    typingEl.id = typingId;
    typingEl.innerHTML = `
      <div class="ai-msg-avatar">✨</div>
      <div class="ai-msg-bubble">
        <div class="ai-typing-indicator">
          <span class="ai-dot"></span>
          <span class="ai-dot"></span>
          <span class="ai-dot"></span>
        </div>
      </div>
    `;
    aiChatMessages.appendChild(typingEl);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const data = await res.json();

      const typingTarget = document.getElementById(typingId);
      if (typingTarget) typingTarget.remove();

      const answerText = data.answer || 'Sorry, I could not process your question.';
      const renderedHtml = renderAiMarkdown(answerText);

      const botMsgEl = document.createElement('div');
      botMsgEl.className = 'ai-message ai-bot-message';
      botMsgEl.innerHTML = `
        <div class="ai-msg-avatar">✨</div>
        <div class="ai-msg-bubble">
          <div class="ai-msg-text">${renderedHtml}</div>
          <div class="ai-msg-actions">
            <button type="button" class="ai-btn-copy" title="Copy answer to clipboard">📋 Copy</button>
          </div>
        </div>
      `;

      // Copy Button Handler
      const copyBtn = botMsgEl.querySelector('.ai-btn-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(answerText).then(() => {
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
          }).catch(() => {
            showToast('Could not copy text', 'error');
          });
        });
      }

      aiChatMessages.appendChild(botMsgEl);
      aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    } catch (err) {
      const typingTarget = document.getElementById(typingId);
      if (typingTarget) typingTarget.remove();

      const errorMsgEl = document.createElement('div');
      errorMsgEl.className = 'ai-message ai-bot-message';
      errorMsgEl.innerHTML = `
        <div class="ai-msg-avatar">⚠️</div>
        <div class="ai-msg-bubble" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.1);">
          <div class="ai-msg-text" style="color: #fca5a5;">
            An error occurred while querying the AI assistant: ${err.message}
          </div>
        </div>
      `;
      aiChatMessages.appendChild(errorMsgEl);
      aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    }
  }

  if (aiChatForm) {
    aiChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitAiQuery();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAiAssistant();
});

