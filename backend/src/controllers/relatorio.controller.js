const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// GET /api/relatorios/dashboard?data=2024-01-15
const dashboardDia = async (req, res) => {
  try {
    const data   = req.query.data || new Date().toISOString().split('T')[0]
    const inicio = new Date(`${data}T00:00:00`)
    const fim    = new Date(`${data}T23:59:59`)

    const [entregas, motoqueiros, alertasNaoLidos] = await Promise.all([
      prisma.entrega.findMany({
        where: { criadoEm: { gte: inicio, lte: fim } },
        include: {
          motoqueiro: { select: { id: true, nome: true } },
          moto:       { select: { id: true, placa: true, apelido: true, cor: true } },
          locais:     { include: { local: true }, orderBy: { ordem: 'asc' } },
          alertas:    true,
        },
      }),
      prisma.usuario.findMany({
        where: { perfil: 'MOTOQUEIRO', ativo: true },
        select: { id: true, nome: true, moto: { select: { id: true, apelido: true, cor: true } } },
      }),
      prisma.alerta.count({ where: { lido: false } }),
    ])

    const statusCount = entregas.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1
      return acc
    }, {})

    const kmTotal = {
      previsto:  entregas.reduce((s, e) => s + (e.kmPrevisto  || 0), 0).toFixed(1),
      realizado: entregas.reduce((s, e) => s + (e.kmRealizado || 0), 0).toFixed(1),
    }

    const porMotoqueiro = motoqueiros.map((m) => {
      const minhas = entregas.filter((e) => e.motoqueiroId === m.id)
      return {
        motoqueiro:    m,
        totalEntregas: minhas.length,
        concluidas:    minhas.filter((e) => e.status === 'CONCLUIDA').length,
        emRota:        minhas.filter((e) => e.status === 'EM_ROTA').length,
        kmPrevisto:    minhas.reduce((s, e) => s + (e.kmPrevisto  || 0), 0).toFixed(1),
        kmRealizado:   minhas.reduce((s, e) => s + (e.kmRealizado || 0), 0).toFixed(1),
      }
    })

    return res.json({
      data,
      resumo: { totalEntregas: entregas.length, statusCount, kmTotal, alertasNaoLidos },
      porMotoqueiro,
      entregas,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao gerar dashboard' })
  }
}

// GET /api/relatorios/motoqueiro?motoqueiroId=X&dataInicio=Y&dataFim=Z
const porMotoqueiro = async (req, res) => {
  try {
    const { motoqueiroId, dataInicio, dataFim } = req.query
    if (!motoqueiroId || !dataInicio || !dataFim) {
      return res.status(400).json({ erro: 'Informe motoqueiroId, dataInicio e dataFim' })
    }

    const inicio = new Date(`${dataInicio}T00:00:00`)
    const fim    = new Date(`${dataFim}T23:59:59`)

    const entregas = await prisma.entrega.findMany({
      where: { motoqueiroId, criadoEm: { gte: inicio, lte: fim } },
      include: {
        motoqueiro: { select: { id: true, nome: true } },
        moto:       { select: { placa: true, apelido: true } },
        locais:     { include: { local: true }, orderBy: { ordem: 'asc' } },
        alertas:    true,
      },
      orderBy: { criadoEm: 'asc' },
    })

    const kmPrevisto  = entregas.reduce((s, e) => s + (e.kmPrevisto  || 0), 0)
    const kmRealizado = entregas.reduce((s, e) => s + (e.kmRealizado || 0), 0)

    const locaisVisitados = entregas.flatMap((e) =>
      e.locais.map((el) => ({
        entregaId:   e.id,
        notaFiscal:  e.notaFiscal,
        local:       el.local.nome,
        endereco:    el.local.endereco,
        status:      el.status,
        chegouEm:    el.chegouEm,
        saiuEm:      el.saiuEm,
        confirmadoEm: el.confirmadoEm,
      }))
    )

    return res.json({
      motoqueiro: entregas[0]?.motoqueiro || null,
      periodo:    { inicio: dataInicio, fim: dataFim },
      resumo: {
        totalEntregas: entregas.length,
        concluidas:    entregas.filter((e) => e.status === 'CONCLUIDA').length,
        kmPrevisto:    kmPrevisto.toFixed(1),
        kmRealizado:   kmRealizado.toFixed(1),
        desvioKm:      (kmRealizado - kmPrevisto).toFixed(1),
        totalAlertas:  entregas.reduce((s, e) => s + e.alertas.length, 0),
      },
      entregas,
      locaisVisitados,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ erro: 'Erro ao gerar relatório' })
  }
}

// GET /api/relatorios/km?dataInicio=Y&dataFim=Z
const kmPorPeriodo = async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query
    const inicio = new Date(`${dataInicio}T00:00:00`)
    const fim    = new Date(`${dataFim}T23:59:59`)

    const resultado = await prisma.entrega.groupBy({
      by:    ['motoqueiroId'],
      where: { criadoEm: { gte: inicio, lte: fim }, status: 'CONCLUIDA' },
      _sum:   { kmPrevisto: true, kmRealizado: true },
      _count: { id: true },
    })

    const motoqueiros = await prisma.usuario.findMany({
      where:  { id: { in: resultado.map((r) => r.motoqueiroId) } },
      select: { id: true, nome: true },
    })

    const dados = resultado.map((r) => {
      const m = motoqueiros.find((u) => u.id === r.motoqueiroId)
      return {
        motoqueiro:    m,
        totalEntregas: r._count.id,
        kmPrevisto:    (r._sum.kmPrevisto  || 0).toFixed(1),
        kmRealizado:   (r._sum.kmRealizado || 0).toFixed(1),
        desvio:        ((r._sum.kmRealizado || 0) - (r._sum.kmPrevisto || 0)).toFixed(1),
      }
    })

    return res.json(dados)
  } catch {
    return res.status(500).json({ erro: 'Erro ao calcular KM' })
  }
}

module.exports = { dashboardDia, porMotoqueiro, kmPorPeriodo }
