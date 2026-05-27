const { PrismaClient } = require('@prisma/client')
const { emitirParaTodos } = require('./websocket.service')

const prisma      = new PrismaClient()
const RAIO_METROS = 100  // considera "chegou" quando está a menos de 100m do local

const verificarGeofences = async (posicao, moto, entrega) => {
  const paradasPendentes = entrega.locais.filter((el) => el.status === 'PENDENTE')

  for (const parada of paradasPendentes) {
    const distancia = calcularDistancia(
      posicao.latitude, posicao.longitude,
      parada.local.lat,  parada.local.lng
    )

    if (distancia <= RAIO_METROS) {
      // ✅ Moto chegou no local — registra automaticamente
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

  // Detecta saída de local onde já estava
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

module.exports = { verificarGeofences }
