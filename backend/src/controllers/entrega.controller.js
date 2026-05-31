const { PrismaClient } = require('@prisma/client')
const { z } = require('zod')
const { calcularKmPrevisto, LOJA } = require('../services/osrm.service')
const { emitirParaTodos }          = require('../services/websocket.service')
const { gerarAlertas }             = require('../services/alerta.service')

const prisma = new PrismaClient()

const criarSchema = z.object({
  notaFiscal:   z.string().min(1, 'Nota fiscal obrigatória'),
  motoqueiroId: z.string().uuid().optional(),
  motoId:       z.string().uuid().optional(),
  locaisIds:    z.array(z.string().uuid()).min(1, 'Selecione ao menos um destino'),
  observacoes:  z.string().optional(),
})

const INCLUDE_COMPLETO = {
  despachante: { select: { id: true, nome: true } },
  motoqueiro:  { select: { id: true, nome: true } },
  moto:        { select: { id: true, placa: true, apelido: true, cor: true } },
  locais: {
    include: { local: true },
    orderBy: { ordem: 'asc' },
  },
  alertas: true,
}

// GET /api/entregas
const listar = async (req, res) => {
  try {
    const { data, motoqueiroId, status } = req.query
    const where = {}

    if (data) {
      const inicio = new Date(`${data}T00:00:00`)
      const fim    = new Date(`${data}T23:59:59`)
      where.criadoEm = { gte: inicio, lte: fim }
    }

    if (motoqueiroId) where.motoqueiroId = motoqueiroId
    if (status)       where.status       = status

    if (req.usuario.perfil === 'MOTOQUEIRO') {
      where.motoqueiroId = req.usuario.id
    }

    const entregas = await prisma.entrega.findMany({
      where,
      include: INCLUDE_COMPLETO,
      orderBy: { criadoEm: 'desc' },
    })
    return res.json(entregas)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao listar entregas' })
  }
}

// GET /api/entregas/:id
const buscarUm = async (req, res) => {
  try {
    const entrega = await prisma.entrega.findUnique({
      where: { id: req.params.id },
      include: INCLUDE_COMPLETO,
    })
    if (!entrega) return res.status(404).json({ erro: 'Entrega não encontrada' })
    return res.json(entrega)
  } catch {
    return res.status(500).json({ erro: 'Erro ao buscar entrega' })
  }
}

// POST /api/entregas
const criar = async (req, res) => {
  try {
    const dados = criarSchema.parse(req.body)

    const locais = await prisma.local.findMany({ where: { id: { in: dados.locaisIds } } })
    const kmPrevisto = await calcularKmPrevisto(locais)

    // Calcula km de retorno (último local → loja)
    const ultimoLocal = locais[locais.length - 1]
    const kmRetornoPrevisto = ultimoLocal
      ? await calcularKmPrevisto([ultimoLocal], true)
      : 0

    const entrega = await prisma.entrega.create({
      data: {
        notaFiscal:          dados.notaFiscal,
        observacoes:         dados.observacoes,
        despachanteId:       req.usuario.id,
        motoqueiroId:        dados.motoqueiroId || null,
        motoId:              dados.motoId || null,
        kmPrevisto,
        kmRetornoPrevisto,
        locais: {
          create: dados.locaisIds.map((localId, index) => ({
            localId,
            ordem: index + 1,
          })),
        },
      },
      include: INCLUDE_COMPLETO,
    })

    emitirParaTodos('nova_entrega', entrega)
    return res.status(201).json(entrega)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ erro: err.errors[0].message })
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao criar entrega' })
  }
}

// PATCH /api/entregas/:id/iniciar
const iniciar = async (req, res) => {
  try {
    const entrega = await prisma.entrega.update({
      where: { id: req.params.id },
      data:  { status: 'EM_ROTA', saidaEm: new Date() },
      include: INCLUDE_COMPLETO,
    })
    emitirParaTodos('entrega_iniciada', { entregaId: entrega.id, motoId: entrega.motoId })
    return res.json(entrega)
  } catch {
    return res.status(500).json({ erro: 'Erro ao iniciar entrega' })
  }
}

// PATCH /api/entregas/:id/concluir — todas as paradas feitas, começa retorno
const concluir = async (req, res) => {
  try {
    // Calcula km realizado nas entregas
    const posicoes = await prisma.posicao.findMany({
      where:   { entregaId: req.params.id },
      orderBy: { registradoEm: 'asc' },
    })
    const kmRealizado = calcularKmTrajeto(posicoes)

    const entrega = await prisma.entrega.update({
      where: { id: req.params.id },
      data:  {
        status:      'CONCLUIDA',
        chegadaEm:   new Date(),
        kmRealizado,
      },
      include: INCLUDE_COMPLETO,
    })

    await gerarAlertas(entrega)
    emitirParaTodos('entrega_concluida', entrega)
    return res.json(entrega)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao concluir entrega' })
  }
}

// PATCH /api/entregas/:id/retorno — motoqueiro saiu para voltar à loja
const iniciarRetorno = async (req, res) => {
  try {
    const atual = await prisma.entrega.findUnique({ where: { id: req.params.id } })
    if (!atual) return res.status(404).json({ erro: 'Entrega não encontrada' })
    if (atual.status !== 'CONCLUIDA') return res.status(400).json({ erro: 'Entrega precisa estar CONCLUIDA para iniciar retorno' })

    const entrega = await prisma.entrega.update({
      where: { id: req.params.id },
      data:  { status: 'VOLTANDO_LOJA', retornoIniciadoEm: new Date() },
      include: INCLUDE_COMPLETO,
    })

    emitirParaTodos('retorno_iniciado', { entregaId: entrega.id, motoId: entrega.motoId })
    return res.json(entrega)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao iniciar retorno' })
  }
}

// PATCH /api/entregas/:id/finalizar — motoqueiro chegou na loja
const finalizar = async (req, res) => {
  try {
    const atual = await prisma.entrega.findUnique({ where: { id: req.params.id } })
    if (!atual) return res.status(404).json({ erro: 'Entrega não encontrada' })

    // Calcula km do retorno (posições após retornoIniciadoEm)
    const posRetorno = atual.retornoIniciadoEm
      ? await prisma.posicao.findMany({
          where:   { motoId: atual.motoId, registradoEm: { gte: atual.retornoIniciadoEm } },
          orderBy: { registradoEm: 'asc' },
        })
      : []

    const kmRetorno = calcularKmTrajeto(posRetorno)
    const kmTotal   = parseFloat(((atual.kmRealizado || 0) + kmRetorno).toFixed(2))

    const entrega = await prisma.entrega.update({
      where: { id: req.params.id },
      data:  {
        status:       'FINALIZADA',
        finalizadoEm: new Date(),
        kmRetorno,
        kmTotal,
      },
      include: INCLUDE_COMPLETO,
    })

    emitirParaTodos('entrega_finalizada', entrega)
    return res.json(entrega)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao finalizar entrega' })
  }
}

// PATCH /api/entregas/parada/:entregaLocalId/confirmar
const confirmarParada = async (req, res) => {
  try {
    const { entregaLocalId } = req.params

    const entregaLocal = await prisma.entregaLocal.findUnique({
      where: { id: entregaLocalId },
      include: {
        local:   true,
        entrega: { include: { moto: true } },
      },
    })
    if (!entregaLocal) return res.status(404).json({ erro: 'Parada não encontrada' })

    const ultimaPos = await prisma.posicao.findFirst({
      where:   { motoId: entregaLocal.entrega.motoId },
      orderBy: { registradoEm: 'desc' },
    })

    let statusFinal = 'CONFIRMADO'

    if (ultimaPos) {
      const distancia = calcularDistanciaMetros(
        ultimaPos.lat, ultimaPos.lng,
        entregaLocal.local.lat, entregaLocal.local.lng
      )
      if (distancia > 300) {
        statusFinal = 'PROBLEMA'
        await prisma.alerta.create({
          data: {
            tipo:      'CONFIRMACAO_SEM_GPS',
            descricao: `Motoqueiro confirmou em "${entregaLocal.local.nome}" mas GPS estava a ${Math.round(distancia)}m`,
            entregaId: entregaLocal.entregaId,
          },
        })
        emitirParaTodos('novo_alerta', { tipo: 'CONFIRMACAO_SEM_GPS', local: entregaLocal.local.nome })
      }
    }

    const atualizado = await prisma.entregaLocal.update({
      where: { id: entregaLocalId },
      data: {
        status:       statusFinal,
        confirmadoEm: new Date(),
        chegouEm:     entregaLocal.chegouEm || new Date(),
      },
      include: { local: true },
    })

    emitirParaTodos('parada_confirmada', atualizado)
    return res.json(atualizado)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao confirmar parada' })
  }
}

// PATCH /api/entregas/:id/editar — edita entrega PENDENTE (moto, NF, destinos)
const editar = async (req, res) => {
  try {
    const entrega = await prisma.entrega.findUnique({ where: { id: req.params.id } })
    if (!entrega) return res.status(404).json({ erro: 'Entrega não encontrada' })
    if (entrega.status !== 'PENDENTE') {
      return res.status(400).json({ erro: 'Apenas entregas PENDENTE podem ser editadas' })
    }

    const { notaFiscal, motoId, locaisIds } = req.body

    if (!notaFiscal?.trim()) return res.status(400).json({ erro: 'Nota fiscal obrigatória' })
    if (!motoId)             return res.status(400).json({ erro: 'Moto obrigatória' })
    if (!locaisIds?.length)  return res.status(400).json({ erro: 'Selecione ao menos um destino' })

    // Recalcula km previsto com os novos locais
    const locais = await prisma.local.findMany({ where: { id: { in: locaisIds } } })
    const kmPrevisto = await calcularKmPrevisto(locais)
    const ultimoLocal = locais[locais.length - 1]
    const kmRetornoPrevisto = ultimoLocal
      ? await calcularKmPrevisto([ultimoLocal], true)
      : 0

    // Remove paradas antigas e cria novas
    await prisma.entregaLocal.deleteMany({ where: { entregaId: req.params.id } })

    const atualizada = await prisma.entrega.update({
      where: { id: req.params.id },
      data: {
        notaFiscal: notaFiscal.trim(),
        motoId,
        kmPrevisto,
        kmRetornoPrevisto,
        locais: {
          create: locaisIds.map((localId, index) => ({
            localId,
            ordem: index + 1,
          })),
        },
      },
      include: INCLUDE_COMPLETO,
    })

    emitirParaTodos('entrega_editada', atualizada)
    return res.json(atualizada)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao editar entrega' })
  }
}

// DELETE /api/entregas/:id
const deletar = async (req, res) => {
  try {
    const entrega = await prisma.entrega.findUnique({ where: { id: req.params.id } })
    if (!entrega) return res.status(404).json({ erro: 'Entrega não encontrada' })
    if (entrega.status === 'EM_ROTA' || entrega.status === 'VOLTANDO_LOJA') {
      return res.status(400).json({ erro: 'Não é possível deletar entrega em andamento' })
    }
    await prisma.entrega.delete({ where: { id: req.params.id } })
    return res.json({ mensagem: 'Entrega removida' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao deletar entrega' })
  }
}

// ─── Helpers ──────────────────────────────────────────

function calcularDistanciaMetros(lat1, lng1, lat2, lng2) {
  const R    = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calcularKmTrajeto(posicoes) {
  let total = 0
  for (let i = 1; i < posicoes.length; i++) {
    total += calcularDistanciaMetros(
      posicoes[i - 1].lat, posicoes[i - 1].lng,
      posicoes[i].lat,     posicoes[i].lng
    )
  }
  return parseFloat((total / 1000).toFixed(2))
}

module.exports = { listar, buscarUm, criar, iniciar, concluir, iniciarRetorno, finalizar, confirmarParada, editar, deletar }
