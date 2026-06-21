const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'shashankrkoushik21@gmail.com' },
    update: {},
    create: {
      email: 'shashankrkoushik21@gmail.com',
      name: 'Shashank',
      role: 'SUPER_ADMIN',
      active: true,
    },
  })
  console.log('Created/found user:', user)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())