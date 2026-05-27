const { PrismaClient } = require('@prisma/client')
const { z } = require('zod')

const prisma = new PrismaClient()

const localSchema = z.object({
  nome:     z.string().min(2),
  endereco: z.string().min(5),
  lat:      z.number(),
  lng:      z.number(),
})

// GET /api/locais
const listar = async (req, res) => {
  try {
    const locais = await prisma.local.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    })
    return res.json(locais)
  } catch {
    return res.status(500).json({ erro: 'Erro ao listar locais' })
  }
}

// POST /api/locais
const criar = async (req, res) => {
  try {
    const dados = localSchema.parse(req.body)
    const local = await prisma.local.create({ data: dados })
    return res.status(201).json(local)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ erro: err.errors[0].message })
    return res.status(500).json({ erro: 'Erro ao criar local' })
  }
}

// PUT /api/locais/:id
const atualizar = async (req, res) => {
  try {
    const local = await prisma.local.update({
      where: { id: req.params.id },
      data: req.body,
    })
    return res.json(local)
  } catch {
    return res.status(500).json({ erro: 'Erro ao atualizar local' })
  }
}

// DELETE /api/locais/:id
const remover = async (req, res) => {
  try {
    await prisma.local.update({ where: { id: req.params.id }, data: { ativo: false } })
    return res.json({ mensagem: 'Local removido' })
  } catch {
    return res.status(500).json({ erro: 'Erro ao remover local' })
  }
}

module.exports = { listar, criar, atualizar, remover }
