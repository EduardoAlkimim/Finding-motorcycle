const { PrismaClient } = require('@prisma/client')
const { emitirParaTodos } = require('./websocket.service')

const prisma = new PrismaClient()

// Gera alertas automáticos ao finalizar uma entrega
const gerarAlertas = async (entrega) => {
  if (!entrega.kmPrevisto || !entrega.kmRealizado) return

  const desvio = ((entrega.kmRealizado - entrega.kmPrevisto) / entrega.kmPrevisto) * 100

  // Alerta se rodou mais de 40% acima do previsto
  if (desvio > 40) {
    const alerta = await prisma.alerta.create({
      data: {
        tipo: 'DESVIO_ROTA',
        descricao: `${entrega.moto?.apelido || 'Moto'} rodou ${Math.round(desvio)}% acima do previsto na ${entrega.notaFiscal} (${entrega.kmRealizado.toFixed(1)}km vs ${entrega.kmPrevisto.toFixed(1)}km)`,
        entregaId: entrega.id,
      },
    })
    emitirParaTodos('novo_alerta', alerta)
  }
}

module.exports = { gerarAlertas }
