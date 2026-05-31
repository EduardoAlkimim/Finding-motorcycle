const { PrismaClient } = require('@prisma/client')
const { emitirParaTodos } = require('./websocket.service')

const prisma      = new PrismaClient()
const RAIO_METROS = 100
const RAIO_LOJA   = 150

const LOJA = {
  lat: parseFloat(process.env.LOJA_LAT) || -15.7942,
  lng: parseFloat(process.env.LOJA_LNG) || -47.8825,
}

const verificarGeofences = async (posicao, moto, entrega) => {
  // ── Paradas pendentes ──────────────────────────────
  const paradasPendentes = entrega.locais.filter((el) => el.status === 'PENDENTE')

  for (const parada of paradasPendentes) {
    const distancia = calcularDistancia(
      posicao.latitude, posicao.longitude,
      parada.local.lat,  parada.local.lng
    )

    if (distancia <= RAIO_METROS) {
      await prisma.entregaLocal.update({
        where: { id: parada.id },
        data:  { status: 'CHEGOU', chegouEm: new Date(posicao.fixTime) },
      })

      console.log(`📍 ${moto.apelido} chegou em "${parada.local.nome}"`)

      emitirParaTodos('chegada_local', {
        motoId:    moto.id,
        apelido:   moto.apelido,
        entregaId: entrega.id,
        local:     parada.local.nome,
        chegouEm:  posicao.fixTime,
      })
    }
  }

  // ── Saída de locais onde já estava ────────────────
  const paradasChegou = entrega.locais.filter((el) => el.status === 'CHEGOU')

  for (const parada of paradasChegou) {
    const distancia = calcularDistancia(
      posicao.latitude, posicao.longitude,
      parada.local.lat,  parada.local.lng
    )
    if (distancia > RAIO_METROS * 2) {
      await prisma.entregaLocal.update({
        where: { id: parada.id },
        data:  { saiuEm: new Date(posicao.fixTime) },
      })
    }
  }

  // ── Retorno à loja (status VOLTANDO_LOJA) ─────────
  if (entrega.status === 'VOLTANDO_LOJA') {
    const distLoja = calcularDistancia(
      posicao.latitude, posicao.longitude,
      LOJA.lat, LOJA.lng
    )

    if (distLoja <= RAIO_LOJA) {
      console.log(`🏪 ${moto.apelido} chegou na loja — finalizando entrega ${entrega.id}`)

      // Calcula km de retorno
      const posRetorno = entrega.retornoIniciadoEm
        ? await prisma.posicao.findMany({
            where:   { motoId: moto.id, registradoEm: { gte: entrega.retornoIniciadoEm } },
            orderBy: { registradoEm: 'asc' },
          })
        : []

      const kmRetorno = calcularKmTrajeto(posRetorno)
      const kmTotal   = parseFloat(((entrega.kmRealizado || 0) + kmRetorno).toFixed(2))

      await prisma.entrega.update({
        where: { id: entrega.id },
        data:  {
          status:       'FINALIZADA',
          finalizadoEm: new Date(),
          kmRetorno,
          kmTotal,
        },
      })

      emitirParaTodos('entrega_finalizada', {
        entregaId: entrega.id,
        motoId:    moto.id,
        kmRetorno,
        kmTotal,
        automatico: true,
      })
    }
  }
}

function calcularDistancia(lat1, lng1, lat2, lng2) {
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
    total += calcularDistancia(
      posicoes[i - 1].lat, posicoes[i - 1].lng,
      posicoes[i].lat,     posicoes[i].lng
    )
  }
  return parseFloat((total / 1000).toFixed(2))
}

module.exports = { verificarGeofences }
