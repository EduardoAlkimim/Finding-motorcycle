require('dotenv').config()
const express = require('express')
const cors = require('cors')
const http = require('http')

const authRoutes      = require('./routes/auth.routes')
const usuarioRoutes   = require('./routes/usuario.routes')
const motoRoutes      = require('./routes/moto.routes')
const localRoutes     = require('./routes/local.routes')
const entregaRoutes   = require('./routes/entrega.routes')
const relatorioRoutes = require('./routes/relatorio.routes')
const alertaRoutes    = require('./routes/alerta.routes')

const { iniciarWebSocketClientes } = require('./services/websocket.service')
const { iniciarWebSocketTraccar }  = require('./services/traccar.service')
const { PrismaClient } = require('@prisma/client')

const app    = express()
const server = http.createServer(app)
const prisma = new PrismaClient()

// ─── Middlewares globais ──────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

// ─── Rotas ────────────────────────────────────────────
app.use('/api/auth',       authRoutes)
app.use('/api/usuarios',   usuarioRoutes)
app.use('/api/motos',      motoRoutes)
app.use('/api/locais',     localRoutes)
app.use('/api/entregas',   entregaRoutes)
app.use('/api/relatorios', relatorioRoutes)
app.use('/api/alertas',    alertaRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── WebSocket para o frontend (mapa ao vivo) ─────────
iniciarWebSocketClientes(server)

// ─── Conecta ao Traccar em segundo plano ──────────────
if (process.env.NODE_ENV !== 'test') {
  iniciarWebSocketTraccar()
}

// ─── Sobe o servidor ──────────────────────────────────
const PORT = process.env.PORT || 3000
server.listen(PORT, async () => {
  try {
    await prisma.$connect()
    console.log('✅ PostgreSQL conectado')
  } catch (err) {
    console.error('❌ Erro ao conectar banco:', err.message)
  }
  console.log(`✅ Backend rodando em http://localhost:${PORT}`)
})
