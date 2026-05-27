const jwt = require('jsonwebtoken')

// Verifica se o token JWT é válido
const autenticar = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = payload  // { id, nome, email, perfil, motoId }
    next()
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado' })
  }
}

// Verifica se o usuário tem o perfil necessário
const autorizar = (...perfis) => {
  return (req, res, next) => {
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Acesso negado para este perfil' })
    }
    next()
  }
}

module.exports = { autenticar, autorizar }
