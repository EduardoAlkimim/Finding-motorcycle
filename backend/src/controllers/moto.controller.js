const { PrismaClient } = require('@prisma/client')
const { z } = require('zod')

const prisma = new PrismaClient()

const motoSchema = z.object({
  placa:       z.string().min(7, 'Placa inválida'),
  apelido:     z.string().min(1),
  cor:         z.string().optional(),
  traccarId:   z.number().optional(),
  motoqueiroId: z.string().uuid().optional(),
})

// GET /api/motos
const listar = async (req, res) => {
  try {
    const motos = await prisma.moto.findMany({
      where: { ativo: true },
      include: { motoqueiro: { select: { id: true, nome: true, email: true } } },
      orderBy: { apelido: 'asc' },
    })
    return res.json(motos)
  } catch {
    return res.status(500).json({ erro: 'Erro ao listar motos' })
  }
}

// POST /api/motos
const criar = async (req, res) => {
  try {
    const dados = motoSchema.parse(req.body)
    const moto = await prisma.moto.create({
      data: dados,
      include: { motoqueiro: { select: { id: true, nome: true } } },
    })
    return res.status(201).json(moto)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ erro: err.errors[0].message })
    if (err.code === 'P2002') return res.status(400).json({ erro: 'Placa já cadastrada' })
    return res.status(500).json({ erro: 'Erro ao criar moto' })
  }
}

// PUT /api/motos/:id
const atualizar = async (req, res) => {
  try {
    const moto = await prisma.moto.update({
      where: { id: req.params.id },
      data: req.body,
      include: { motoqueiro: { select: { id: true, nome: true } } },
    })
    return res.json(moto)
  } catch {
    return res.status(500).json({ erro: 'Erro ao atualizar moto' })
  }
}

// GET /api/motos/:id/posicao — última posição conhecida
const ultimaPosicao = async (req, res) => {
  try {
    const posicao = await prisma.posicao.findFirst({
      where: { motoId: req.params.id },
      orderBy: { registradoEm: 'desc' },
    })
    return res.json(posicao || null)
  } catch {
    return res.status(500).json({ erro: 'Erro ao buscar posição' })
  }
}

// GET /api/motos/:id/trajeto?data=2024-01-15 — trajeto do dia
const trajeto = async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().split('T')[0]
    const inicio = new Date(`${data}T00:00:00`)
    const fim    = new Date(`${data}T23:59:59`)

    const posicoes = await prisma.posicao.findMany({
      where: { motoId: req.params.id, registradoEm: { gte: inicio, lte: fim } },
      orderBy: { registradoEm: 'asc' },
      select: { lat: true, lng: true, velocidade: true, ignicao: true, registradoEm: true },
    })
    return res.json(posicoes)
  } catch {
    return res.status(500).json({ erro: 'Erro ao buscar trajeto' })
  }
}

// GET /api/motos/posicoes-live — última posição de todas as motos
const posicoesLive = async (req, res) => {
  try {
    const motos = await prisma.moto.findMany({ where: { ativo: true } })

    const resultado = await Promise.all(
      motos.map(async (moto) => {
        const pos = await prisma.posicao.findFirst({
          where: { motoId: moto.id },
          orderBy: { registradoEm: 'desc' },
        })
        return { moto, posicao: pos }
      })
    )
    return res.json(resultado)
  } catch {
    return res.status(500).json({ erro: 'Erro ao buscar posições' })
  }
}

module.exports = { listar, criar, atualizar, ultimaPosicao, trajeto, posicoesLive }
