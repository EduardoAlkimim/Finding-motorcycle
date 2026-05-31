const BASE = import.meta.env.VITE_API_URL || '';

async function req(path, options = {}) {
  const token = localStorage.getItem('ap_token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.erro || `HTTP ${res.status}`);
  }
  return res.json();
}

export const auth = {
  login: (email, senha) =>
    req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
};

export const motos = {
  listar:                ()          => req('/api/motos'),
  posicoesLive:          ()          => req('/api/motos/posicoes-live'),
  ultimaPosicao:         (id)        => req(`/api/motos/${id}/posicao`),
  trajeto:               (id, data)  => req(`/api/motos/${id}/trajeto?data=${data}`),
  viagens:               (id, data)  => req(`/api/motos/${id}/viagens?data=${data}`),
  viagensNaoAutorizadas: (id, data)  => req(`/api/motos/${id}/viagens-nao-autorizadas?data=${data}`),
  kmNaoAutorizado:       (id, data)  => req(`/api/motos/${id}/km-nao-autorizado?data=${data}`),
  criar:                 (dados)     => req('/api/motos', { method: 'POST', body: JSON.stringify(dados) }),
  atualizar:             (id, dados) => req(`/api/motos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
};

export const entregas = {
  listar: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req(`/api/entregas${qs ? `?${qs}` : ''}`);
  },
  buscar:         (id)    => req(`/api/entregas/${id}`),
  criar:          (dados) => req('/api/entregas', { method: 'POST', body: JSON.stringify(dados) }),
  iniciar:        (id)    => req(`/api/entregas/${id}/iniciar`,  { method: 'PATCH' }),
  concluir:       (id)    => req(`/api/entregas/${id}/concluir`, { method: 'PATCH' }),
  iniciarRetorno: (id)    => req(`/api/entregas/${id}/retorno`,  { method: 'PATCH' }),
  finalizar:      (id)    => req(`/api/entregas/${id}/finalizar`,{ method: 'PATCH' }),
  deletar:        (id)    => req(`/api/entregas/${id}`,          { method: 'DELETE' }),
  confirmarLocal: (localEntregaId) =>
    req(`/api/entregas/parada/${localEntregaId}/confirmar`, { method: 'PATCH' }),
};

export const locais = {
  listar:    ()          => req('/api/locais'),
  buscar:    (id)        => req(`/api/locais/${id}`),
  criar:     (dados)     => req('/api/locais', { method: 'POST', body: JSON.stringify(dados) }),
  atualizar: (id, dados) => req(`/api/locais/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  remover:   (id)        => req(`/api/locais/${id}`, { method: 'DELETE' }),
};

export const alertas = {
  listar:     ()   => req('/api/alertas'),
  marcarLido: (id) => req(`/api/alertas/${id}/lido`, { method: 'PATCH' }),
};

export const relatorios = {
  resumo: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req(`/api/relatorios/dashboard${qs ? `?${qs}` : ''}`);
  },
};

export const usuarios = {
  listar: () => req('/api/usuarios'),
};

export function criarWebSocket(onMensagem) {
  const wsBase = (import.meta.env.VITE_API_URL || window.location.origin)
    .replace(/^https/, 'wss')
    .replace(/^http/, 'ws');

  const token = localStorage.getItem('ap_token');
  const ws = new WebSocket(`${wsBase}/ws?token=${token || ''}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      onMensagem(msg);
    } catch (_) {}
  };

  ws.onerror = (err) => console.warn('WS erro:', err);

  return ws;
}
