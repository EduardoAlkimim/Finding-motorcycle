const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const { z }    = require('zod')

const prisma = new PrismaClient()

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(4, 'Senha muito curta'),
})

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, senha } = loginSchema.parse(req.body)

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { moto: { select: { id: true, placa: true, apelido: true, cor: true } } },
    })

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Credenciais inválidas' })
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha)
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas' })
    }

    const token = jwt.sign(
      {
        id:     usuario.id,
        nome:   usuario.nome,
        email:  usuario.email,
        perfil: usuario.perfil,
        motoId: usuario.moto?.id || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    )

    return res.json({
      token,
      usuario: {
        id:     usuario.id,
        nome:   usuario.nome,
        email:  usuario.email,
        perfil: usuario.perfil,
        moto:   usuario.moto,
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ erro: err.errors[0].message })
    }
    console.error('Erro no login:', err)
    return res.status(500).json({ erro: 'Erro interno' })
  }
}

// GET /api/auth/me
const me = async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: {
        id: true, nome: true, email: true, perfil: true,
        moto: { select: { id: true, placa: true, apelido: true, cor: true } },
      },
    })
    return res.json(usuario)
  } catch {
    return res.status(500).json({ erro: 'Erro interno' })
  }
}

module.exports = { login, me }
