const WebSocket = require('ws')
const axios = require('axios')
const { PrismaClient } = require('@prisma/client')

const { emitirParaTodos } = require('./websocket.service')
const { verificarGeofences } = require('./geofence.service')

const prisma = new PrismaClient()

let tentativas = 0

const iniciarWebSocketTraccar = async () => {
  try {
    const baseUrl = process.env.TRACCAR_URL || 'http://localhost:8082'

    console.log('🔌 Autenticando no Traccar...')

    // FORM DATA LOGIN
    const params = new URLSearchParams()

    params.append('email', process.env.TRACCAR_USER)
    params.append('password', process.env.TRACCAR_PASSWORD)

    // LOGIN NO TRACCAR
    const response = await axios.post(
      `${baseUrl}/api/session`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        withCredentials: true,
      }
    )

    // PEGA COOKIE DA SESSÃO
    const cookies = response.headers['set-cookie']

    if (!cookies || cookies.length === 0) {
      throw new Error('Cookie de sessão não retornado pelo Traccar')
    }

    // CONVERTE HTTP -> WS
    const wsUrl = baseUrl.startsWith('https')
      ? baseUrl.replace('https://', 'wss://')
      : baseUrl.replace('http://', 'ws://')

    console.log('🔌 Conectando ao socket Traccar...')

    // CONEXÃO WEBSOCKET
    const ws = new WebSocket(`${wsUrl}/api/socket`, {
      headers: {
        Cookie: cookies.join('; '),
      },
    })

    ws.on('open', () => {
      tentativas = 0
      console.log('✅ Traccar conectado')
    })

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString())

        // POSIÇÕES RECEBIDAS
        if (msg.positions?.length > 0) {
          for (const pos of msg.positions) {
            await processarPosicao(pos)
          }
        }
      } catch (err) {
        console.error('❌ Erro ao processar mensagem Traccar:', err.message)
      }
    })

    ws.on('close', () => {
      tentativas++

      const delay = Math.min(tentativas * 5000, 30000)

      console.log(
        `⚠️ Traccar desconectado. Reconectando em ${delay / 1000}s...`
      )

      setTimeout(iniciarWebSocketTraccar, delay)
    })

    ws.on('error', (err) => {
      console.error('❌ Erro Traccar:', err.message)
    })

  } catch (err) {
    console.error(
      '❌ Erro autenticando/conectando no Traccar:',
      err.response?.data || err.message
    )

    setTimeout(iniciarWebSocketTraccar, 10000)
  }
}

const processarPosicao = async (pos) => {
  try {
    // BUSCA MOTO PELO ID DO TRACCAR
    const moto = await prisma.moto.findUnique({
      where: {
        traccarId: pos.deviceId,
      },
    })

    if (!moto) return

    // ENTREGA ATIVA
    const entregaAtiva = await prisma.entrega.findFirst({
      where: {
        motoId: moto.id,
        status: 'EM_ROTA',
      },
      include: {
        locais: {
          include: {
            local: true,
          },
        },
      },
    })

    // SALVA POSIÇÃO NO BANCO
    await prisma.posicao.create({
      data: {
        lat: pos.latitude,
        lng: pos.longitude,
        velocidade: pos.speed || 0,
        ignicao: pos.attributes?.ignition || false,
        motoId: moto.id,
        entregaId: entregaAtiva?.id || null,
        registradoEm: new Date(pos.fixTime),
      },
    })

    // VERIFICA GEOFENCES
    if (entregaAtiva) {
      await verificarGeofences(pos, moto, entregaAtiva)
    }

    // ENVIA POSIÇÃO AO FRONTEND
    emitirParaTodos('posicao_moto', {
      motoId: moto.id,
      apelido: moto.apelido,
      cor: moto.cor,
      lat: pos.latitude,
      lng: pos.longitude,
      velocidade: pos.speed || 0,
      ignicao: pos.attributes?.ignition || false,
      entregaId: entregaAtiva?.id || null,
      timestamp: pos.fixTime,
    })

  } catch (err) {
    console.error('❌ Erro ao processar posição:', err.message)
  }
}

module.exports = {
  iniciarWebSocketTraccar,
}