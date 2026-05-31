import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import Layout from '../../components/shared/Layout';
import { ClipboardList, Map, Bell, Loader2, Route, Eye, EyeOff } from 'lucide-react';
import { motos as motosApi, entregas as entregasApi, criarWebSocket } from '../../services/api';

const NAV = [
  { href: '/despachante',         label: 'Entregas', icon: ClipboardList },
  { href: '/despachante/mapa',    label: 'Mapa',     icon: Map },
  { href: '/despachante/alertas', label: 'Alertas',  icon: Bell, badge: true },
];

const LOJA = {
  lat:  parseFloat(import.meta.env.VITE_LOJA_LAT  || '-15.7942'),
  lng:  parseFloat(import.meta.env.VITE_LOJA_LNG  || '-47.8825'),
  nome: import.meta.env.VITE_LOJA_NOME || 'AutoPeças Central',
};

const criarIconeMoto = (cor, apelido, velocidade, semEntrega) => L.divIcon({
  html: `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center">
      <div style="
        position:absolute;top:0;left:50%;transform:translate(-50%,-50%);
        width:44px;height:44px;border-radius:50%;
        background:${semEntrega ? 'rgba(156,163,175,0.25)' : `${cor}33`};
        animation:moto-pulse 2s ease-out infinite;
      "></div>
      <div style="
        position:relative;z-index:2;
        background:${semEntrega ? '#9ca3af' : cor};
        border:3px solid #fff;
        border-radius:50%;
        width:36px;height:36px;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 14px rgba(0,0,0,0.3);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
          <path d="M19 7h-1.5l-1.5-3H9L7.5 7H6a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h.17A3 3 0 0 0 9 17a3 3 0 0 0 2.83-2h.34A3 3 0 0 0 15 17a3 3 0 0 0 2.83-2H19a3 3 0 0 0 3-3v-2a3 3 0 0 0-3-3zm-10 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
        </svg>
      </div>
      <div style="
        position:relative;z-index:2;
        margin-top:4px;
        background:${semEntrega ? '#9ca3af' : cor};
        color:#fff;
        border-radius:10px;
        padding:3px 8px;
        font-size:10px;
        font-family:'DM Sans',sans-serif;
        font-weight:600;
        white-space:nowrap;
        border:2px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.2);
      ">${apelido}${velocidade != null ? ` · ${Math.round(velocidade)}km/h` : ''}</div>
    </div>
    <style>
      @keyframes moto-pulse {
        0%   { transform:translate(-50%,-50%) scale(0.8); opacity:0.8; }
        100% { transform:translate(-50%,-50%) scale(1.8); opacity:0; }
      }
    </style>
  `,
  className: '',
  iconAnchor: [18, 18],
});

const criarIconeLoja = () => L.divIcon({
  html: `<div style="background:#1f2937;color:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-family:'DM Sans',sans-serif;font-weight:600;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏪 Loja</div>`,
  className: '', iconAnchor: [30, 14],
});

const criarIconeLocal = (status) => L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${
    status === 'CONFIRMADO' ? '#16a34a' : status === 'CHEGOU' ? '#2563eb' : '#ef4444'
  };border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.3)"></div>`,
  className: '', iconAnchor: [7, 7],
});

function formatarHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function MapaControle() {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);
  return null;
}

export default function DespachanteMapa() {
  const [motos, setMotos]               = useState([]);
  const [posicoes, setPosicoes]         = useState({});
  const [entregasHoje, setEntregas]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [viagensPorMoto, setViagens]    = useState({});
  const [viagemAtiva, setViagemAtiva]   = useState(null);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [mapaKey]                       = useState(() => Date.now());
  const wsRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const [motosData, posicoesData, entregasData] = await Promise.all([
        motosApi.listar(),
        motosApi.posicoesLive(),
        entregasApi.listar({ data: hoje }),
      ]);
      setMotos(motosData);
      setEntregas(entregasData);

      const mapa = {};
      for (const item of posicoesData) {
        if (item.posicao) {
          mapa[item.moto.id] = {
            lat: item.posicao.lat, lng: item.posicao.lng,
            velocidade: item.posicao.velocidade, ignicao: item.posicao.ignicao,
          };
        }
      }
      setPosicoes(mapa);

      const viagensMap = {};
      await Promise.all(motosData.map(async (moto) => {
        try {
          const v = await motosApi.viagens(moto.id, hoje);
          viagensMap[moto.id] = v;
        } catch { viagensMap[moto.id] = []; }
      }));
      setViagens(viagensMap);
    } catch (err) {
      console.error('Erro ao carregar mapa:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    wsRef.current = criarWebSocket((msg) => {
      if (msg.evento === 'posicao_moto') {
        const d = msg.dados;
        setPosicoes(prev => ({
          ...prev,
          [d.motoId]: { lat: d.lat, lng: d.lng, velocidade: d.velocidade, ignicao: d.ignicao },
        }));
      }
    });
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [carregar]);

  const entregasEmRota = entregasHoje.filter(e => e.status === 'EM_ROTA');
  const locaisAtivos   = entregasHoje.flatMap(e =>
    (e.locais || []).map(el => ({ ...el.local, status: el.status }))
  );

  return (
    <Layout navItems={NAV}>
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Mapa ao vivo</h1>
          <p className="text-xs text-gray-400">{entregasEmRota.length} entrega{entregasEmRota.length !== 1 ? 's' : ''} em rota agora</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarHistorico(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${
              mostrarHistorico ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title="Histórico fora de rota"
          >
            {mostrarHistorico ? <Eye size={12} /> : <EyeOff size={12} />}
            Histórico
          </button>
          <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block"></span>
            GPS ativo
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-gray-400 gap-2 text-sm">
              <Loader2 size={16} className="animate-spin" /> Carregando dados…
            </div>
          ) : (
            <MapContainer key={mapaKey} center={[LOJA.lat, LOJA.lng]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={true}>
              <MapaControle />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                maxZoom={19}
              />

              <Marker position={[LOJA.lat, LOJA.lng]} icon={criarIconeLoja()}>
                <Popup><strong>🏪 {LOJA.nome}</strong><br />Ponto de origem</Popup>
              </Marker>

              {/* Trajetos EM ROTA — cor da moto, sólido */}
              {motos.map(moto => {
                const viagens = viagensPorMoto[moto.id] || [];
                return viagens
                  .filter(v => v.entrega && v.pontos?.length >= 2)
                  .map((v, i) => {
                    const isAtiva = viagemAtiva?.motoId === moto.id && viagemAtiva?.viagem?.id === v.id;
                    return (
                      <Polyline
                        key={`emrota-${moto.id}-${i}`}
                        positions={v.pontos.map(p => [p.lat, p.lng])}
                        pathOptions={{
                          color:   moto.cor || '#185FA5',
                          weight:  isAtiva ? 6 : 4,
                          opacity: isAtiva ? 1 : 0.85,
                        }}
                      />
                    );
                  });
              })}

              {/* Trajetos FORA DE ROTA — cinza, só com toggle ativo */}
              {mostrarHistorico && motos.map(moto => {
                const viagens = viagensPorMoto[moto.id] || [];
                return viagens
                  .filter(v => !v.entrega && v.pontos?.length >= 2)
                  .map((v, i) => (
                    <Polyline
                      key={`forarota-${moto.id}-${i}`}
                      positions={v.pontos.map(p => [p.lat, p.lng])}
                      pathOptions={{
                        color:     '#9ca3af',
                        weight:    2,
                        opacity:   0.5,
                        dashArray: '4,6',
                      }}
                    />
                  ));
              })}

              {/* Motos */}
              {motos.map(moto => {
                const pos = posicoes[moto.id];
                if (!pos) return null;
                const temEmRota = entregasHoje.some(e => e.motoId === moto.id && ['EM_ROTA','VOLTANDO_LOJA'].includes(e.status));
                return (
                  <Marker key={moto.id} position={[pos.lat, pos.lng]}
                    icon={criarIconeMoto(moto.cor || '#185FA5', moto.apelido, pos.velocidade, !temEmRota)}
                  >
                    <Popup>
                      <strong>{moto.apelido}</strong><br />
                      Placa: {moto.placa}<br />
                      Motoqueiro: {moto.motoqueiro?.nome || '—'}<br />
                      Velocidade: {pos.velocidade != null ? `${Math.round(pos.velocidade)} km/h` : '—'}<br />
                      {!temEmRota && <span style={{color:'#9ca3af'}}>Sem entrega ativa</span>}
                    </Popup>
                  </Marker>
                );
              })}

              {/* Locais das entregas */}
              {locaisAtivos.map((local, i) => local?.lat && (
                <Marker key={i} position={[local.lat, local.lng]} icon={criarIconeLocal(local.status)}>
                  <Popup>
                    <strong>{local.nome}</strong><br />{local.endereco}<br />Status: {local.status}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}

          {/* Legenda */}
          {!loading && (
            <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs space-y-1.5 z-[400]">
              <div className="font-semibold text-gray-700 mb-2">Legenda</div>
              {motos.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: m.cor || '#185FA5' }}></span>
                  <span className="text-gray-600">{m.apelido} · {m.motoqueiro?.nome?.split(' ')[0] || '—'}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-1.5 mt-1.5 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 inline-block" style={{borderTop:'3px solid #185FA5'}}></span>
                  <span className="text-gray-500">Em rota</span>
                </div>
                {mostrarHistorico && (
                  <div className="flex items-center gap-2">
                    <span className="w-6 inline-block" style={{borderTop:'2px dashed #9ca3af'}}></span>
                    <span className="text-gray-400">Fora de rota</span>
                  </div>
                )}
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span><span className="text-gray-500">Entregue</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span><span className="text-gray-500">Chegou</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span><span className="text-gray-500">Pendente</span></div>
              </div>
            </div>
          )}

          {/* Banner viagem ativa */}
          {viagemAtiva && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-white rounded-xl shadow-lg border border-brand-200 px-4 py-2 flex items-center gap-3 text-xs">
              <Route size={13} className="text-brand-500" />
              <span className="text-gray-700 font-medium">
                {viagemAtiva.viagem.km} km
                {viagemAtiva.viagem.entrega && ` · ${viagemAtiva.viagem.entrega.notaFiscal}`}
              </span>
              <button onClick={() => setViagemAtiva(null)} className="text-gray-400 hover:text-gray-600 ml-2">✕</button>
            </div>
          )}
        </div>

        {/* Sidebar viagens */}
        <div className="w-[220px] bg-white border-l border-gray-100 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Viagens do dia</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-gray-300" />
              </div>
            ) : motos.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">Nenhuma moto cadastrada</div>
            ) : (
              motos.map(moto => {
                const viagens = viagensPorMoto[moto.id] || [];
                return (
                  <div key={moto.id}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: moto.cor || '#185FA5' }}></span>
                      <span className="text-xs font-semibold text-gray-700">{moto.apelido}</span>
                      <span className="text-[9px] text-gray-400 ml-auto">{viagens.length} viagem{viagens.length !== 1 ? 's' : ''}</span>
                    </div>
                    {viagens.length === 0 ? (
                      <div className="text-[10px] text-gray-400 italic pl-3">Sem viagens hoje</div>
                    ) : (
                      <div className="space-y-1">
                        {viagens.map(v => {
                          const ativa = viagemAtiva?.motoId === moto.id && viagemAtiva?.viagem.id === v.id;
                          return (
                            <button
                              key={v.id}
                              onClick={() => setViagemAtiva(ativa ? null : { motoId: moto.id, viagem: v })}
                              className={`w-full text-left p-2 rounded-xl border transition-all ${
                                ativa ? 'border-brand-400 bg-brand-50' : 'border-gray-100 hover:border-gray-200'
                              }`}
                            >
                              <div className="flex justify-between text-[10px] font-medium text-gray-700">
                                <span>{formatarHora(v.inicio)} → {formatarHora(v.fim)}</span>
                                <span className="text-brand-600">{v.km}km</span>
                              </div>
                              {v.entrega ? (
                                <div className="flex items-center gap-1 text-[9px] text-gray-400 mt-0.5">
                                  <Route size={8} />
                                  <span className="font-mono">{v.entrega.notaFiscal}</span>
                                </div>
                              ) : (
                                <div className="text-[9px] text-gray-400 mt-0.5">Sem entrega</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

const NAV = [
  { href: '/despachante',         label: 'Entregas', icon: ClipboardList },
  { href: '/despachante/mapa',    label: 'Mapa',     icon: Map },
  { href: '/despachante/alertas', label: 'Alertas',  icon: Bell, badge: true },
];

const LOJA = {
  lat:  parseFloat(import.meta.env.VITE_LOJA_LAT  || '-15.7942'),
  lng:  parseFloat(import.meta.env.VITE_LOJA_LNG  || '-47.8825'),
  nome: import.meta.env.VITE_LOJA_NOME || 'AutoPeças Central',
};

const criarIconeMoto = (cor, apelido, velocidade) => L.divIcon({
  html: `<div style="background:${cor};color:#fff;border-radius:10px;padding:5px 10px;font-size:11px;font-family:'DM Sans',sans-serif;font-weight:500;white-space:nowrap;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.25);display:flex;align-items:center;gap:6px">
    <span style="width:7px;height:7px;background:#7fff7f;border-radius:50%;display:inline-block;animation:pulse 1.5s ease-out infinite"></span>
    ${apelido} · ${velocidade ?? '?'}km/h
  </div>`,
  className: '', iconAnchor: [50, 14],
});

const criarIconeLoja = () => L.divIcon({
  html: `<div style="background:#1f2937;color:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-family:'DM Sans',sans-serif;font-weight:600;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏪 Loja</div>`,
  className: '', iconAnchor: [30, 14],
});

const criarIconeLocal = (status) => L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${
    status === 'CONFIRMADO' ? '#16a34a' : status === 'CHEGOU' ? '#2563eb' : '#ef4444'
  };border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.3)"></div>`,
  className: '', iconAnchor: [7, 7],
});

function formatarHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function MapaConteudo({ motos, posicoes, locaisAtivos, linhas }) {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);

  return (
    <>
      <Marker position={[LOJA.lat, LOJA.lng]} icon={criarIconeLoja()}>
        <Popup><strong>🏪 {LOJA.nome}</strong><br />Ponto de origem</Popup>
      </Marker>

      {motos.map(moto => {
        const pos = posicoes[moto.id];
        if (!pos) return null;
        return (
          <Marker key={moto.id} position={[pos.lat, pos.lng]} icon={criarIconeMoto(moto.cor || '#185FA5', moto.apelido, pos.velocidade)}>
            <Popup>
              <strong>{moto.apelido}</strong><br />
              Placa: {moto.placa}<br />
              Motoqueiro: {moto.motoqueiro?.nome || '—'}<br />
              Velocidade: {pos.velocidade ?? '?'} km/h
            </Popup>
          </Marker>
        );
      })}

      {locaisAtivos.map((local, i) => local?.lat && (
        <Marker key={i} position={[local.lat, local.lng]} icon={criarIconeLocal(local.status)}>
          <Popup>
            <strong>{local.nome}</strong><br />
            {local.endereco}<br />
            Status: {local.status}
          </Popup>
        </Marker>
      ))}

      {linhas.map((linha, i) => (
        <Polyline key={i}
          positions={linha.pontos}
          pathOptions={{
            color: linha.cor,
            weight: linha.dashed ? 2 : 3,
            dashArray: linha.dashed ? '5,8' : undefined,
            opacity: linha.dashed ? 0.5 : 0.8,
          }}
        />
      ))}
    </>
  );
}

export default function DespachanteMapa() {
  const [motos, setMotos]             = useState([]);
  const [posicoes, setPosicoes]       = useState({});
  const [entregasHoje, setEntregas]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [viagensPorMoto, setViagens]  = useState({});
  const [viagemAtiva, setViagemAtiva] = useState(null);
  const [mapaKey]                     = useState(() => Date.now());
  const wsRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const [motosData, posicoesData, entregasData] = await Promise.all([
        motosApi.listar(),
        motosApi.posicoesLive(),
        entregasApi.listar({ data: hoje }),
      ]);
      setMotos(motosData);
      setEntregas(entregasData);

      const mapa = {};
      for (const item of posicoesData) {
        if (item.posicao) {
          mapa[item.moto.id] = {
            lat: item.posicao.lat, lng: item.posicao.lng,
            velocidade: item.posicao.velocidade, ignicao: item.posicao.ignicao,
          };
        }
      }
      setPosicoes(mapa);

      const viagensMap = {};
      await Promise.all(motosData.map(async (moto) => {
        try {
          const v = await motosApi.viagens(moto.id, hoje);
          viagensMap[moto.id] = v;
        } catch { viagensMap[moto.id] = []; }
      }));
      setViagens(viagensMap);
    } catch (err) {
      console.error('Erro ao carregar mapa:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    wsRef.current = criarWebSocket((msg) => {
      if (msg.evento === 'posicao_moto') {
        const d = msg.dados;
        setPosicoes(prev => ({
          ...prev,
          [d.motoId]: { lat: d.lat, lng: d.lng, velocidade: d.velocidade, ignicao: d.ignicao },
        }));
      }
    });
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [carregar]);

  const entregasEmRota = entregasHoje.filter(e => e.status === 'EM_ROTA');
  const locaisAtivos   = entregasHoje.flatMap(e =>
    (e.locais || []).map(el => ({ ...el.local, status: el.status }))
  );

  // Linhas no mapa
  const linhas = [];
  if (viagemAtiva) {
    const moto = motos.find(m => m.id === viagemAtiva.motoId);
    linhas.push({
      pontos: viagemAtiva.viagem.pontos.map(p => [p.lat, p.lng]),
      cor: moto?.cor || '#185FA5',
    });
  } else {
    motos.forEach(moto => {
      const pos = posicoes[moto.id];
      const temEmRota = entregasHoje.some(e => e.motoId === moto.id && e.status === 'EM_ROTA');
      if (pos && temEmRota) {
        linhas.push({
          pontos: [[LOJA.lat, LOJA.lng], [pos.lat, pos.lng]],
          cor: moto.cor || '#185FA5',
          dashed: true,
        });
      }
    });
  }

  return (
    <Layout navItems={NAV}>
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Mapa ao vivo</h1>
          <p className="text-xs text-gray-400">{entregasEmRota.length} entrega{entregasEmRota.length !== 1 ? 's' : ''} em rota agora</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block"></span>
          GPS ativo
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-gray-400 gap-2 text-sm">
              <Loader2 size={16} className="animate-spin" /> Carregando dados…
            </div>
          ) : (
            <MapContainer key={mapaKey} center={[LOJA.lat, LOJA.lng]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={true}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                maxZoom={19}
              />
              <MapaConteudo motos={motos} posicoes={posicoes} locaisAtivos={locaisAtivos} linhas={linhas} />
            </MapContainer>
          )}

          {!loading && (
            <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs space-y-1.5 z-[400]">
              <div className="font-semibold text-gray-700 mb-2">Legenda</div>
              {motos.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: m.cor || '#185FA5' }}></span>
                  <span className="text-gray-600">{m.apelido} · {m.motoqueiro?.nome?.split(' ')[0] || '—'}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-1.5 mt-1.5 space-y-1">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span><span className="text-gray-500">Entregue</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span><span className="text-gray-500">Chegou</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span><span className="text-gray-500">Pendente</span></div>
              </div>
            </div>
          )}

          {viagemAtiva && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-white rounded-xl shadow-lg border border-brand-200 px-4 py-2 flex items-center gap-3 text-xs">
              <Route size={13} className="text-brand-500" />
              <span className="text-gray-700 font-medium">
                Viagem {viagemAtiva.viagem.id} · {viagemAtiva.viagem.km} km
                {viagemAtiva.viagem.entrega && ` · ${viagemAtiva.viagem.entrega.notaFiscal}`}
              </span>
              <button onClick={() => setViagemAtiva(null)} className="text-gray-400 hover:text-gray-600 ml-2">✕</button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-[220px] bg-white border-l border-gray-100 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {['em rota', 'viagens'].map(t => (
              <button key={t} onClick={() => { /* tab state */ }}
                className="flex-1 py-2.5 text-[10px] font-medium capitalize border-b-2 border-transparent text-gray-400 hover:text-gray-600 transition-all"
              >{t}</button>
            ))}
          </div>

          {/* Viagens por moto */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-gray-300" />
              </div>
            ) : motos.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">Nenhuma moto cadastrada</div>
            ) : (
              motos.map(moto => {
                const viagens = viagensPorMoto[moto.id] || [];
                return (
                  <div key={moto.id}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: moto.cor || '#185FA5' }}></span>
                      <span className="text-xs font-semibold text-gray-700">{moto.apelido}</span>
                      <span className="text-[9px] text-gray-400 ml-auto">{viagens.length} viagem{viagens.length !== 1 ? 's' : ''}</span>
                    </div>
                    {viagens.length === 0 ? (
                      <div className="text-[10px] text-gray-400 italic pl-3 mb-1">Sem viagens hoje</div>
                    ) : (
                      <div className="space-y-1">
                        {viagens.map(v => {
                          const ativa = viagemAtiva?.motoId === moto.id && viagemAtiva?.viagem.id === v.id;
                          return (
                            <button
                              key={v.id}
                              onClick={() => setViagemAtiva(ativa ? null : { motoId: moto.id, viagem: v })}
                              className={`w-full text-left p-2 rounded-xl border transition-all ${
                                ativa ? 'border-brand-400 bg-brand-50' : 'border-gray-100 hover:border-gray-200'
                              }`}
                            >
                              <div className="flex justify-between text-[10px] font-medium text-gray-700">
                                <span>{formatarHora(v.inicio)} → {formatarHora(v.fim)}</span>
                                <span className="text-brand-600">{v.km}km</span>
                              </div>
                              {v.entrega ? (
                                <div className="flex items-center gap-1 text-[9px] text-gray-400 mt-0.5">
                                  <Route size={8} />
                                  <span className="font-mono">{v.entrega.notaFiscal}</span>
                                </div>
                              ) : (
                                <div className="text-[9px] text-gray-400 mt-0.5">Sem entrega</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}