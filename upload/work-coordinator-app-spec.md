# WorkFlow Hub — Work Assignment, Follow-up & Completion Tracker
### Full Workflow, Data Model & Wireframe Spec (Build-Ready)

---

## 1. What This App Is

A lightweight internal tool to **assign, track, and close out work** across your operational areas:

- Website Core (maintenance, uptime, bugs)
- Online Payments (gateway issues, reconciliation, disputes)
- Web Development (new features, client sites, fixes)
- Store Support (product/store operational issues)

It is **not** a generic project tool like Asana/Trello — it's built around your actual process: *work usually arrives as an email → someone has to read it, assign it, reply professionally, and chase it until it's done.* That email-to-task loop is the centerpiece, everything else (employees, notifications, boards) supports it.

### Design decisions, based on what works (and doesn't) in Trello/Asana/Zendesk-style tools
- **Single clear owner per task** (Asana's biggest complaint is unclear ownership when multiple people are tagged) — one Assignee, optional Watchers/Collaborators.
- **Kanban board + List view**, like Trello/Asana — board for visual flow, list for "show me everything overdue."
- **Built-in automation for the boring parts**: reminders, overdue flags, status-change notifications — done by the system, not a person nagging on Slack.
- **Keep it simple**: 4 fixed work categories (you can add more later), one workspace, no multi-project sprawl. Power comes from the email-reply AI + notification engine, not from feature bloat.

---

## 2. End-to-End Workflow

```
 1. EMAIL ARRIVES (client/store/payment provider/etc.)
        │
        ▼
 2. ADMIN PASTES EMAIL into "New Work from Email" panel
        │
        ▼
 3. APP EXTRACTS DETAILS  → Subject, sender, summary, suggested category, suggested priority
        │
        ▼
 4. APP GENERATES PROFESSIONAL REPLY DRAFT (editable before sending)
        │
        ▼
 5. ADMIN REVIEWS draft → edits if needed → marks "Reply Sent" (copies it into their email client)
        │
        ▼
 6. WORK ITEM CREATED  → category, priority, due date auto-suggested
        │
        ▼
 7. ASSIGN TO EMPLOYEE  → employee gets in-app + (optional) email notification
        │
        ▼
 8. EMPLOYEE WORKS ON IT  → moves status: Assigned → In Progress → Blocked (optional) → Review → Done
        │
        ▼
 9. FOLLOW-UP ENGINE  → if no status update before due date → reminder to employee
                       → if overdue → escalation notification to admin/manager
        │
        ▼
10. COMPLETION  → admin verifies → marks Closed → (optional) generates "task completed" reply to original sender
        │
        ▼
11. HISTORY/LOG retained for reporting (who did what, how long it took, how many follow-ups it took)
```

### Status states (kept deliberately simple)
`New → Assigned → In Progress → Blocked → In Review → Done → Closed`
(`Blocked` is optional/skippable; `Closed` = verified by admin, separate from `Done` = employee says finished)

---

## 3. Core Modules

| # | Module | Purpose |
|---|--------|---------|
| 1 | **Dashboard** | At-a-glance: open work, overdue, by category, by employee |
| 2 | **Email → Task + Reply Generator** | Paste email → extract task → generate reply draft |
| 3 | **Work Board** | Kanban + List view of all tasks, filterable by category/employee/status |
| 4 | **Task Detail** | Full task info, comments/activity log, attachments, status changes |
| 5 | **Employees** | Add/manage employees, their category skills, workload |
| 6 | **Notifications** | In-app bell + list: assignments, due-soon, overdue, replies needed |
| 7 | **Reports** | Completion time, overdue count, workload per employee, per category |
| 8 | **Settings** | Categories, priority levels, reminder timing, email-reply tone/templates |

---

## 4. Roles

- **Admin/Manager** — sees everything, assigns work, verifies & closes tasks, manages employees, edits settings.
- **Employee** — sees only their assigned work, updates status, comments, uploads proof of completion.

(Keep it to these two roles. Don't over-engineer permissions for a small team — that's exactly the Asana over-complexity trap.)

---

## 5. The Email → Task → Reply Feature (the core differentiator)

### Step-by-step UX
1. Admin clicks **"New Work from Email"**.
2. Pastes the raw email text into a textarea (`Email Content` box) and optionally the sender's name/email.
3. Click **"Analyze"**.
4. App returns a structured suggestion card:
   - Suggested Title
   - Suggested Category (Website Core / Payments / Web Dev / Store Support — auto-detected from keywords, editable dropdown)
   - Suggested Priority (Low/Medium/High/Urgent)
   - 2-3 line Summary
   - Suggested due date (based on priority)
5. Below it, a **"Generated Reply"** box — a professional, ready-to-send email acknowledging the request, setting expectations, and (if assigned already) naming who's handling it.
6. Admin can **regenerate with a different tone** (Formal / Friendly / Apologetic-for-delay) or edit directly.
7. Buttons: **"Copy Reply"**, **"Create Task & Save"**, **"Create Task + Assign Now"**.
8. Once created, the task carries the original email text + the reply sent as its first activity log entries — full traceability without needing real email/inbox integration.

### Why paste-based (not full inbox integration) for v1
Inbox integration (Gmail/Outlook API, OAuth, parsing live threads) adds real complexity and maintenance burden. Paste-and-generate gives you 90% of the value with near-zero infrastructure — you can always add Gmail API integration later as v2 without changing the core data model.

### How the reply is generated
A backend call to an LLM (Claude API) with a prompt like:
```
You are a professional support/operations assistant for [Company].
Given this incoming email, write a concise, professional reply that:
- Acknowledges the request
- Confirms what will happen next and a realistic timeframe
- Is in tone: {{tone}}
Do not invent specific commitments beyond what's provided.
Email: """{{pasted_email}}"""
Assigned to: {{employee_name or "our team"}}
Category: {{category}}
```

---

## 6. Notifications & Follow-up Engine

**In-app notification types:**
- 🆕 New task assigned to you
- ⏰ Due in 24h / Due today
- 🔴 Overdue (escalates to manager after N hours)
- 💬 New comment on your task
- ✅ Task marked Done — needs your verification (to Admin)
- ✍️ Reply not yet sent for new email-task (to Admin)

**Follow-up rules (configurable in Settings):**
| Trigger | Action |
|---|---|
| Task assigned | Notify employee immediately |
| 24h before due date, no progress update | Reminder to employee |
| Due date passed, status not Done/Closed | Escalation to Admin + employee |
| Task in "In Review" > 24h | Reminder to Admin to verify |
| No reply sent on email-task within X hours | Reminder to Admin |

Notifications live in a bell icon dropdown + a dedicated **Notifications** page (filter: All / Unread / Assigned to me / Overdue).

(No external SMS/push needed for v1 — keep delivery in-app + optional email digest, add push later if needed.)

---

## 7. Data Model

```
User
 - id, name, email, role (admin/employee), category_skills[], active, created_at

Category
 - id, name, color   (seed: Website Core, Online Payments, Web Development, Store Support)

Task
 - id, title, description
 - category_id
 - priority (low/medium/high/urgent)
 - status (new/assigned/in_progress/blocked/in_review/done/closed)
 - assignee_id
 - created_by_id
 - source_email_text (nullable, raw pasted email)
 - source_sender (nullable)
 - generated_reply_text (nullable)
 - reply_sent (boolean)
 - due_date
 - created_at, updated_at, closed_at

ActivityLog
 - id, task_id, user_id, action_type (status_change/comment/reply_generated/reply_sent/assigned/...)
 - content, created_at

Notification
 - id, user_id, task_id, type, message, read (bool), created_at

Comment / Attachment
 - id, task_id, user_id, body, file_url (optional), created_at
```

---

## 8. Wireframes (Screen by Screen)

### 8.1 Login
```
┌─────────────────────────────────────────┐
│            WorkFlow Hub                 │
│                                          │
│   Email     [______________________]    │
│   Password  [______________________]    │
│                                          │
│            [   Log In   ]               │
└─────────────────────────────────────────┘
```

### 8.2 Dashboard (landing page after login)
```
┌──────────────────────────────────────────────────────────────────┐
│ WorkFlow Hub     🔔(3)   👤 Admin ▾                                │
├───────────────┬────────────────────────────────────────────────┤
│ ▸ Dashboard    │  Today's Snapshot                               │
│ ▸ New from     │  ┌───────┬───────┬───────┬───────┐              │
│   Email        │  │ Open  │Overdue│ Due   │ Done   │              │
│ ▸ Work Board   │  │  18   │  3🔴  │ Today 5│ this wk 12 │         │
│ ▸ Employees    │  └───────┴───────┴───────┴───────┘              │
│ ▸ Notifications│                                                 │
│ ▸ Reports      │  By Category                                   │
│ ▸ Settings     │  [Website Core: 5] [Payments: 4]                │
│                │  [Web Dev: 6] [Store Support: 3]                │
│                │                                                 │
│                │  ⚠ Needs Attention                              │
│                │  • Payment gateway timeout — overdue 1d (John)  │
│                │  • Store checkout bug — reply not sent yet      │
│                │  • Homepage banner update — due today (Asha)    │
└───────────────┴────────────────────────────────────────────────┘
```

### 8.3 New Work from Email (the key screen)
```
┌──────────────────────────────────────────────────────────────────┐
│  New Work from Email                                              │
├──────────────────────────────────────────────────────────────────┤
│  Sender name/email (optional)  [____________________________]    │
│                                                                    │
│  Paste email content:                                            │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                                                            │    │
│  │  (textarea — paste full email here)                      │    │
│  │                                                            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                  [ Analyze Email ]                │
│ ───────────────────────────────────────────────────────────────  │
│  Suggested Task                                                   │
│  Title       [___________________________________]               │
│  Category    [ Online Payments ▾ ]   Priority [ High ▾ ]          │
│  Due Date    [ 2026-07-02 ]                                       │
│  Summary     "Customer reports failed payment retries on..."      │
│                                                                    │
│  Generated Reply             Tone: [Formal ▾] [Regenerate]       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Dear ___,                                                │    │
│  │  Thank you for reaching out regarding...                 │    │
│  │  (editable textarea)                                      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                              [ Copy Reply ]                       │
│                                                                    │
│  Assign to  [ Select employee ▾ ]                                 │
│       [ Save as Task ]     [ Save + Assign Now ]                  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.4 Work Board (Kanban)
```
┌──────────────────────────────────────────────────────────────────┐
│ Work Board     Filter: [Category ▾] [Employee ▾] [Priority ▾]     │
├───────────┬───────────┬────────────┬───────────┬────────┬───────┤
│   New     │ Assigned  │In Progress │ Blocked   │In Review│ Done  │
├───────────┼───────────┼────────────┼───────────┼────────┼───────┤
│┌─────────┐│┌─────────┐│┌──────────┐│┌─────────┐│┌──────┐│┌─────┐│
││Card:     │││Card:     │││Card:      │││Card:    │││Card:  │││Card: ││
││Title     │││Title     │││Title      │││Title    │││Title  │││Title ││
││🏷 Payments│││🏷 WebDev │││🏷 Store   │││🏷 Site  │││🏷 Web │││🏷 .. ││
││👤 -      │││👤 John   │││👤 Asha    │││👤 Raj   │││👤 Liz │││👤 .. ││
││🔴 High   │││🟡 Med    │││🔴 Urgent  │││🟡 Med   │││🟢 Low │││ ..   ││
││Due Jul 2 │││Due Jul 1 │││Due Today  │││Due Jul3 │││Done   │││ ..   ││
│└─────────┘│└─────────┘│└──────────┘│└─────────┘│└──────┘│└─────┘│
└───────────┴───────────┴────────────┴───────────┴────────┴───────┘
   (drag cards between columns to change status; click card → detail view)
```

### 8.5 Task Detail
```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back to board                                                   │
│  Payment gateway timeout for repeat customers                     │
│  🏷 Online Payments   🔴 High   Status: [In Progress ▾]            │
│  Assignee: [ John ▾ ]   Due: [ 2026-07-02 ]                       │
├──────────────────────────────────────────────────────────────────┤
│ Description                                                       │
│  Customer X reports repeated payment failures on retry...        │
│                                                                    │
│ Original Email (collapsed)        [Show]                          │
│ Reply Sent ✅  [View reply]                                        │
│                                                                    │
│ Activity & Comments                                                │
│  • Admin created task from email — Jun 30, 10:02                  │
│  • Admin assigned to John — Jun 30, 10:05                         │
│  • John: "Looking into gateway logs now." — Jun 30, 14:20          │
│  [ Add comment...........................]  [Attach file] [Send] │
│                                                                    │
│  [Mark as Done]                  [Admin: Verify & Close]          │
└──────────────────────────────────────────────────────────────────┘
```

### 8.6 Employees
```
┌──────────────────────────────────────────────────────────────────┐
│ Employees                                  [ + Add Employee ]     │
├──────────────────────────────────────────────────────────────────┤
│ Name       Email              Skills/Categories      Open Tasks   │
│ John D.    john@co.com        Payments, WebDev        4           │
│ Asha R.    asha@co.com        Store Support           2           │
│ Liz K.     liz@co.com         Website Core, WebDev     3           │
│                                            [Edit] [Deactivate]     │
└──────────────────────────────────────────────────────────────────┘

  Add Employee modal:
  ┌───────────────────────────────┐
  │ Name        [____________]    │
  │ Email       [____________]    │
  │ Role        [Employee ▾]      │
  │ Categories  [✓Website ✓WebDev]│
  │              [Cancel] [Save]  │
  └───────────────────────────────┘
```

### 8.7 Notifications
```
┌──────────────────────────────────────────────────────────────────┐
│ Notifications        Filter: [All ▾]              [Mark all read] │
├──────────────────────────────────────────────────────────────────┤
│ 🔴 Overdue: "Checkout bug" assigned to Raj — 1 day overdue        │
│ ⏰ Due today: "Homepage banner update" — Asha                     │
│ ✍️ Reply not sent: "Store inventory sync issue"                   │
│ ✅ Done — needs verification: "SSL cert renewal" — Liz             │
│ 🆕 You were assigned: "Refund dispute #2291"                      │
└──────────────────────────────────────────────────────────────────┘
```

### 8.8 Settings
```
┌──────────────────────────────────────────────────────────────────┐
│ Settings                                                           │
├──────────────────────────────────────────────────────────────────┤
│ Categories        [Website Core][Payments][Web Dev][Store Support]│
│                    [+ Add category]                               │
│ Priority due-date defaults: Urgent=4h  High=1d  Medium=3d  Low=7d  │
│ Reminder timing:  24h before due, Overdue check every: [2h ▾]      │
│ Reply tone default: [Formal ▾]                                    │
│ Company name (used in replies): [_______________]                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Recommended Tech Stack (simple, but production-ready)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Tailwind | Fast to build, you already have component libs in this environment |
| Backend | Node.js + Express (or Next.js full-stack) | One language, simple deploy |
| Database | PostgreSQL (or SQLite for very small scale) | Relational fits Tasks/Users/Categories cleanly |
| Auth | Simple email/password + JWT, or Clerk/Auth.js if you want it managed | Only 2 roles — don't over-build |
| Email reply generation | Anthropic API (Claude) | Already available; structured prompt as in §5 |
| Notifications | In-app polling/WebSocket (Socket.io) + scheduled cron job for due/overdue checks | No external SMS/push needed for v1 |
| Hosting | Vercel/Render/Railway + managed Postgres | Minimal ops overhead |

### Suggested folder structure
```
/app
  /frontend
    /pages (Dashboard, Board, TaskDetail, Employees, Notifications, Settings, EmailIntake)
    /components
  /backend
    /routes (tasks, users, notifications, email-analyze)
    /services (reply-generator.js, follow-up-cron.js)
    /db (models/migrations)
  /shared (types, constants: categories, priorities, statuses)
```

### Key API endpoints
```
POST   /api/email/analyze        → returns suggested task fields + draft reply
POST   /api/tasks                → create task
GET    /api/tasks?status=&category=&assignee=
PATCH  /api/tasks/:id             → status/assignee/due_date updates
POST   /api/tasks/:id/comments
GET    /api/notifications?user_id=
PATCH  /api/notifications/:id/read
POST   /api/users                 → add employee
GET    /api/reports/summary
```

---

## 10. Build Order (MVP → v2)

**Phase 1 (MVP, ~1-2 weeks for a solo dev):**
1. Auth (admin/employee), Employees CRUD
2. Task CRUD + Board (Kanban) + List view
3. Email-analyze + reply-generation endpoint (this is your differentiator — build early)
4. Basic in-app notifications (assignment + overdue, no fancy cron yet — check on page load)

**Phase 2:**
5. Scheduled follow-up engine (cron checks every X hours, creates notifications)
6. Activity log + comments + attachments
7. Reports page (completion time, workload)

**Phase 3 (optional/later):**
8. Real inbox integration (Gmail/Outlook API) instead of paste
9. Email digest notifications, mobile-friendly PWA
10. Multiple managers / team hierarchy if you grow beyond a small team

---

## 11. Why this stays "simple but powerful"
- One workspace, 4 fixed-but-editable categories, 2 roles — no setup complexity.
- The AI does the two most annoying parts of your job: **reading/triaging emails** and **writing the reply** — you just review and click.
- The follow-up engine replaces "remembering to check in on people" — the system nags, not you.
- Everything else (board, employees, notifications) is deliberately copied from patterns proven in Trello/Asana rather than reinvented.
