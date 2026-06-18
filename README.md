# 📬 MecoClone-Free-Newsletter-aggregator

A self-hosted, lightweight, and open-source alternative to Meco and Substack readers. It automatically fetches your newsletters from your Gmail account, filters them using a whitelist, cleans up cluttered layouts, and purges old data automatically. 

Perfect for a clean, distraction-free reading experience on both Desktop and Mobile (PWA).

---

## ✨ Features

* **Automated Sync**: Uses an IMAP sync script triggered every hour via GitHub Actions.
* **Smart Filtering**: A Supabase-backed whitelist system ensures only authorized newsletter senders reach your feed.
* **Distraction-Free Reading**: Injects custom CSS rules into an isolated `iframe` to strip out heavy marketing layouts and force a clean, elegant typography.
* **Auto-Purge Security**: Automatically deletes newsletters older than 30 days from the database to keep storage lightweight and free.
* **Mobile Ready (PWA)**: Optimized interface with custom manifest file. Can be installed directly onto an iPhone or Android home screen.

---

## 🛠️ Tech Stack

* **Frontend**: Next.js (React), Tailwind CSS, TypeScript
* **Backend & Database**: Supabase (PostgreSQL with RLS policies)
* **Email Parsing**: Node.js, `imapflow`, `mailparser`
* **Automation**: GitHub Actions (Cron-jobs)

---

## 🚀 Getting Started

### 1. Prerequisites
* A Supabase account (Free tier)
* A Gmail account with **IMAP enabled** and an **App Password** configured.

### 2. Environment Variables
Create a `.env.local` file at the root of the project:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GMAIL_USER=your_gmail_address@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_16_digit_password