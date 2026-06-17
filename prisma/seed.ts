import { PrismaClient, Role, Gender, BloodGroup } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@gsvk.edu.in' },
    update: {},
    create: { email: 'admin@gsvk.edu.in', name: 'Super Admin', role: Role.SUPER_ADMIN },
  })

  await prisma.user.upsert({
    where: { email: 'operator@gsvk.edu.in' },
    update: {},
    create: { email: 'operator@gsvk.edu.in', name: 'Data Entry Operator', role: Role.DATA_ENTRY_OPERATOR },
  })

  const samples = [
    { name: 'Aarav Sharma',   cls: '5',  year: '2024-25', adm: 'ADM-2024-0001' },
    { name: 'Priya Patel',    cls: '3',  year: '2024-25', adm: 'ADM-2024-0002' },
    { name: 'Rohan Singh',    cls: '8',  year: '2023-24', adm: 'ADM-2023-0001' },
    { name: 'Anjali Gupta',   cls: '10', year: '2022-23', adm: 'ADM-2022-0001' },
    { name: 'Vikram Reddy',   cls: '1',  year: '2021-22', adm: 'ADM-2021-0001' },
  ]

  for (const s of samples) {
    const student = await prisma.student.upsert({
      where: { admissionNumber: s.adm },
      update: {},
      create: {
        admissionNumber: s.adm,
        admissionDate: new Date(),
        studentName: s.name,
        gender: Gender.MALE,
        dateOfBirth: new Date('2012-06-15'),
        bloodGroup: BloodGroup.O_POS,
        className: s.cls,
        section: 'A',
        academicYear: s.year,
        religion: 'Hindu',
      },
    })

    const existing = await prisma.parent.findFirst({ where: { studentId: student.id } })
    if (!existing) {
      await prisma.parent.create({
        data: {
          studentId: student.id,
          fatherName: `${s.name.split(' ')[1]} Sr.`,
          motherName: `Sunita ${s.name.split(' ')[1]}`,
          phone: `98765${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
          city: 'Jaipur',
          district: 'Jaipur',
          state: 'Rajasthan',
          pincode: '302001',
        },
      })
    }
  }

  console.log('Seed complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
