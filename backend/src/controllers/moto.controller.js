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

// GET /api/motos/:id/viagens?data=2024-01-15
const viagens = async (req, res) => {
  try {
    const data   = req.query.data || new Date().toISOString().split('T')[0]
    const inicio = new Date(`${data}T00:00:00`)
    const fim    = new Date(`${data}T23:59:59`)

    const posicoes = await prisma.posicao.findMany({
      where:   { motoId: req.params.id, registradoEm: { gte: inicio, lte: fim } },
      orderBy: { registradoEm: 'asc' },
      select:  { lat: true, lng: true, velocidade: true, registradoEm: true, entregaId: true },
    })

    if (posicoes.length === 0) return res.json([])

    const PAUSA_MS = 5 * 60 * 1000 // 5 minutos
    const grupos = []
    let grupo = [posicoes[0]]

    for (let i = 1; i < posicoes.length; i++) {
      const diff = new Date(posicoes[i].registradoEm) - new Date(posicoes[i - 1].registradoEm)
      if (diff > PAUSA_MS) {
        grupos.push(grupo)
        grupo = []
      }
      grupo.push(posicoes[i])
    }
    grupos.push(grupo)

    // Busca entregas do dia pra vincular
    const entregas = await prisma.entrega.findMany({
      where:   { motoId: req.params.id, saidaEm: { gte: inicio, lte: fim } },
      select:  { id: true, notaFiscal: true, status: true, saidaEm: true, chegadaEm: true },
    })

    const resultado = grupos.map((pts, i) => {
      const inicioViagem = new Date(pts[0].registradoEm)
      const fimViagem    = new Date(pts[pts.length - 1].registradoEm)

      // Calcula km do trajeto
      let km = 0
      for (let j = 1; j < pts.length; j++) {
        km += calcularDistanciaKm(pts[j - 1].lat, pts[j - 1].lng, pts[j].lat, pts[j].lng)
      }

      // Vincula entrega que ocorreu durante essa viagem
      const entregaVinculada = entregas.find(e => {
        const s = e.saidaEm ? new Date(e.saidaEm) : null
        const c = e.chegadaEm ? new Date(e.chegadaEm) : fimViagem
        return s && s >= inicioViagem && s <= fimViagem
      }) || null

      return {
        id:       i + 1,
        inicio:   pts[0].registradoEm,
        fim:      pts[pts.length - 1].registradoEm,
        km:       parseFloat(km.toFixed(2)),
        pontos:   pts.map(p => ({ lat: p.lat, lng: p.lng })),
        entrega:  entregaVinculada,
      }
    })

    return res.json(resultado)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao buscar viagens' })
  }
}

function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
  const R    = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

module.exports = { listar, criar, atualizar, ultimaPosicao, trajeto, posicoesLive, viagens }
