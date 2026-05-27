const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// GET /api/alertas
const listar = async (req, res) => {
  try {
    const alertas = await prisma.alerta.findMany({
      where:   { lido: false },
      include: {
        entrega: {
          select: {
            notaFiscal: true,
            motoqueiro: { select: { nome: true } },
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    })
    return res.json(alertas)
  } catch {
    return res.status(500).json({ erro: 'Erro ao listar alertas' })
  }
}

// PATCH /api/alertas/:id/ler
const marcarLido = async (req, res) => {
  try {
    await prisma.alerta.update({ where: { id: req.params.id }, data: { lido: true } })
    return res.json({ mensagem: 'Alerta marcado como lido' })
  } catch {
    return res.status(500).json({ erro: 'Erro ao atualizar alerta' })
  }
}

// PATCH /api/alertas/ler-todos
const marcarTodosLidos = async (req, res) => {
  try {
    await prisma.alerta.updateMany({ where: { lido: false }, data: { lido: true } })
    return res.json({ mensagem: 'Todos os alertas marcados como lidos' })
  } catch {
    return res.status(500).json({ erro: 'Erro ao atualizar alertas' })
  }
}

module.exports = { listar, marcarLido, marcarTodosLidos }
