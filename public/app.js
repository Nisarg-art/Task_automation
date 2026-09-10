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

// App State
let state = {
  date: getFormattedToday(),
  webhookUrl: '',
  reminderTime: '18:28',
  teamData: [],
  history: []
};

// Helper: Format Date DD/MM/YYYY
function getFormattedToday() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

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

// Stats Elements
const statMembers = document.getElementById('statMembers');
const statProjects = document.getElementById('statProjects');
const statDone = document.getElementById('statDone');
const statWIP = document.getElementById('statWIP');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  reportDateInput.value = state.date;
  await loadConfig();
  await loadHistory();
  await loadTodayDraft();

  setupEventListeners();
  startReminderClock();
});

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
      }
    });
  });

  // Date Change
  reportDateInput.addEventListener('input', (e) => {
    state.date = e.target.value.trim() || getFormattedToday();
    generateFormattedOutput();
    saveTodayDraft();
  });

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
    saveTodayDraft();
    showToast('Parsed and updated today\'s master report!', 'success');
  });

  // Load Sample
  btnLoadSample.addEventListener('click', () => {
    rawTextInput.value = SAMPLE_09_09_TEXT;
    state.teamData = parseRawTasks(SAMPLE_09_09_TEXT);
    renderBuilder();
    generateFormattedOutput();
    renderChecklistTracker();
    saveTodayDraft();
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
    saveTodayDraft();
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
    saveTodayDraft();
  });

  btnPreloadTeam.addEventListener('click', () => {
    rawTextInput.value = SAMPLE_09_09_TEXT;
    state.teamData = parseRawTasks(SAMPLE_09_09_TEXT);
    renderBuilder();
    generateFormattedOutput();
    renderChecklistTracker();
    saveTodayDraft();
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
      saveTodayDraft();
      showToast('Cleared today\'s report draft', 'info');
    }
  });
}

function openSettingsModal() {
  webhookUrlInput.value = state.webhookUrl || '';
  reminderTimeInput.value = state.reminderTime || '18:28';
  webhookTestResult.classList.add('hidden');
  settingsModal.classList.remove('hidden');
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
    // If text didn't contain explicit name header but user selected a member
    if (selectedTarget && selectedTarget !== 'AUTO') {
      parsedMembers = [{
        name: selectedTarget,
        role: getRoleForMember(selectedTarget),
        note: '',
        projects: [{
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

  // Re-render UI & Save Draft
  renderBuilder();
  generateFormattedOutput();
  renderChecklistTracker();
  saveTodayDraft();

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
// Submission Tracker Checklist
// -----------------------------------------------------------------------------
function renderChecklistTracker() {
  rosterPills.innerHTML = '';
  let submittedCount = 0;

  const currentNames = state.teamData.map(m => m.name.toUpperCase());

  DEFAULT_TEAM_ROSTER.forEach(member => {
    const isSubmitted = currentNames.includes(member.name.toUpperCase());
    if (isSubmitted) submittedCount++;

    const pill = document.createElement('div');
    pill.className = `roster-pill ${isSubmitted ? 'submitted' : 'pending'}`;
    pill.innerHTML = `
      <span class="pill-dot ${isSubmitted ? 'green' : 'yellow'}"></span>
      <span>${member.name}</span>
      <span style="font-size:0.7rem; opacity:0.8">${isSubmitted ? '✓' : 'pending'}</span>
    `;

    pill.addEventListener('click', () => {
      quickMemberSelect.value = member.name;
      document.querySelector('[data-tab="single-drop-tab"]').click();
      singleChatInput.focus();
      showToast(`Ready to drop update for ${member.name}`, 'info');
    });

    rosterPills.appendChild(pill);
  });

  // Any custom members not in default roster
  state.teamData.forEach(member => {
    const isDefault = DEFAULT_TEAM_ROSTER.some(r => r.name.toUpperCase() === member.name.toUpperCase());
    if (!isDefault) {
      submittedCount++;
      const pill = document.createElement('div');
      pill.className = 'roster-pill submitted';
      pill.innerHTML = `
        <span class="pill-dot green"></span>
        <span>${member.name}</span>
        <span style="font-size:0.7rem; opacity:0.8">✓</span>
      `;
      rosterPills.appendChild(pill);
    }
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
    if (/^(RESPECTED SIR|ALL PROJECT STATUS|DATE\s*:-)/i.test(rawLine)) {
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

  return members;
}

function isLikelyMember(str) {
  if (!str) return false;
  const clean = str.trim().toUpperCase();
  const nonMembers = ['RESPECTED', 'ALL', 'DATE', 'NOTE', 'TODAY', 'PROJECT', 'TASK'];
  if (nonMembers.includes(clean)) return false;
  return clean.length >= 2 && clean.length <= 40;
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
  let plainText = '';
  plainText += `RESPECTED SIR,\n`;
  plainText += `ALL PROJECT STATUS\n`;
  plainText += `DATE:-${state.date}\n\n`;

  let htmlPreview = '';
  htmlPreview += `<strong>RESPECTED SIR,</strong>\n`;
  htmlPreview += `<strong>ALL PROJECT STATUS</strong>\n`;
  htmlPreview += `<strong>DATE:-${state.date}</strong>\n\n`;

  let totalMembers = state.teamData.length;
  let totalProjects = 0;
  let totalDone = 0;
  let totalWIP = 0;

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

        // Render tasks
        if (proj.tasks && proj.tasks.length > 0) {
          proj.tasks.forEach(t => {
            let taskText = t.text.trim();
            if (t.status === 'Done') {
              totalDone++;
              plainText += `${taskText} => Done\n`;
              htmlPreview += `${taskText} => <span style="color: #10b981; font-weight: 600;">Done</span>\n`;
            } else if (t.status === 'WIP') {
              totalWIP++;
              plainText += `${taskText} => WIP\n`;
              htmlPreview += `${taskText} => <span style="color: #f59e0b; font-weight: 600;">WIP</span>\n`;
            } else if (t.status === 'In Progress') {
              totalWIP++;
              plainText += `${taskText} : In-progress\n`;
              htmlPreview += `${taskText} : <span style="color: #f59e0b; font-weight: 600;">In-progress</span>\n`;
            } else {
              plainText += `${taskText}\n`;
              htmlPreview += `${taskText}\n`;
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

  if (state.teamData.length === 0) {
    membersContainer.innerHTML = '<div class="empty-state">No members loaded yet. Drop updates in "Quick 1-on-1 Chat Drop" or load template.</div>';
    return;
  }

  state.teamData.forEach((member, mIdx) => {
    const card = document.createElement('div');
    card.className = 'member-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'member-card-header';

    const infoInputs = document.createElement('div');
    infoInputs.className = 'member-info-inputs';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'input-field input-name';
    nameInput.value = member.name;
    nameInput.addEventListener('input', (e) => {
      member.name = e.target.value.toUpperCase();
      generateFormattedOutput();
      renderChecklistTracker();
      saveTodayDraft();
    });

    const roleInput = document.createElement('input');
    roleInput.type = 'text';
    roleInput.className = 'input-field input-role';
    roleInput.placeholder = 'Role (e.g. Nodejs Developer)';
    roleInput.value = member.role;
    roleInput.addEventListener('input', (e) => {
      member.role = e.target.value;
      generateFormattedOutput();
      saveTodayDraft();
    });

    const noteSelect = document.createElement('select');
    noteSelect.className = 'input-field input-role';
    const noteOptions = [
      { label: 'Full Day', val: '' },
      { label: 'ON HALF DAY', val: 'ON HALF DAY' },
      { label: 'ON LEAVE', val: 'ON LEAVE' },
      { label: 'WORK FROM HOME', val: 'WORK FROM HOME' }
    ];
    noteOptions.forEach(opt => {
      const optEl = document.createElement('option');
      optEl.value = opt.val;
      optEl.textContent = opt.label;
      if ((member.note || '').toUpperCase() === opt.val) optEl.selected = true;
      noteSelect.appendChild(optEl);
    });
    noteSelect.addEventListener('change', (e) => {
      member.note = e.target.value;
      generateFormattedOutput();
      saveTodayDraft();
    });

    infoInputs.appendChild(nameInput);
    infoInputs.appendChild(roleInput);
    infoInputs.appendChild(noteSelect);

    const btnDeleteMember = document.createElement('button');
    btnDeleteMember.className = 'btn btn-xs btn-ghost text-red';
    btnDeleteMember.innerHTML = '&times; Remove';
    btnDeleteMember.addEventListener('click', () => {
      state.teamData.splice(mIdx, 1);
      renderBuilder();
      generateFormattedOutput();
      renderChecklistTracker();
      saveTodayDraft();
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
        proj.name = e.target.value;
        generateFormattedOutput();
        saveTodayDraft();
      });

      const btnAddTask = document.createElement('button');
      btnAddTask.className = 'btn btn-xs btn-outline';
      btnAddTask.textContent = '+ Add Task';
      btnAddTask.addEventListener('click', () => {
        proj.tasks.push({ text: 'New task update', status: 'Done' });
        renderBuilder();
        generateFormattedOutput();
        saveTodayDraft();
      });

      const btnDeleteProj = document.createElement('button');
      btnDeleteProj.className = 'btn btn-xs btn-ghost text-red';
      btnDeleteProj.textContent = 'Del Proj';
      btnDeleteProj.addEventListener('click', () => {
        member.projects.splice(pIdx, 1);
        renderBuilder();
        generateFormattedOutput();
        saveTodayDraft();
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
          t.text = e.target.value;
          generateFormattedOutput();
          saveTodayDraft();
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
          t.status = e.target.value;
          generateFormattedOutput();
          saveTodayDraft();
        });

        const btnDelTask = document.createElement('button');
        btnDelTask.className = 'btn btn-xs btn-ghost text-red';
        btnDelTask.innerHTML = '&times;';
        btnDelTask.addEventListener('click', () => {
          proj.tasks.splice(tIdx, 1);
          renderBuilder();
          generateFormattedOutput();
          saveTodayDraft();
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
      member.projects.push({ name: 'New Project', tasks: [{ text: 'Task 1', status: 'Done' }] });
      renderBuilder();
      generateFormattedOutput();
      saveTodayDraft();
    });
    card.appendChild(btnAddProj);

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
    if (data.success) {
      state.webhookUrl = url;
      state.reminderTime = time;
      displayReminderTime.textContent = formatTimeDisplay(time);
      updateWebhookStatus(Boolean(url));
      settingsModal.classList.add('hidden');
      showToast('Settings saved successfully!', 'success');
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
// Daily Draft Persistence & Real-Time Live Sync
// -----------------------------------------------------------------------------
let lastDraftHash = '';
let isUserTyping = false;

// Track when user is typing in the builder to avoid interrupting their typing
document.addEventListener('input', (e) => {
  if (e.target.closest('#builder-tab') || e.target.id === 'rawTextInput') {
    isUserTyping = true;
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      isUserTyping = false;
    }, 3000);
  }
});

async function loadTodayDraft(isAutoPoll = false) {
  try {
    const res = await fetch('/api/draft');
    const data = await res.json();
    if (data.draft && data.draft.teamData) {
      const currentHash = JSON.stringify(data.draft.teamData);

      if (currentHash !== lastDraftHash) {
        // Detect newly submitted members for notification
        if (isAutoPoll && state.teamData && state.teamData.length > 0) {
          const oldNames = state.teamData.map(m => m.name);
          const newNames = data.draft.teamData.map(m => m.name);
          const added = newNames.filter(n => !oldNames.includes(n));
          if (added.length > 0) {
            showToast(`🔔 Live Update: ${added.join(', ')} just submitted their daily status!`, 'success');
          } else {
            showToast(`🔔 Live Update: Daily tasks updated!`, 'info');
          }
        }

        lastDraftHash = currentHash;
        state.teamData = data.draft.teamData;

        // If user isn't actively typing in builder, re-render builder
        if (!isUserTyping) {
          renderBuilder();
        }
        generateFormattedOutput();
        renderChecklistTracker();
      }
    } else if (!isAutoPoll) {
      state.teamData = parseRawTasks(SAMPLE_09_09_TEXT);
      renderBuilder();
      generateFormattedOutput();
      renderChecklistTracker();
    }
  } catch (err) {
    if (!isAutoPoll) console.error('Failed to load draft:', err);
  }
}

// Poll server every 2.5 seconds for instant live updates from /submit
setInterval(() => {
  loadTodayDraft(true);
}, 2500);

async function saveTodayDraft() {
  try {
    lastDraftHash = JSON.stringify(state.teamData);
    await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: state.date, teamData: state.teamData })
    });
  } catch (err) {
    console.error('Failed to save draft:', err);
  }
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
      saveTodayDraft();
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
