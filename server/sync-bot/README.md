# Study Planner — Google Classroom Auto-Sync & Telegram Bot Daemon

A lightweight, 24/7 background automation service that pulls assignments, study materials, and announcements from Google Classroom after a **single, one-time sign-in** and dispatches formatted alerts directly to your Telegram chat.

---

## ⚡ Features

1. **One-Time Google OAuth 2.0 Login**:
   - Uses `access_type: offline` to securely acquire and store a Google `refresh_token`.
   - Never asks for interactive login again. Automatically refreshes access tokens in the background.

2. **Continuous Background Sync**:
   - Polls Google Classroom API at configurable intervals (e.g. every 15 minutes).
   - Tracks course work, published materials, and announcements.
   - Detects new assignments and altered due dates/deadlines.

3. **Telegram Bot Dispatcher**:
   - Powered by [grammY](https://grammy.dev/).
   - Sends real-time notifications with Markdown/HTML formatting and direct links to Classroom.
   - Commands:
     - `/start`: Registers your chat ID automatically.
     - `/sync`: Forces an immediate check for updates.
     - `/status`: Checks connection health and sync interval.

4. **Multi-User Ready Architecture**:
   - Structured with isolated token and state storage (`tokens.json`, `sync-state.json`) easily migratable to a multi-tenant DB (e.g. Supabase/PostgreSQL) when expanding to other students.

---

## 🚀 Setup Guide

### Step 1: Install Dependencies
Open a terminal in the daemon directory:
```bash
cd "server/sync-bot"
npm install
```

---

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` and fill in:
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
TELEGRAM_CHAT_ID=
SYNC_INTERVAL_MINUTES=15
```

> **Where to get these?**
> - **Telegram Bot Token**: Message [@BotFather](https://t.me/BotFather) on Telegram -> `/newbot` -> copy the token.
> - **Google Client ID & Secret**: From Google Cloud Console (`APIs & Services` -> `Credentials` -> Create OAuth Client ID -> Web application).
>   - Add Authorized redirect URI: `http://localhost:3000/oauth2callback`

---

### Step 3: Perform One-Time Google Authorization
Run the one-time interactive login script:
```bash
npm run auth
```
1. Click or copy the URL printed in the terminal.
2. Sign in to your Google Account and approve permissions.
3. Upon redirection, your `refresh_token` is saved to `tokens.json`.

---

### Step 4: Start the Daemon
```bash
npm run bot
```
1. Open your Telegram bot and send `/start`.
2. The bot will automatically pair with your account.
3. The daemon will immediately perform an initial sync and continue running in the background!
