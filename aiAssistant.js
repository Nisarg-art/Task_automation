const dbRepo = require('./db');

// Month mapping for date parsing
const MONTH_NAMES = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

function cleanProjectName(name = '') {
  return name
    .replace(/^Project:\s*/i, '')
    .replace(/[\(:-]+$/, '')
    .trim();
}

// Parse natural language date mentions
function parseNaturalDate(query, referenceDate = new Date()) {
  const q = query.toLowerCase();

  // Check for relative terms
  if (q.includes('today')) {
    const d = String(referenceDate.getDate()).padStart(2, '0');
    const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const y = referenceDate.getFullYear();
    return { formattedDate: `${d}/${m}/${y}`, isoDate: `${y}-${m}-${d}`, display: 'Today' };
  }

  if (q.includes('yesterday')) {
    const yDate = new Date(referenceDate);
    yDate.setDate(yDate.getDate() - 1);
    const d = String(yDate.getDate()).padStart(2, '0');
    const m = String(yDate.getMonth() + 1).padStart(2, '0');
    const y = yDate.getFullYear();
    return { formattedDate: `${d}/${m}/${y}`, isoDate: `${y}-${m}-${d}`, display: 'Yesterday' };
  }

  if (q.includes('day before yesterday')) {
    const dDate = new Date(referenceDate);
    dDate.setDate(dDate.getDate() - 2);
    const d = String(dDate.getDate()).padStart(2, '0');
    const m = String(dDate.getMonth() + 1).padStart(2, '0');
    const y = dDate.getFullYear();
    return { formattedDate: `${d}/${m}/${y}`, isoDate: `${y}-${m}-${d}`, display: 'Day Before Yesterday' };
  }

  // Regex for "16th sept", "16 sep", "16 september", "16th september 2026"
  const dayMonthRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/i;
  const dmMatch = q.match(dayMonthRegex);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const monthKey = dmMatch[2].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    const year = dmMatch[3] ? parseInt(dmMatch[3], 10) : referenceDate.getFullYear();
    if (day >= 1 && day <= 31 && month) {
      const dStr = String(day).padStart(2, '0');
      const mStr = String(month).padStart(2, '0');
      return {
        formattedDate: `${dStr}/${mStr}/${year}`,
        isoDate: `${year}-${mStr}-${dStr}`,
        display: `${dStr}/${mStr}/${year}`
      };
    }
  }

  // Regex for "september 16", "sept 16th", "sept 16 2026"
  const monthDayRegex = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/i;
  const mdMatch = q.match(monthDayRegex);
  if (mdMatch) {
    const monthKey = mdMatch[1].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    const day = parseInt(mdMatch[2], 10);
    const year = mdMatch[3] ? parseInt(mdMatch[3], 10) : referenceDate.getFullYear();
    if (day >= 1 && day <= 31 && month) {
      const dStr = String(day).padStart(2, '0');
      const mStr = String(month).padStart(2, '0');
      return {
        formattedDate: `${dStr}/${mStr}/${year}`,
        isoDate: `${year}-${mStr}-${dStr}`,
        display: `${dStr}/${mStr}/${year}`
      };
    }
  }

  // Regex for DD/MM/YYYY, DD-MM-YYYY, DD/MM, DD-MM
  const slashDateRegex = /\b(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?\b/;
  const slashMatch = q.match(slashDateRegex);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    let year = slashMatch[3] ? parseInt(slashMatch[3], 10) : referenceDate.getFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const dStr = String(day).padStart(2, '0');
      const mStr = String(month).padStart(2, '0');
      return {
        formattedDate: `${dStr}/${mStr}/${year}`,
        isoDate: `${year}-${mStr}-${dStr}`,
        display: `${dStr}/${mStr}/${year}`
      };
    }
  }

  return null;
}

// Extract target member name from query
async function extractMember(query) {
  const qUpper = query.toUpperCase();
  const allUsers = await dbRepo.getUsers();
  const knownNames = allUsers.map(u => u.name.toUpperCase().trim());

  // Check known roster names
  for (const name of knownNames) {
    const regex = new RegExp(`\\b${name}(?:'S)?\\b`, 'i');
    if (regex.test(qUpper)) {
      return name;
    }
  }

  return null;
}

// Format tasks array into clean markdown bullet points
function formatTasksList(projects = []) {
  if (!projects || projects.length === 0) {
    return '_No specific project tasks recorded._';
  }

  let text = '';
  projects.forEach((proj, idx) => {
    let cleanProjName = cleanProjectName(proj.name);
    text += `### 📁 **${cleanProjName}**\n`;

    const tasks = proj.tasks || [];
    if (tasks.length === 0) {
      text += `  • _No individual task items listed_\n`;
    } else {
      tasks.forEach(t => {
        let taskText = '';
        let taskStatus = 'Done';
        if (typeof t === 'string') {
          taskText = t;
        } else {
          taskText = t.text || '';
          taskStatus = t.status || 'Done';
        }

        let badge = '✅ **Done**';
        if (taskStatus === 'WIP') badge = '⏳ **WIP**';
        else if (taskStatus === 'In Progress') badge = '🔄 **In Progress**';

        text += `  • ${taskText.trim()} → ${badge}\n`;
      });
    }
    text += '\n';
  });

  return text.trimEnd();
}

// Optional Gemini LLM synthesizer if GEMINI_API_KEY is available
async function callGeminiAi(prompt, systemContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `System Context from Scrum Database:\n${systemContext}\n\nUser Question: ${prompt}\n\nPlease answer accurately using only the provided database context. Use clean markdown formatting with emojis and bullet points.` }
            ]
          }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText) return candidateText.trim();
    }
  } catch (e) {
    console.warn('Gemini API call notice:', e.message);
  }
  return null;
}

// Main AI Assistant Handler
async function handleAiQuery(userQuery, options = {}) {
  const query = (userQuery || '').trim();
  if (!query) {
    return {
      success: false,
      answer: "Please ask a question about your team's daily status updates, members, or projects."
    };
  }

  const targetDateObj = parseNaturalDate(query);
  const targetMember = await extractMember(query);

  // 1. Specific Member + Specific Date (e.g., "16th sept update of pranav")
  if (targetMember && targetDateObj) {
    const { formattedDate, isoDate, display } = targetDateObj;

    // Search submissions for this member on this date
    const allSubs = await dbRepo.getSubmissions({ member: targetMember });
    const matchingSubs = allSubs.filter(s =>
      s.date === formattedDate || s.isoDate === isoDate
    );

    // Also check daily draft for that date
    const draft = await dbRepo.getDailyDraft(formattedDate);
    let draftMember = null;
    if (draft && Array.isArray(draft.teamData)) {
      draftMember = draft.teamData.find(m => m.name && m.name.toUpperCase().trim() === targetMember);
    }

    if (matchingSubs.length > 0 || draftMember) {
      const primaryRecord = matchingSubs[0] || draftMember;
      const projects = primaryRecord.projects || (draftMember ? draftMember.projects : []) || [];
      const note = primaryRecord.note || (draftMember ? draftMember.note : '') || '';
      const role = primaryRecord.role || (draftMember ? draftMember.role : '') || '';
      const updatedAt = primaryRecord.timestamp || primaryRecord.updatedAt || '';

      const tasksMarkdown = formatTasksList(projects);

      let totalTasks = 0;
      let doneTasks = 0;
      let wipTasks = 0;

      projects.forEach(p => {
        (p.tasks || []).forEach(t => {
          totalTasks++;
          const status = typeof t === 'string' ? 'Done' : (t.status || 'Done');
          if (status === 'Done') doneTasks++;
          else wipTasks++;
        });
      });

      let response = `## 👤 **${targetMember}** ${role ? `(${role})` : ''} - Status for **${display}** (${formattedDate})\n\n`;

      if (note && note.trim()) {
        response += `📝 **Attendance Note:** _${note.trim()}_\n\n`;
      }

      response += `📊 **Summary:** ${projects.length} project(s) | ${totalTasks} task(s) (${doneTasks} Done, ${wipTasks} WIP)\n\n`;
      response += `---\n\n`;
      response += `${tasksMarkdown}\n\n`;

      if (primaryRecord.attachments && primaryRecord.attachments.length > 0) {
        response += `📎 **Attachments:** ${primaryRecord.attachments.length} image(s) submitted.\n`;
      }

      if (updatedAt) {
        const timeFormatted = new Date(updatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
        response += `\n🕒 _Last submitted / updated at ${timeFormatted} IST_\n`;
      }

      return {
        success: true,
        type: 'member_date',
        member: targetMember,
        date: formattedDate,
        projects: projects,
        answer: response
      };
    } else {
      return {
        success: true,
        type: 'not_found',
        member: targetMember,
        date: formattedDate,
        answer: `ℹ️ **No task updates found for ${targetMember} on ${display} (${formattedDate}).**\n\nPossible reasons:\n• The employee may have been on leave.\n• No status report was submitted for this date in the system.`
      };
    }
  }

  // 2. Specific Member (Recent / All updates) e.g., "what is pranav's latest update?" or "show all pranav updates"
  if (targetMember && !targetDateObj) {
    const memberSubs = await dbRepo.getSubmissions({ member: targetMember });
    if (memberSubs && memberSubs.length > 0) {
      const recentSubs = memberSubs.slice(0, 5);
      let response = `## 👤 **${targetMember}**'s Recent Task Submissions\n\n`;
      response += `Here are the latest **${recentSubs.length}** updates logged for **${targetMember}**:\n\n`;

      recentSubs.forEach((sub) => {
        response += `### 📅 **${sub.date || sub.isoDate}**\n`;
        if (sub.note) response += `📝 _Note: ${sub.note}_\n`;
        const projList = formatTasksList(sub.projects);
        response += `${projList}\n\n`;
      });

      return {
        success: true,
        type: 'member_recent',
        member: targetMember,
        count: recentSubs.length,
        answer: response
      };
    } else {
      return {
        success: true,
        type: 'not_found',
        member: targetMember,
        answer: `ℹ️ No historical submissions found for **${targetMember}** in the database.`
      };
    }
  }

  // 3. Specific Date for Entire Team e.g. "show 16th sept report" or "all updates for 17/09/2026"
  if (targetDateObj && !targetMember) {
    const { formattedDate, display } = targetDateObj;
    const draft = await dbRepo.getDailyDraft(formattedDate);
    const submissions = await dbRepo.getSubmissions({ date: targetDateObj.isoDate, period: 'daily' });

    const teamData = (draft && Array.isArray(draft.teamData) && draft.teamData.length > 0)
      ? draft.teamData
      : [];

    if (teamData.length > 0 || submissions.length > 0) {
      let response = `## 📋 Daily Scrum Summary for **${display}** (${formattedDate})\n\n`;
      
      const submittedMembers = teamData.filter(m => (m.projects && m.projects.length > 0) || (m.note && m.note.trim() && m.note !== 'ON LEAVE'));
      const onLeaveMembers = teamData.filter(m => m.note === 'ON LEAVE' && (!m.projects || m.projects.length === 0));

      response += `📊 **Attendance:** ${submittedMembers.length} active updates, ${onLeaveMembers.length} on leave.\n\n`;
      response += `---\n\n`;

      teamData.forEach(m => {
        const mName = m.name || m.member || 'Unknown';
        const role = m.role ? `(${m.role})` : '';
        const note = m.note ? ` *[${m.note}]*` : '';

        response += `### 👤 **${mName}** ${role}${note}\n`;
        if (m.projects && m.projects.length > 0) {
          response += formatTasksList(m.projects) + '\n\n';
        } else {
          response += `  • _${m.note || 'No tasks listed'}_\n\n`;
        }
      });

      return {
        success: true,
        type: 'team_date',
        date: formattedDate,
        totalMembers: teamData.length,
        answer: response
      };
    } else {
      return {
        success: true,
        type: 'not_found',
        date: formattedDate,
        answer: `ℹ️ No team status report was found for **${display} (${formattedDate})**.`
      };
    }
  }

  // 4. Project Search or General Task Keyword Query
  const allSubmissions = await dbRepo.getSubmissions({});
  const qLower = query.toLowerCase();

  // Search through all projects
  const matchingTasks = [];
  allSubmissions.forEach(sub => {
    (sub.projects || []).forEach(proj => {
      const projName = proj.name || '';
      const pMatch = projName.toLowerCase().includes(qLower);
      (proj.tasks || []).forEach(task => {
        const tText = typeof task === 'string' ? task : (task.text || '');
        const tStatus = typeof task === 'string' ? 'Done' : (task.status || 'Done');
        if (pMatch || tText.toLowerCase().includes(qLower)) {
          matchingTasks.push({
            member: sub.member,
            date: sub.date,
            project: cleanProjectName(projName),
            taskText: tText,
            status: tStatus
          });
        }
      });
    });
  });

  if (matchingTasks.length > 0) {
    const topMatches = matchingTasks.slice(0, 15);
    let response = `## 🔍 Search Results for "${query}"\n\n`;
    response += `Found **${matchingTasks.length}** related task entries across team updates:\n\n`;

    topMatches.forEach(item => {
      let badge = item.status === 'Done' ? '✅ Done' : (item.status === 'WIP' ? '⏳ WIP' : '🔄 In Progress');
      response += `• **${item.member}** (${item.date}) on _${item.project}_:\n  ↳ ${item.taskText} [${badge}]\n`;
    });

    return {
      success: true,
      type: 'search_results',
      count: matchingTasks.length,
      answer: response
    };
  }

  // 5. Default Fallback Help / Prompt suggestions
  return {
    success: true,
    type: 'help',
    answer: `🤖 **I'm your Scrum AI Assistant!** You can ask me questions like:\n\n` +
      `• _"I want 16th sept update of Pranav"_\n` +
      `• _"Show me Harshad's tasks on 17 Sep"_\n` +
      `• _"What did Kartik work on yesterday?"_\n` +
      `• _"Summary of team report for 16/09/2026"_\n` +
      `• _"Who worked on Happy Reward?"_\n` +
      `• _"Show all recent updates for Deversh"_`
  };
}

module.exports = {
  cleanProjectName,
  parseNaturalDate,
  extractMember,
  handleAiQuery
};
