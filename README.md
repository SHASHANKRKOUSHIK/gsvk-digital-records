# GSVK Digital Record Management System

**Guru Shree Vidya Kendra — School Admission Digitization System**

A full-stack production-ready system to digitize, manage, and search school admission records from 1999–2026.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, TailwindCSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL + Prisma ORM |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| OCR | Google Vision API |
| Excel | ExcelJS |
| Deployment | Vercel / Docker |

---

## Features

- **Admin Login** — Supabase Auth with Super Admin & Data Entry Operator roles
- **Dashboard** — Stats, charts (admissions per year/class), recent records
- **Manual Entry** — Full student admission form with 30+ fields
- **OCR Upload** — Single document scan with Google Vision API, editable review screen
- **Bulk OCR** — Upload multiple files, batch processing with progress tracking
- **Student Profiles** — Unique public URL per student (`/student/{id}`) with QR code
- **Search** — Full-text search across name, father, phone, Aadhar, class, year
- **Excel Export** — Class-wise, year-wise, combined exports with clickable profile URLs
- **Duplicate Detection** — Warns before saving based on name+DOB, father name, phone
- **Audit Logs** — Full history of create/update/delete per student
- **Backup** — Manual and daily automated JSON backups
- **Responsive UI** — Desktop, tablet, mobile

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd gsvk-digital-records
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Set up database

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name (default: `gsvk-documents`) |
| `GOOGLE_VISION_API_KEY` | Google Cloud Vision API key |
| `NEXT_PUBLIC_APP_URL` | Public app URL (for profile links and QR codes) |

---

## Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Enable Email Auth under Authentication → Providers
3. Create a storage bucket named `gsvk-documents` (set to public)
4. Create admin users under Authentication → Users
5. Run the seed to sync user records:
   ```bash
   npm run db:seed
   ```

> **Important:** After creating a Supabase auth user, their email must exist in the `users` table in your PostgreSQL database (handled by seed). The role (`SUPER_ADMIN` or `DATA_ENTRY_OPERATOR`) is set in the `users` table.

---

## Google Vision API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Cloud Vision API**
3. Create an API key under APIs & Services → Credentials
4. Restrict the key to Cloud Vision API for security
5. Add to `.env` as `GOOGLE_VISION_API_KEY`

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel

# Set environment variables in Vercel dashboard or via CLI:
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_URL
# ... etc
```

Use a managed PostgreSQL service like [Neon](https://neon.tech) or [Supabase Postgres](https://supabase.com/docs/guides/database).

---

## Deploy with Docker

```bash
# Copy env file
cp .env.example .env
# Edit .env

# Start all services
docker-compose up -d

# Run migrations
docker exec gsvk_app npx prisma migrate deploy

# Seed database
docker exec gsvk_app node prisma/seed.js
```

---

## Database Commands

```bash
npm run db:push          # Push schema changes (dev)
npm run db:migrate       # Create migration
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed initial data
npm run db:backup        # Run manual backup
node scripts/seed-historical.js  # Seed 1999-2026 sample data
```

---

## Daily Backup (Cron)

Add to crontab for daily 2am backup:

```cron
0 2 * * * cd /path/to/project && node scripts/backup.js >> /var/log/gsvk-backup.log 2>&1
```

---

## Project Structure

```
gsvk-digital-records/
├── app/
│   ├── api/
│   │   ├── audit/          # Audit log API
│   │   ├── backup/         # Backup trigger API
│   │   ├── dashboard/      # Dashboard stats API
│   │   ├── documents/      # Document upload API
│   │   ├── exports/        # Excel export API
│   │   ├── ocr/            # Single + bulk OCR API
│   │   ├── search/         # Search API
│   │   └── students/       # Student CRUD API
│   ├── dashboard/          # Admin dashboard pages
│   │   ├── exports/        # Excel export page
│   │   ├── ocr/            # OCR pages
│   │   ├── search/         # Search page
│   │   ├── settings/       # Settings + backup
│   │   └── students/       # Student list + forms
│   ├── login/              # Login page
│   └── student/[id]/       # Public student profile
├── components/
│   ├── charts/             # Recharts dashboard charts
│   ├── forms/              # StudentForm component
│   └── ui/                 # Toaster, etc.
├── hooks/                  # use-toast hook
├── lib/                    # prisma, supabase, utils, auth
├── prisma/                 # Schema + seed
├── scripts/                # Backup + seed scripts
├── services/               # OCR, Excel, QR code services
└── types/                  # TypeScript types
```

---

## User Roles

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | Full access — CRUD students, manage exports, run backups, delete records |
| `DATA_ENTRY_OPERATOR` | Create & update students, upload documents, run OCR. Cannot delete. |

---

## Excel Export Format

Each exported `.xlsx` file includes:

- School header (Guru Shree Vidya Kendra)
- Auto-filter on all columns
- Alternating row colors
- **Clickable hyperlinks** in Profile URL column
- Class-wise sheets in combined export

---

## OCR Field Mapping

The Google Vision OCR attempts to extract:

- Student Name, Admission Number, Date of Birth
- Father Name, Mother Name, Phone
- Class, Section, Academic Year
- Aadhar Number, Blood Group, Address, Religion, Gender

All extracted fields are pre-filled in an editable review form before saving.

---

## License

Proprietary — Guru Shree Vidya Kendra. All rights reserved.
