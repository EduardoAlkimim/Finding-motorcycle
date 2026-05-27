const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  const senha = await bcrypt.hash('123456', 10)

  // ─── Usuários ───────────────────────────────────────
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@autopecas.com' },
    update: {},
    create: { nome: 'Ricardo Admin', email: 'admin@autopecas.com', senha, perfil: 'ADMIN' },
  })

  const despachante = await prisma.usuario.upsert({
    where: { email: 'despachante@autopecas.com' },
    update: {},
    create: { nome: 'João Despachante', email: 'despachante@autopecas.com', senha, perfil: 'DESPACHANTE' },
  })

  const carlos = await prisma.usuario.upsert({
    where: { email: 'moto1@autopecas.com' },
    update: {},
    create: { nome: 'Carlos Moto', email: 'moto1@autopecas.com', senha, perfil: 'MOTOQUEIRO' },
  })

  const pedro = await prisma.usuario.upsert({
    where: { email: 'moto2@autopecas.com' },
    update: {},
    create: { nome: 'Pedro Moto', email: 'moto2@autopecas.com', senha, perfil: 'MOTOQUEIRO' },
  })

  // ─── Motos ──────────────────────────────────────────
  const moto1 = await prisma.moto.upsert({
    where: { placa: 'ABC1D23' },
    update: {},
    create: { placa: 'ABC1D23', apelido: 'Moto 01', cor: '#185FA5', motoqueiroId: carlos.id },
  })

  const moto2 = await prisma.moto.upsert({
    where: { placa: 'XYZ9W87' },
    update: {},
    create: { placa: 'XYZ9W87', apelido: 'Moto 02', cor: '#0F6E56', motoqueiroId: pedro.id },
  })

  // ─── Locais ─────────────────────────────────────────
  const locais = await Promise.all([
    prisma.local.create({ data: { nome: 'Oficina Central',     endereco: 'Av. Principal, 100',   lat: -15.7720, lng: -47.8620 } }),
    prisma.local.create({ data: { nome: 'Auto Mecânica Silva', endereco: 'Rua das Flores, 250',  lat: -15.7880, lng: -47.8550 } }),
    prisma.local.create({ data: { nome: 'Garagem do Pedro',    endereco: 'Quadra 15, Bloco B',   lat: -15.8100, lng: -47.9000 } }),
    prisma.local.create({ data: { nome: 'Oficina Irmãos Lima', endereco: 'Rua do Comércio, 44',  lat: -15.7980, lng: -47.8820 } }),
    prisma.local.create({ data: { nome: 'Auto Peças Zé',       endereco: 'SIA Trecho 3, Lote 7', lat: -15.7750, lng: -47.8800 } }),
    prisma.local.create({ data: { nome: 'Mecânica Boa Vista',  endereco: 'Rua B, Nº 22',         lat: -15.8020, lng: -47.8700 } }),
    prisma.local.create({ data: { nome: 'Borracharia Rápida',  endereco: 'Av. Leste, 500',       lat: -15.7850, lng: -47.9100 } }),
  ])

  // ─── Entrega concluída ──────────────────────────────
  await prisma.entrega.create({
    data: {
      notaFiscal: 'NF-2024-001',
      status: 'CONCLUIDA',
      despachanteId: despachante.id,
      motoqueiroId: carlos.id,
      motoId: moto1.id,
      kmPrevisto: 8.4,
      kmRealizado: 8.9,
      saidaEm: new Date('2024-01-15T08:10:00'),
      chegadaEm: new Date('2024-01-15T09:05:00'),
      locais: {
        create: [
          { localId: locais[0].id, ordem: 1, status: 'CONFIRMADO', chegouEm: new Date('2024-01-15T08:34:00'), saiuEm: new Date('2024-01-15T08:41:00'), confirmadoEm: new Date('2024-01-15T08:40:00') },
          { localId: locais[4].id, ordem: 2, status: 'CONFIRMADO', chegouEm: new Date('2024-01-15T08:58:00'), saiuEm: new Date('2024-01-15T09:04:00'), confirmadoEm: new Date('2024-01-15T09:03:00') },
        ],
      },
    },
  })

  // ─── Entrega em rota ────────────────────────────────
  await prisma.entrega.create({
    data: {
      notaFiscal: 'NF-2024-002',
      status: 'EM_ROTA',
      despachanteId: despachante.id,
      motoqueiroId: carlos.id,
      motoId: moto1.id,
      kmPrevisto: 10.0,
      saidaEm: new Date(),
      locais: {
        create: [
          { localId: locais[1].id, ordem: 1, status: 'CONFIRMADO', chegouEm: new Date(), confirmadoEm: new Date() },
          { localId: locais[3].id, ordem: 2, status: 'CHEGOU',     chegouEm: new Date() },
          { localId: locais[5].id, ordem: 3, status: 'PENDENTE' },
        ],
      },
    },
  })

  // ─── Entrega pendente ───────────────────────────────
  await prisma.entrega.create({
    data: {
      notaFiscal: 'NF-2024-003',
      status: 'PENDENTE',
      despachanteId: despachante.id,
      locais: {
        create: [
          { localId: locais[2].id, ordem: 1, status: 'PENDENTE' },
          { localId: locais[6].id, ordem: 2, status: 'PENDENTE' },
        ],
      },
    },
  })

  // ─── Alertas ────────────────────────────────────────
  await prisma.alerta.createMany({
    data: [
      { tipo: 'DESVIO_ROTA',         descricao: 'Moto 01 rodou 2,8km acima do previsto na NF-2024-002', lido: false },
      { tipo: 'CONFIRMACAO_SEM_GPS', descricao: 'Confirmação sem GPS — NF-2024-001, Garagem do Pedro',   lido: false },
    ],
  })

  console.log('✅ Seed concluído!')
  console.log('─────────────────────────────────────')
  console.log('👤 Admin:        admin@autopecas.com       / 123456')
  console.log('👤 Despachante:  despachante@autopecas.com / 123456')
  console.log('🏍️  Motoqueiro 1: moto1@autopecas.com       / 123456')
  console.log('🏍️  Motoqueiro 2: moto2@autopecas.com       / 123456')
  console.log('─────────────────────────────────────')
}

main()
  .catch((e) => { console.error('❌ Erro no seed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
