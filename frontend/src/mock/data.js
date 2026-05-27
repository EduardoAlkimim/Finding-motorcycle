export const USUARIOS = [
  { id: '1', nome: 'Ricardo Admin', email: 'admin@autopecas.com', perfil: 'ADMIN' },
  { id: '2', nome: 'João Despachante', email: 'despachante@autopecas.com', perfil: 'DESPACHANTE' },
  { id: '3', nome: 'Carlos Silva', email: 'moto1@autopecas.com', perfil: 'MOTOQUEIRO', motoId: 'm1' },
  { id: '4', nome: 'Marcos Oliveira', email: 'moto2@autopecas.com', perfil: 'MOTOQUEIRO', motoId: 'm2' },
];

export const MOTOS = [
  { id: 'm1', placa: 'ABC1D23', apelido: 'Moto 01', cor: '#185FA5', motoqueiroId: '3', motoqueiro: 'Carlos Silva' },
  { id: 'm2', placa: 'XYZ9W87', apelido: 'Moto 02', cor: '#0F6E56', motoqueiroId: '4', motoqueiro: 'Marcos Oliveira' },
];

export const LOCAIS = [
  { id: 'l1', nome: 'Oficina Central',       endereco: 'Av. Principal, 100',   lat: -15.7720, lng: -47.8620 },
  { id: 'l2', nome: 'Auto Mecânica Silva',   endereco: 'Rua das Flores, 250',  lat: -15.7880, lng: -47.8550 },
  { id: 'l3', nome: 'Garagem Irmãos Costa',  endereco: 'Quadra 15, Bloco B',   lat: -15.8100, lng: -47.9000 },
  { id: 'l4', nome: 'Oficina Irmãos Lima',   endereco: 'Rua do Comércio, 44',  lat: -15.7980, lng: -47.8820 },
  { id: 'l5', nome: 'Auto Peças Zé',         endereco: 'SIA Trecho 3, Lote 7', lat: -15.7750, lng: -47.8800 },
  { id: 'l6', nome: 'Mecânica Boa Vista',    endereco: 'Rua B, Nº 22',         lat: -15.8020, lng: -47.8700 },
  { id: 'l7', nome: 'Borracharia Rápida',    endereco: 'Av. Leste, 500',       lat: -15.7850, lng: -47.9100 },
];

export const LOJA = { lat: -15.7942, lng: -47.8825, nome: 'AutoPeças Central' };

export const ENTREGAS = [
  {
    id: 'e1', notaFiscal: 'NF-2024-001', status: 'CONCLUIDA',
    motoId: 'm1', motoqueiroId: '3', atendenteId: '2',
    kmPrevisto: 8.4, kmRealizado: 8.9,
    saidaEm: '2026-05-25T08:10:00', chegadaEm: '2026-05-25T09:05:00',
    locais: [
      { id: 'el1', localId: 'l1', ordem: 1, status: 'CONFIRMADO', chegouEm: '08:34', saiuEm: '08:41' },
      { id: 'el2', localId: 'l5', ordem: 2, status: 'CONFIRMADO', chegouEm: '08:58', saiuEm: '09:04' },
    ]
  },
  {
    id: 'e2', notaFiscal: 'NF-2024-002', status: 'EM_ROTA',
    motoId: 'm1', motoqueiroId: '3', atendenteId: '2',
    kmPrevisto: 10.0, kmRealizado: null,
    saidaEm: '2026-05-25T09:20:00', chegadaEm: null,
    locais: [
      { id: 'el3', localId: 'l2', ordem: 1, status: 'CONFIRMADO', chegouEm: '09:44', saiuEm: '09:51' },
      { id: 'el4', localId: 'l4', ordem: 2, status: 'CHEGOU',     chegouEm: '10:08', saiuEm: null },
      { id: 'el5', localId: 'l6', ordem: 3, status: 'PENDENTE',   chegouEm: null,    saiuEm: null },
    ]
  },
  {
    id: 'e3', notaFiscal: 'NF-2024-003', status: 'CONCLUIDA',
    motoId: 'm2', motoqueiroId: '4', atendenteId: '2',
    kmPrevisto: 7.2, kmRealizado: 7.0,
    saidaEm: '2026-05-25T08:00:00', chegadaEm: '2026-05-25T08:52:00',
    locais: [
      { id: 'el6', localId: 'l3', ordem: 1, status: 'CONFIRMADO', chegouEm: '08:28', saiuEm: '08:34' },
      { id: 'el7', localId: 'l7', ordem: 2, status: 'CONFIRMADO', chegouEm: '08:47', saiuEm: '08:51' },
    ]
  },
  {
    id: 'e4', notaFiscal: 'NF-2024-004', status: 'EM_ROTA',
    motoId: 'm2', motoqueiroId: '4', atendenteId: '2',
    kmPrevisto: 6.9, kmRealizado: null,
    saidaEm: '2026-05-25T09:10:00', chegadaEm: null,
    locais: [
      { id: 'el8', localId: 'l4', ordem: 1, status: 'CHEGOU',   chegouEm: '09:34', saiuEm: null },
      { id: 'el9', localId: 'l6', ordem: 2, status: 'PENDENTE', chegouEm: null,    saiuEm: null },
    ]
  },
  {
    id: 'e5', notaFiscal: 'NF-2024-005', status: 'PENDENTE',
    motoId: null, motoqueiroId: null, atendenteId: '2',
    kmPrevisto: null, kmRealizado: null,
    saidaEm: null, chegadaEm: null,
    locais: [
      { id: 'el10', localId: 'l1', ordem: 1, status: 'PENDENTE', chegouEm: null, saiuEm: null },
      { id: 'el11', localId: 'l7', ordem: 2, status: 'PENDENTE', chegouEm: null, saiuEm: null },
    ]
  },
];

export const ALERTAS = [
  { id: 'a1', tipo: 'DESVIO_ROTA',         descricao: 'Moto 01 rodou 2,8km acima do previsto na NF-2024-002', lido: false, criadoEm: '2026-05-25T10:02:00' },
  { id: 'a2', tipo: 'CONFIRMACAO_SEM_GPS', descricao: 'Confirmação sem GPS detectada — NF-2024-003, local Garagem Irmãos Costa', lido: false, criadoEm: '2026-05-25T08:35:00' },
];

export const POSICOES_LIVE = {
  'm1': { lat: -15.7900, lng: -47.8700, velocidade: 32, ignicao: true },
  'm2': { lat: -15.8050, lng: -47.8850, velocidade: 0,  ignicao: true },
};

// Trajetos simulados (percurso real já feito)
export const TRAJETOS_MOCK = {
  'm1': [
    { lat: -15.7942, lng: -47.8825 },
    { lat: -15.7930, lng: -47.8790 },
    { lat: -15.7910, lng: -47.8760 },
    { lat: -15.7880, lng: -47.8550 }, // l2 - CONFIRMADO
    { lat: -15.7930, lng: -47.8620 },
    { lat: -15.7960, lng: -47.8700 },
    { lat: -15.7980, lng: -47.8820 }, // l4 - CHEGOU
  ],
  'm2': [
    { lat: -15.7942, lng: -47.8825 },
    { lat: -15.7970, lng: -47.8870 },
    { lat: -15.8010, lng: -47.8920 },
    { lat: -15.8100, lng: -47.9000 }, // l3 - CONFIRMADO
    { lat: -15.8090, lng: -47.9050 },
    { lat: -15.8050, lng: -47.8850 }, // posição atual
  ],
};

// Rota ideal planejada pelo despachante (loja → todos os destinos)
export const ROTA_IDEAL_MOCK = {
  'e2': [
    { lat: -15.7942, lng: -47.8825 },
    { lat: -15.7920, lng: -47.8740 },
    { lat: -15.7900, lng: -47.8640 },
    { lat: -15.7880, lng: -47.8550 }, // l2
    { lat: -15.7920, lng: -47.8650 },
    { lat: -15.7960, lng: -47.8740 },
    { lat: -15.7980, lng: -47.8820 }, // l4
    { lat: -15.8000, lng: -47.8780 },
    { lat: -15.8020, lng: -47.8700 }, // l6
  ],
  'e4': [
    { lat: -15.7942, lng: -47.8825 },
    { lat: -15.7960, lng: -47.8823 },
    { lat: -15.7970, lng: -47.8822 },
    { lat: -15.7980, lng: -47.8820 }, // l4
    { lat: -15.8000, lng: -47.8780 },
    { lat: -15.8020, lng: -47.8700 }, // l6
  ],
};

export const CREDENCIAIS = {
  'admin@autopecas.com':        { senha: '123456', usuarioId: '1' },
  'despachante@autopecas.com':  { senha: '123456', usuarioId: '2' },
  'moto1@autopecas.com':        { senha: '123456', usuarioId: '3' },
  'moto2@autopecas.com':        { senha: '123456', usuarioId: '4' },
};