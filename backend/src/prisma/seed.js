const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.log('⚠️  ADMIN_EMAIL e ADMIN_PASSWORD não definidos no .env — pulando seed.')
    return
  }

  const senha = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)

  await prisma.usuario.upsert({
    where: { email: process.env.ADMIN_EMAIL },
    update: {},
    create: {
      nome: process.env.ADMIN_NOME || 'Admin',
      email: process.env.ADMIN_EMAIL,
      senha,
      perfil: 'ADMIN',
    },
  })

  console.log('✅ Seed concluído!')
  console.log(`👤 Admin: ${process.env.ADMIN_EMAIL}`)
}

main()
  .catch((e) => { console.error('❌ Erro no seed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())