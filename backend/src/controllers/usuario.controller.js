const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const { z } = require('zod')

const prisma = new PrismaClient()

const criarSchema = z.object({
  nome:   z.string().min(2, 'Nome muito curto'),
  email:  z.string().email('Email inválido'),
  senha:  z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  perfil: z.enum(['ADMIN', 'DESPACHANTE', 'MOTOQUEIRO']),
})

// GET /api/usuarios
const listar = async (req, res) => {
  try {
    const { perfil } = req.query
    const where = { ativo: true }
    if (perfil) where.perfil = perfil

    const usuarios = await prisma.usuario.findMany({
      where,
      select: {
        id: true, nome: true, email: true, perfil: true, criadoEm: true,
        moto: { select: { id: true, placa: true, apelido: true } },
      },
      orderBy: { nome: 'asc' },
    })
    return res.json(usuarios)
  } catch {
    return res.status(500).json({ erro: 'Erro ao listar usuários' })
  }
}

// POST /api/usuarios
const criar = async (req, res) => {
  try {
    const dados = criarSchema.parse(req.body)

    const existe = await prisma.usuario.findUnique({ where: { email: dados.email } })
    if (existe) return res.status(400).json({ erro: 'Email já cadastrado' })

    const hash = await bcrypt.hash(dados.senha, 10)
    const usuario = await prisma.usuario.create({
      data: { ...dados, senha: hash },
      select: { id: true, nome: true, email: true, perfil: true },
    })
    return res.status(201).json(usuario)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ erro: err.errors[0].message })
    return res.status(500).json({ erro: 'Erro ao criar usuário' })
  }
}

// PUT /api/usuarios/:id
const atualizar = async (req, res) => {
  try {
    const { nome, email, senha } = req.body
    const dados = {}
    if (nome)  dados.nome  = nome
    if (email) dados.email = email
    if (senha) dados.senha = await bcrypt.hash(senha, 10)

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data: dados,
      select: { id: true, nome: true, email: true, perfil: true },
    })
    return res.json(usuario)
  } catch {
    return res.status(500).json({ erro: 'Erro ao atualizar usuário' })
  }
}

// DELETE /api/usuarios/:id
const desativar = async (req, res) => {
  try {
    await prisma.usuario.update({ where: { id: req.params.id }, data: { ativo: false } })
    return res.json({ mensagem: 'Usuário desativado' })
  } catch {
    return res.status(500).json({ erro: 'Erro ao desativar usuário' })
  }
}

module.exports = { listar, criar, atualizar, desativar }
