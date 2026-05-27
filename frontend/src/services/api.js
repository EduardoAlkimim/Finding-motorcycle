// ─── Base URL ─────────────────────────────────────────────────────────────────
// Em desenvolvimento: proxy do Vite redireciona /api → localhost:3000
// Em produção: troca VITE_API_URL pelo IP/domínio do servidor
const BASE = import.meta.env.VITE_API_URL || '';

// ─── Helper de fetch autenticado ──────────────────────────────────────────────
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

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login: (email, senha) =>
    req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
};

// ─── Motos ────────────────────────────────────────────────────────────────────
export const motos = {
  listar:        ()     => req('/api/motos'),
  posicoesLive:  ()     => req('/api/motos/posicoes-live'),
  ultimaPosicao: (id)   => req(`/api/motos/${id}/posicao`),
  trajeto:       (id, data) => req(`/api/motos/${id}/trajeto?data=${data}`),
  criar:         (dados) => req('/api/motos', { method: 'POST', body: JSON.stringify(dados) }),
  atualizar:     (id, dados) => req(`/api/motos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
};

// ─── Entregas ─────────────────────────────────────────────────────────────────
export const entregas = {
  listar:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req(`/api/entregas${qs ? `?${qs}` : ''}`);
  },
  buscar:   (id)    => req(`/api/entregas/${id}`),
  criar:    (dados) => req('/api/entregas', { method: 'POST', body: JSON.stringify(dados) }),
  iniciar:  (id)    => req(`/api/entregas/${id}/iniciar`, { method: 'PATCH' }),
  concluir: (id)    => req(`/api/entregas/${id}/concluir`, { method: 'PATCH' }),
  confirmarLocal: (id, localEntregaId) =>
    req(`/api/entregas/${id}/locais/${localEntregaId}/confirmar`, { method: 'PATCH' }),
};

// ─── Locais ───────────────────────────────────────────────────────────────────
export const locais = {
  listar: () => req('/api/locais'),
  criar:  (dados) => req('/api/locais', { method: 'POST', body: JSON.stringify(dados) }),
};

// ─── Alertas ──────────────────────────────────────────────────────────────────
export const alertas = {
  listar: () => req('/api/alertas'),
  marcarLido: (id) => req(`/api/alertas/${id}/lido`, { method: 'PATCH' }),
};

// ─── Relatórios ───────────────────────────────────────────────────────────────
export const relatorios = {
  resumo: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req(`/api/relatorios/resumo${qs ? `?${qs}` : ''}`);
  },
};

// ─── Usuários ─────────────────────────────────────────────────────────────────
export const usuarios = {
  listar: () => req('/api/usuarios'),
};

// ─── WebSocket ao vivo (posições das motos) ───────────────────────────────────
export function criarWebSocket(onMensagem) {
  const wsBase = (import.meta.env.VITE_API_URL || window.location.origin)
    .replace(/^https/, 'wss')
    .replace(/^http/, 'ws');

  const token = localStorage.getItem('ap_token');
  const ws = new WebSocket(`${wsBase}?token=${token || ''}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      onMensagem(msg);
    } catch (_) {}
  };

  ws.onerror = (err) => console.warn('WS erro:', err);

  return ws;
}