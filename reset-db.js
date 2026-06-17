const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.export.deleteMany({})
  await prisma.backup.deleteMany({})
  await prisma.auditLog.deleteMany({})
  await prisma.ocrJob.deleteMany({})
  await prisma.document.deleteMany({})
  await prisma.parent.deleteMany({})
  await prisma.student.deleteMany({})
  console.log('Everything cleared! Dashboard will show all zeros.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())