const { PrismaClient } = require('@prisma/client')
const { z } = require('zod')

const prisma = new PrismaClient()

const motoSchema = z.object({
  placa:        z.string().min(7, 'Placa inválida'),
  apelido:      z.string().min(1),
  cor:          z.string().optional(),
  traccarId:    z.number().optional(),
  motoqueiroId: z.string().uuid().optional(),
})

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

const trajeto = async (req, res) => {
  try {
    const data   = req.query.data || new Date().toISOString().split('T')[0]
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
// Retorna viagens COM entrega vinculada
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

    const PAUSA_MS = 5 * 60 * 1000
    const grupos = segmentarViagens(posicoes, PAUSA_MS)

    const entregas = await prisma.entrega.findMany({
      where:  { motoId: req.params.id, saidaEm: { gte: inicio, lte: fim } },
      select: { id: true, notaFiscal: true, status: true, saidaEm: true, chegadaEm: true, retornoIniciadoEm: true, finalizadoEm: true },
    })

    const resultado = grupos.map((pts, i) => {
      const inicioV = new Date(pts[0].registradoEm)
      const fimV    = new Date(pts[pts.length - 1].registradoEm)
      const km      = calcularKmGrupo(pts)

      // Verifica se algum ponto tem entregaId
      const entregaIdNoPonto = pts.find(p => p.entregaId)?.entregaId

      const entregaVinculada = entregas.find(e => {
        if (entregaIdNoPonto && e.id === entregaIdNoPonto) return true
        const s = e.saidaEm ? new Date(e.saidaEm) : null
        const c = e.finalizadoEm ? new Date(e.finalizadoEm) : (e.chegadaEm ? new Date(e.chegadaEm) : fimV)
        return s && s <= fimV && c >= inicioV
      }) || null

      return {
        id:          i + 1,
        inicio:      pts[0].registradoEm,
        fim:         pts[pts.length - 1].registradoEm,
        km:          parseFloat(km.toFixed(2)),
        pontos:      pts.map(p => ({ lat: p.lat, lng: p.lng })),
        entrega:     entregaVinculada,
        autorizada:  entregaVinculada !== null,
      }
    })

    return res.json(resultado)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao buscar viagens' })
  }
}

// GET /api/motos/:id/viagens-nao-autorizadas?data=2024-01-15
// Retorna viagens SEM entrega vinculada (uso não autorizado)
const viagensNaoAutorizadas = async (req, res) => {
  try {
    const data   = req.query.data || new Date().toISOString().split('T')[0]
    const inicio = new Date(`${data}T00:00:00`)
    const fim    = new Date(`${data}T23:59:59`)

    // Só posições SEM entrega vinculada e com velocidade > 0
    const posicoes = await prisma.posicao.findMany({
      where:   {
        motoId:    req.params.id,
        entregaId: null,
        registradoEm: { gte: inicio, lte: fim },
        velocidade: { gt: 2 }, // ignora posições paradas
      },
      orderBy: { registradoEm: 'asc' },
      select:  { lat: true, lng: true, velocidade: true, registradoEm: true },
    })

    if (posicoes.length === 0) return res.json([])

    const PAUSA_MS = 5 * 60 * 1000
    const grupos = segmentarViagens(posicoes, PAUSA_MS)

    const resultado = grupos
      .map((pts, i) => {
        const km = calcularKmGrupo(pts)
        if (km < 0.1) return null // ignora deslocamentos mínimos
        return {
          id:      i + 1,
          inicio:  pts[0].registradoEm,
          fim:     pts[pts.length - 1].registradoEm,
          km:      parseFloat(km.toFixed(2)),
          pontos:  pts.map(p => ({ lat: p.lat, lng: p.lng })),
          autorizada: false,
        }
      })
      .filter(Boolean)

    return res.json(resultado)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao buscar viagens não autorizadas' })
  }
}

// GET /api/motos/:id/km-nao-autorizado?data=2024-01-15
// Retorna total de km não autorizado no dia
const kmNaoAutorizado = async (req, res) => {
  try {
    const data   = req.query.data || new Date().toISOString().split('T')[0]
    const inicio = new Date(`${data}T00:00:00`)
    const fim    = new Date(`${data}T23:59:59`)

    const posicoes = await prisma.posicao.findMany({
      where:   {
        motoId:    req.params.id,
        entregaId: null,
        registradoEm: { gte: inicio, lte: fim },
        velocidade: { gt: 2 },
      },
      orderBy: { registradoEm: 'asc' },
      select:  { lat: true, lng: true, registradoEm: true },
    })

    let kmTotal = 0
    for (let i = 1; i < posicoes.length; i++) {
      const diff = new Date(posicoes[i].registradoEm) - new Date(posicoes[i - 1].registradoEm)
      if (diff < 5 * 60 * 1000) {
        kmTotal += calcularDistanciaKm(posicoes[i-1].lat, posicoes[i-1].lng, posicoes[i].lat, posicoes[i].lng)
      }
    }

    return res.json({ km: parseFloat(kmTotal.toFixed(2)) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao calcular km não autorizado' })
  }
}

// ─── Helpers ─────────────────────────────────────────

function segmentarViagens(posicoes, pausaMs) {
  const grupos = []
  let grupo = [posicoes[0]]
  for (let i = 1; i < posicoes.length; i++) {
    const diff = new Date(posicoes[i].registradoEm) - new Date(posicoes[i - 1].registradoEm)
    if (diff > pausaMs) { grupos.push(grupo); grupo = [] }
    grupo.push(posicoes[i])
  }
  grupos.push(grupo)
  return grupos
}

function calcularKmGrupo(pts) {
  let km = 0
  for (let j = 1; j < pts.length; j++) {
    km += calcularDistanciaKm(pts[j-1].lat, pts[j-1].lng, pts[j].lat, pts[j].lng)
  }
  return km
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

module.exports = { listar, criar, atualizar, ultimaPosicao, trajeto, posicoesLive, viagens, viagensNaoAutorizadas, kmNaoAutorizado }
