# 🚀 Task Automation - Scrum Master Daily Status & Google Chat Bot

An automated tool for Scrum Masters and QA Leads to aggregate developer/designer daily status reports, format them into standardized templates, and dispatch them to Google Chat spaces via webhooks or auto-cron schedules.

## ✨ Features
- 📱 **Team Submission Portal (`/submit`)**: Developers and designers submit daily updates across multiple projects with single-click ease.
- ⚡ **1-on-1 Chat Aggregator & Smart Parser**: Paste raw unstructured chat messages and auto-parse into clean structure.
- ⏰ **6:25 PM Auto-Leave Cutoff**: Automatically marks unsubmitted/pending team members as `ON LEAVE` so reports remain complete without manual follow-ups.
- ⏰ **6:28 PM Auto-Cron Dispatcher**: Automatically compiles and shoots the consolidated status report to Sir's Google Chat space.
- 🔴 **Bold Headers & Bold Red Attendance Badges**: Standardized formatting with bold member/project names and highlighted attendance notes (`ON HALF DAY`, `ON LEAVE`).
- 🟢 **Live Team Submission Checklist**: Real-time tracker showing which team members have submitted vs. pending.
- 🗄️ **Neon Cloud Database with Drizzle ORM**: Persistent serverless PostgreSQL storage to ensure submissions are permanently retained and never lost across serverless restarts.

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Neon Database)
Create a `.env` file in the root directory (or use `.env.example` as a template):
```env
DATABASE_URL=postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
PORT=3050
```

> **Note:** If `DATABASE_URL` is omitted, the application will automatically fall back to local file storage.

### 3. Database Commands (Optional)
```bash
# Push schema changes to Neon PostgreSQL
npm run db:push

# Open Drizzle Studio web GUI
npm run db:studio
```

### 4. Start the Server
```bash
npm start
# or for development mode:
npm run dev
```

### 5. Open in Browser
- **Admin Dashboard**: `http://localhost:3050`
- **Team Submit Link**: `http://<YOUR-IP>:3050/submit`

