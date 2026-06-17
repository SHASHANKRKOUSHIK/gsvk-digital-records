#!/usr/bin/env node
/**
 * Daily backup script — run via cron:
 * 0 2 * * * node /path/to/project/scripts/backup.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()
const BACKUP_DIR = process.env.BACKUP_STORAGE_PATH || path.join(__dirname, '..', 'backups')

async function main() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `gsvk-backup-${timestamp}.json`
  const filePath = path.join(BACKUP_DIR, fileName)

  console.log(`[Backup] Starting backup at ${new Date().toISOString()}`)

  const [students, users, ocrJobs, auditLogs, exports_] = await Promise.all([
    prisma.student.findMany({ include: { parents: true, documents: true } }),
    prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true } }),
    prisma.ocrJob.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 }),
    prisma.export.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  ])

  const backup = {
    metadata: {
      version: '1.0.0',
      school: 'Guru Shree Vidya Kendra',
      exportedAt: new Date().toISOString(),
      counts: {
        students: students.length,
        users: users.length,
        ocrJobs: ocrJobs.length,
        auditLogs: auditLogs.length,
      },
    },
    data: { students, users, ocrJobs, auditLogs, exports: exports_ },
  }

  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf8')
  const stats = fs.statSync(filePath)
  console.log(`[Backup] Written to ${filePath} (${(stats.size / 1024).toFixed(0)} KB)`)

  // Keep only last 30 backups
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('gsvk-backup-') && f.endsWith('.json'))
    .sort()
    .reverse()

  if (files.length > 30) {
    files.slice(30).forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f))
      console.log(`[Backup] Removed old backup: ${f}`)
    })
  }

  // Log to database
  try {
    await prisma.backup.create({
      data: {
        backupType: 'DAILY',
        storagePath: filePath,
        fileSize: stats.size,
        status: 'COMPLETED',
      },
    })
  } catch (e) {
    console.warn('[Backup] Could not log to database:', e.message)
  }

  console.log(`[Backup] Complete. ${students.length} students backed up.`)
}

main()
  .catch(err => { console.error('[Backup] FAILED:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
