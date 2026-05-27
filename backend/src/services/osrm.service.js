const axios = require('axios')

const LOJA = {
  lat: parseFloat(process.env.LOJA_LAT) || -15.7942,
  lng: parseFloat(process.env.LOJA_LNG) || -47.8825,
}

// Calcula KM da rota: loja → locais → loja usando OSRM (gratuito)
const calcularKmPrevisto = async (locais) => {
  try {
    if (!locais || locais.length === 0) return 0

    const pontos = [LOJA, ...locais.map((l) => ({ lat: l.lat, lng: l.lng })), LOJA]
    const coords = pontos.map((p) => `${p.lng},${p.lat}`).join(';')
    const url    = `${process.env.OSRM_URL || 'https://router.project-osrm.org'}/route/v1/driving/${coords}?overview=false`

    const { data } = await axios.get(url, { timeout: 5000 })

    if (data.code === 'Ok' && data.routes[0]) {
      return parseFloat((data.routes[0].distance / 1000).toFixed(2))
    }
    return 0
  } catch (err) {
    // OSRM indisponível não bloqueia a criação da entrega
    console.warn('OSRM indisponível:', err.message)
    return 0
  }
}

module.exports = { calcularKmPrevisto, LOJA }
