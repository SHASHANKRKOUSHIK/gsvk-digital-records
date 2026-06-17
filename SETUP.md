# GSVK — Complete Windows Setup Guide

## Prerequisites

Install these first (if not already installed):

| Tool | Download | Why |
|------|----------|-----|
| Node.js LTS (v20+) | https://nodejs.org | Runs the app |
| Git (optional) | https://git-scm.com | Version control |
| 7-Zip | https://7-zip.org | Extract the archive |

---

## Step 1 — Extract & Open Project

1. Right-click `gsvk-digital-records-complete.tar.gz` → 7-Zip → Extract Here
2. You'll get a folder called `gsvk`
3. Open PowerShell in that folder:

```powershell
# Navigate into the project folder (the one with package.json)
cd C:\Users\ShaShank\Downloads\gsvk

# Confirm you're in the right place:
ls package.json   # Should show the file
```

---

## Step 2 — Install Dependencies

```powershell
npm install
```

Takes 1-3 minutes. You'll see packages being downloaded.

---

## Step 3 — Create Your .env File

```powershell
Copy-Item .env.example .env
notepad .env
```

Fill in the values — see each section below:

---

## Step 4 — Database Setup (Choose One)

### Option A: Neon (FREE cloud database — EASIEST, no install)

1. Go to https://neon.tech → **Sign up free**
2. Click **New Project** → name it `gsvk` → Create
3. Click **Connect** → copy the connection string, looks like:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Paste as your `DATABASE_URL` in `.env`

### Option B: Local PostgreSQL

1. Download from https://www.postgresql.org/download/windows/
2. Install → remember the password you set
3. Open **pgAdmin** (installed with PostgreSQL)
4. Right-click Databases → Create → Database → name it `gsvk_db`
5. Your DATABASE_URL:
   ```
   postgresql://postgres:YourPasswordHere@localhost:5432/gsvk_db
   ```

---

## Step 5 — Supabase Setup (Auth + File Storage)

1. Go to https://supabase.com → **Start your project** (free)
2. New Project → pick a region → set a password → Create
3. Wait ~2 minutes for it to provision
4. Go to **Settings → API** (left sidebar):
   - Copy **Project URL** → paste as `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public** → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role** → paste as `SUPABASE_SERVICE_ROLE_KEY`

5. Create storage bucket:
   - Left sidebar → **Storage** → **New bucket**
   - Name: `gsvk-documents`
   - Toggle **Public bucket** → ON
   - Click **Save**

6. Create your admin user:
   - Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**
   - Email: `admin@gsvk.edu.in`
   - Password: (choose something secure)
   - Click **Create user**

---

## Step 6 — Google Vision API (for OCR — Optional)

> You can skip this and still use manual entry, search, and exports. OCR just won't work.

1. Go to https://console.cloud.google.com
2. Top menu → **Select a project** → **New Project** → Create
3. Search bar → type **"Cloud Vision API"** → Click it → **Enable**
4. Left menu → **APIs & Services** → **Credentials**
5. **+ Create Credentials** → **API Key** → Copy it
6. Paste as `GOOGLE_VISION_API_KEY` in `.env`

---

## Step 7 — Your Final .env File

It should look like this (with your real values):

```env
DATABASE_URL="postgresql://username:password@ep-xxx.neon.tech/neondb?sslmode=require"

NEXT_PUBLIC_SUPABASE_URL="https://abcdefghij.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi..."

SUPABASE_STORAGE_BUCKET="gsvk-documents"

GOOGLE_VISION_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SCHOOL_NAME="Guru Shree Vidya Kendra"

BACKUP_STORAGE_PATH="./backups"
```

---

## Step 8 — Run Database Migration

```powershell
npx prisma db push
```

This creates all tables in your database. You should see:
```
✔ Generated Prisma Client
✔ Your database is now in sync with your Prisma schema.
```

---

## Step 9 — Seed Sample Data

```powershell
npm run db:seed
```

This creates 2 admin users in the database and 8 sample students.

---

## Step 10 — Start the App

```powershell
npm run dev
```

Open your browser: **http://localhost:3000**

Log in with:
- **Email:** `admin@gsvk.edu.in`
- **Password:** (whatever you set in Supabase)

---

## Troubleshooting

### Error: `'next' is not recognized`
```powershell
npm install        # Re-install dependencies
```

### Error: Prisma connection refused
- Make sure your DATABASE_URL is correct
- If using local PostgreSQL, make sure the service is running
- Try Neon instead (no local setup needed)

### Error: `P2002 Unique constraint`
The seed has already been run. Safe to ignore.

### Error: Invalid Supabase URL
Make sure you copied the full URL including `https://`

### Login doesn't work / says "Unauthorized"
The user exists in Supabase Auth but not in the database.
Run the seed again: `npm run db:seed`
Then check that the email in Supabase exactly matches `admin@gsvk.edu.in`

### OCR returns no data
- Check your `GOOGLE_VISION_API_KEY` is set correctly
- Make sure Cloud Vision API is enabled in Google Cloud Console
- The image must be clear and readable

---

## Seed Historical Data (1999-2026)

To generate ~1000 sample records across all years:

```powershell
node scripts/seed-historical.js
```

---

## Deploy to Vercel (Free Hosting)

```powershell
npm install -g vercel
vercel
```

1. Follow the prompts (link to your Vercel account)
2. Go to https://vercel.com → your project → **Settings → Environment Variables**
3. Add all the same variables from your `.env` file
4. Redeploy

Use **Neon** for DATABASE_URL on Vercel (works perfectly with serverless).
Change `NEXT_PUBLIC_APP_URL` to your Vercel URL.

---

## Daily Backup

To run a manual backup:
```powershell
npm run db:backup
```

To automate (Windows Task Scheduler):
- Action: `node C:\path\to\gsvk\scripts\backup.js`
- Trigger: Daily at 2:00 AM
