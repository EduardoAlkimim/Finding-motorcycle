const WebSocket = require('ws')

let wss = null

// Inicia o servidor WebSocket junto com o HTTP server
const iniciarWebSocketClientes = (server) => {
  wss = new WebSocket.Server({ server, path: '/ws' })

  wss.on('connection', (ws) => {
    console.log('🔗 Frontend conectado via WebSocket')
    ws.on('close', () => console.log('🔌 Frontend desconectado'))
  })

  console.log('✅ WebSocket server iniciado em /ws')
}

// Emite um evento para todos os frontends conectados
const emitirParaTodos = (evento, dados) => {
  if (!wss) return

  const mensagem = JSON.stringify({ evento, dados })

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(mensagem)
    }
  })
}

module.exports = { iniciarWebSocketClientes, emitirParaTodos }
