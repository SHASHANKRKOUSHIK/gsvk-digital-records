#!/usr/bin/env node
/**
 * Seeds sample historical student records (1999-2026)
 * Usage: node scripts/seed-historical.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const firstNames = ['Aarav','Priya','Rohan','Anjali','Vikram','Sunita','Rahul','Pooja','Amit','Kavya','Sanjay','Deepa','Arjun','Meera','Suresh','Radha','Nikhil','Anita','Ajay','Shweta','Ravi','Neha','Manoj','Divya','Rajesh','Sneha','Arun','Rekha','Vikas','Preeti']
const lastNames = ['Sharma','Patel','Singh','Gupta','Reddy','Verma','Mehta','Joshi','Shah','Nair','Pillai','Kumar','Mishra','Tiwari','Yadav','Pandey','Rastogi','Agarwal','Srivastava','Chauhan']
const cities = ['Jaipur','Ajmer','Jodhpur','Udaipur','Kota','Bikaner','Sikar','Alwar','Bharatpur','Bhilwara']
const bloodGroups = ['A_POS','A_NEG','B_POS','B_NEG','AB_POS','AB_NEG','O_POS','O_NEG']
const religions = ['Hindu','Muslim','Christian','Sikh','Jain','Buddhist']
const classes = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10']

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function phone() { return `9${Math.floor(Math.random() * 900000000) + 100000000}` }
function randDob(admYear) {
  const year = parseInt(admYear.split('-')[0]) - 5 - Math.floor(Math.random() * 7)
  const month = Math.floor(Math.random() * 12) + 1
  const day = Math.floor(Math.random() * 28) + 1
  return new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`)
}

async function main() {
  console.log('Seeding historical records...')
  let count = 0

  for (let year = 1999; year <= 2026; year++) {
    const academicYear = `${year}-${String(year + 1).slice(2)}`
    const admissionsThisYear = Math.floor(Math.random() * 40) + 10

    for (let i = 0; i < admissionsThisYear; i++) {
      const firstName = pick(firstNames)
      const lastName = pick(lastNames)
      const fatherFirst = pick(firstNames)
      const admNum = `ADM-${year}-${String(count + 1).padStart(4, '0')}`

      try {
        const student = await prisma.student.create({
          data: {
            admissionNumber: admNum,
            admissionDate: new Date(`${year}-06-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`),
            studentName: `${firstName} ${lastName}`,
            gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
            dateOfBirth: randDob(academicYear),
            bloodGroup: pick(bloodGroups),
            className: pick(classes),
            section: pick(['A', 'B', 'C']),
            academicYear,
            religion: pick(religions),
            caste: pick(['General', 'OBC', 'SC', 'ST']),
            parents: {
              create: [{
                fatherName: `${fatherFirst} ${lastName}`,
                motherName: `${pick(firstNames)} ${lastName}`,
                phone: phone(),
                alternatePhone: Math.random() > 0.5 ? phone() : null,
                address: `${Math.floor(Math.random() * 999) + 1}, ${pick(['Gandhi Nagar', 'Shastri Colony', 'Nehru Road', 'MG Road', 'Civil Lines'])}`,
                city: pick(cities),
                district: pick(cities),
                state: 'Rajasthan',
                pincode: `30${Math.floor(Math.random() * 9000) + 1000}`,
              }],
            },
          },
        })
        count++
        if (count % 50 === 0) console.log(`  Created ${count} records...`)
      } catch (e) {
        // Skip duplicates
      }
    }
  }

  console.log(`✅ Done! Created ${count} historical student records.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
