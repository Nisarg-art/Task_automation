const { pgTable, text, integer, boolean, jsonb, timestamp } = require('drizzle-orm/pg-core');

// 1. Team Users & Passwords
const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  role: text('role').default(''),
  password: text('password').default(''),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

// 2. Daily Scrum Drafts (Grouped aggregated snapshot per Date)
const dailyDrafts = pgTable('daily_drafts', {
  date: text('date').primaryKey(),
  teamData: jsonb('team_data').default([]),
  version: integer('version').default(0),
  lastUpdated: text('last_updated').default(''),
});

// 3. Persistent Individual Task Submissions Log (Every employee update)
const submissions = pgTable('submissions', {
  id: text('id').primaryKey(),
  member: text('member').notNull(),
  role: text('role').default(''),
  note: text('note').default(''),
  projects: jsonb('projects').default([]),
  attachments: jsonb('attachments').default([]),
  date: text('date').notNull(),
  isoDate: text('iso_date').notNull(),
  timestamp: text('timestamp').notNull(),
});

// 4. Dispatched Status Report History (Sent to Google Chat)
const history = pgTable('history', {
  id: text('id').primaryKey(),
  formattedText: text('formatted_text').notNull(),
  status: text('status').default('Sent to Google Chat'),
  timestamp: text('timestamp').notNull(),
});

// 5. System Configuration (Webhook, reminder times, admin password)
const config = pgTable('config', {
  id: text('id').primaryKey().default('main'),
  webhookUrl: text('webhook_url').default(''),
  reminderTime: text('reminder_time').default('18:28'),
  employeeReminderTime: text('employee_reminder_time').default('18:00'),
  autoLeaveTime: text('auto_leave_time').default('18:25'),
  autoDispatch: boolean('auto_dispatch').default(true),
  adminPassword: text('admin_password').default('nisarg@2002'),
  updatedAt: text('updated_at'),
});

// 6. Push Notification Subscriptions (WebPush + Firebase FCM)
const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  type: text('type').default('webpush'),
  endpoint: text('endpoint'),
  keys: jsonb('keys'),
  fcmToken: text('fcm_token'),
  role: text('role').default('employee'),
  member: text('member').default(''),
  updatedAt: text('updated_at'),
});

// 7. WebPush VAPID Keys
const vapidKeys = pgTable('vapid_keys', {
  id: text('id').primaryKey().default('main'),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
});

module.exports = {
  users,
  dailyDrafts,
  submissions,
  history,
  config,
  pushSubscriptions,
  vapidKeys,
};
