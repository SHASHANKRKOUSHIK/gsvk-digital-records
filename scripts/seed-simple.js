#!/usr/bin/env node
/**
 * Simple JS seed - no TypeScript needed
 * Usage: node scripts/seed-simple.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding users...')

  await prisma.user.upsert({
    where: { email: 'admin@gsvk.edu.in' },
    update: {},
    create: { email: 'admin@gsvk.edu.in', name: 'Super Admin', role: 'SUPER_ADMIN' },
  })

  await prisma.user.upsert({
    where: { email: 'operator@gsvk.edu.in' },
    update: {},
    create: { email: 'operator@gsvk.edu.in', name: 'Data Entry Operator', role: 'DATA_ENTRY_OPERATOR' },
  })

  console.log('Seeding sample students...')

  const samples = [
    { name: 'Aarav Sharma',  cls: '5',  year: '2024-25', adm: 'ADM-2024-0001', gender: 'MALE' },
    { name: 'Priya Patel',   cls: '3',  year: '2024-25', adm: 'ADM-2024-0002', gender: 'FEMALE' },
    { name: 'Rohan Singh',   cls: '8',  year: '2023-24', adm: 'ADM-2023-0001', gender: 'MALE' },
    { name: 'Anjali Gupta',  cls: '10', year: '2022-23', adm: 'ADM-2022-0001', gender: 'FEMALE' },
    { name: 'Vikram Reddy',  cls: '1',  year: '2021-22', adm: 'ADM-2021-0001', gender: 'MALE' },
    { name: 'Sneha Sharma',  cls: '7',  year: '2020-21', adm: 'ADM-2020-0001', gender: 'FEMALE' },
    { name: 'Arjun Patel',   cls: '9',  year: '2019-20', adm: 'ADM-2019-0001', gender: 'MALE' },
    { name: 'Kavya Reddy',   cls: '6',  year: '2018-19', adm: 'ADM-2018-0001', gender: 'FEMALE' },
  ]

  for (const s of samples) {
    try {
      const student = await prisma.student.upsert({
        where: { admissionNumber: s.adm },
        update: {},
        create: {
          admissionNumber: s.adm,
          admissionDate: new Date(),
          studentName: s.name,
          gender: s.gender,
          dateOfBirth: new Date('2012-06-15'),
          bloodGroup: 'O_POS',
          className: s.cls,
          section: 'A',
          academicYear: s.year,
          religion: 'Hindu',
        },
      })

      const existing = await prisma.parent.findFirst({ where: { studentId: student.id } })
      if (!existing) {
        const last = s.name.split(' ')[1]
        await prisma.parent.create({
          data: {
            studentId: student.id,
            fatherName: `Ramesh ${last}`,
            motherName: `Sunita ${last}`,
            phone: `9876500${String(samples.indexOf(s)).padStart(3,'0')}`,
            city: 'Jaipur',
            district: 'Jaipur',
            state: 'Rajasthan',
            pincode: '302001',
          },
        })
      }
      console.log(`  ✓ ${s.name}`)
    } catch (e) {
      console.log(`  skip ${s.name}: ${e.message}`)
    }
  }

  console.log('\n✅ Seed complete!')
  console.log('Now create your admin user in Supabase Auth with email: admin@gsvk.edu.in')
}

main().catch(console.error).finally(() => prisma.$disconnect())
