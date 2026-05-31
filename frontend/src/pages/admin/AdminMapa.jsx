import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import Layout from '../../components/shared/Layout';
import { Map, BarChart3, MapPin, Bell, AlertTriangle, CheckCircle2, Clock, Route, AlertCircle } from 'lucide-react';
import { motos as motosApi, entregas as entregasApi, alertas as alertasApi, criarWebSocket } from '../../services/api';

const LOJA = {
  lat:  parseFloat(import.meta.env.VITE_LOJA_LAT  || '-15.7942'),
  lng:  parseFloat(import.meta.env.VITE_LOJA_LNG  || '-47.8825'),
  nome: import.meta.env.VITE_LOJA_NOME || 'AutoPeças Central',
};

const NAV = [
  { href: '/admin',            label: 'Mapa ao vivo', icon: Map },
  { href: '/admin/relatorios', label: 'Relatórios',   icon: BarChart3 },
  { href: '/admin/locais',     label: 'Locais',       icon: MapPin },
  { href: '/admin/alertas',    label: 'Alertas',      icon: Bell, badge: true },
];

// ─── Ícone estilo iFood — círculo grande com pulso ───────────────────────────
const criarIconeMoto = (cor, apelido, velocidade, semEntrega) => L.divIcon({
  html: `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center">
      <div style="
        position:absolute;top:0;left:50%;transform:translate(-50%,-50%);
        width:44px;height:44px;border-radius:50%;
        background:${semEntrega ? 'rgba(239,68,68,0.2)' : `${cor}33`};
        animation:moto-pulse 2s ease-out infinite;
      "></div>
      <div style="
        position:relative;z-index:2;
        background:${semEntrega ? '#ef4444' : cor};
        border:3px solid #fff;
        border-radius:50%;
        width:36px;height:36px;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 14px rgba(0,0,0,0.35);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
          <path d="M19 7h-1.5l-1.5-3H9L7.5 7H6a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h.17A3 3 0 0 0 9 17a3 3 0 0 0 2.83-2h.34A3 3 0 0 0 15 17a3 3 0 0 0 2.83-2H19a3 3 0 0 0 3-3v-2a3 3 0 0 0-3-3zm-10 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
        </svg>
      </div>
      <div style="
        position:relative;z-index:2;
        margin-top:4px;
        background:${semEntrega ? '#ef4444' : cor};
        color:#fff;
        border-radius:10px;
        padding:3px 8px;
        font-size:10px;
        font-family:'DM Sans',sans-serif;
        font-weight:600;
        white-space:nowrap;
        border:2px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
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
  html: `<div style="background:#1f2937;color:#fff;border-radius:10px;padding:5px 12px;font-size:11px;font-family:'DM Sans',sans-serif;font-weight:700;white-space:nowrap;border:2.5px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,0.35);display:flex;align-items:center;gap:6px">🏪 ${import.meta.env.VITE_LOJA_NOME || 'Loja'}</div>`,
  className: '', iconAnchor: [40, 14],
});

const criarIconeLocal = (status) => L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${
    status === 'CONFIRMADO' ? '#16a34a' : status === 'CHEGOU' ? '#2563eb' : '#ef4444'
  };border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
  className: '', iconAnchor: [7, 7],
});

const STATUS_CONFIG = {
  CONCLUIDA:     { label: 'Concluída',     cor: 'bg-green-100 text-green-700' },
  EM_ROTA:       { label: 'Em rota',       cor: 'bg-blue-50 text-blue-600' },
  VOLTANDO_LOJA: { label: 'Voltando loja', cor: 'bg-orange-50 text-orange-600' },
  PENDENTE:      { label: 'Pendente',      cor: 'bg-gray-100 text-gray-500' },
  FINALIZADA:    { label: 'Finalizada',    cor: 'bg-green-100 text-green-700' },
  CANCELADA:     { label: 'Cancelada',     cor: 'bg-red-50 text-red-500' },
};

// ─── Componente de zoom automático ──────────────────────────────────────────
function ZoomViagem({ pontos }) {
  const map = useMap();
  useEffect(() => {
    if (!pontos || pontos.length === 0) return;
    const bounds = L.latLngBounds(pontos.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [pontos, map]);
  return null;
}

function MapaControle() {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);
  return null;
}

function formatarHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminMapa() {
  const [tabAtiva, setTabAtiva]             = useState('resumo');
  const [motos, setMotos]                   = useState([]);
  const [posicoes, setPosicoes]             = useState({});
  const [entregasHoje, setEntregas]         = useState([]);
  const [listaAlertas, setAlertas]          = useState([]);
  const [loading, setLoading]               = useState(true);
  const [viagensPorMoto, setViagens]        = useState({});
  const [naoAutPorMoto, setNaoAut]          = useState({});
  const [viagemAtiva, setViagemAtiva]       = useState(null); // { motoId, viagem, autorizada }
  const [posStatus, setPosStatus]           = useState({}); // { [motoId]: temEntregaAtiva }
  const wsRef = useRef(null);

  useEffect(() => {
    async function carregar() {
      try {
        const hoje = new Date().toISOString().split('T')[0];
        const [motosData, posicoesData, entregasData, alertasData] = await Promise.all([
          motosApi.listar(),
          motosApi.posicoesLive(),
          entregasApi.listar({ data: hoje }),
          alertasApi.listar(),
        ]);
        setMotos(motosData);
        setEntregas(entregasData);
        setAlertas(alertasData);

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

        // Status de entrega ativa por moto (para colorir ícone)
        const statusMoto = {};
        entregasData.forEach(e => {
          if (['EM_ROTA', 'VOLTANDO_LOJA'].includes(e.status) && e.motoId) {
            statusMoto[e.motoId] = true;
          }
        });
        setPosStatus(statusMoto);

        // Viagens autorizadas + não autorizadas
        const viagensMap = {};
        const naoAutMap  = {};
        await Promise.all(motosData.map(async (moto) => {
          try {
            const [v, na] = await Promise.all([
              motosApi.viagens(moto.id, hoje),
              motosApi.viagensNaoAutorizadas(moto.id, hoje),
            ]);
            viagensMap[moto.id] = v  || [];
            naoAutMap[moto.id]  = na || [];
          } catch {
            viagensMap[moto.id] = [];
            naoAutMap[moto.id]  = [];
          }
        }));
        setViagens(viagensMap);
        setNaoAut(naoAutMap);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  useEffect(() => {
    wsRef.current = criarWebSocket((msg) => {
      if (msg.evento === 'posicao_moto') {
        const d = msg.dados;
        setPosicoes(prev => ({
          ...prev,
          [d.motoId]: { lat: d.lat, lng: d.lng, velocidade: d.velocidade, ignicao: d.ignicao },
        }));
        if (d.entregaId) {
          setPosStatus(prev => ({ ...prev, [d.motoId]: true }));
        }
      }
    });
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const concluidas    = entregasHoje.filter(e => e.status === 'CONCLUIDA').length;
  const emRota        = entregasHoje.filter(e => ['EM_ROTA','VOLTANDO_LOJA'].includes(e.status)).length;
  const alertasAtivos = listaAlertas.filter(a => !a.lido).length;
  const locaisAtivos  = entregasHoje.flatMap(e =>
    (e.locais || []).map(el => ({ ...el.local, status: el.status }))
  );

  const kmNaoAutTotal = Object.values(naoAutPorMoto)
    .flat()
    .reduce((s, v) => s + (v.km || 0), 0);

  if (loading) {
    return (
      <Layout navItems={NAV}>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Carregando dados…</div>
      </Layout>
    );
  }

  return (
    <Layout navItems={NAV}>
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Mapa ao vivo</h1>
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} · Atualização automática</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block"></span>
            GPS ativo
          </div>
          {alertasAtivos > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
              <AlertTriangle size={12} /> {alertasAtivos} alerta{alertasAtivos > 1 ? 's' : ''}
            </div>
          )}
          {kmNaoAutTotal > 0.5 && (
            <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full">
              <AlertCircle size={12} /> {kmNaoAutTotal.toFixed(1)}km n/aut.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* MAPA */}
        <div className="flex-1 relative">
          <MapContainer center={[LOJA.lat, LOJA.lng]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={true}>
            <MapaControle />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              maxZoom={19}
            />

            {/* Zoom automático na viagem selecionada */}
            {viagemAtiva && <ZoomViagem pontos={viagemAtiva.viagem.pontos} />}

            <Marker position={[LOJA.lat, LOJA.lng]} icon={criarIconeLoja()}>
              <Popup><strong>🏪 {LOJA.nome}</strong><br/>Ponto de origem</Popup>
            </Marker>

            {/* Trajetos autorizados — só mostra se nenhuma viagem selecionada ou a selecionada */}
            {motos.map(moto => {
              const viagens = viagensPorMoto[moto.id] || [];
              return viagens.map((v, i) => {
                const isAtiva = viagemAtiva?.motoId === moto.id && viagemAtiva?.viagem?.id === v.id;
                const mostrar = !viagemAtiva || isAtiva;
                if (!mostrar || v.pontos.length < 2) return null;
                return (
                  <Polyline key={`aut-${moto.id}-${i}`}
                    positions={v.pontos.map(p => [p.lat, p.lng])}
                    pathOptions={{
                      color:   moto.cor || '#185FA5',
                      weight:  isAtiva ? 6 : 3,
                      opacity: isAtiva ? 1 : 0.5,
                    }}
                  />
                );
              });
            })}

            {/* Trajetos NÃO autorizados — vermelho */}
            {motos.map(moto => {
              const viagens = naoAutPorMoto[moto.id] || [];
              return viagens.map((v, i) => {
                const isAtiva = viagemAtiva?.motoId === moto.id && viagemAtiva?.viagem?.id === v.id && !viagemAtiva?.autorizada;
                const mostrar = !viagemAtiva || isAtiva;
                if (!mostrar || v.pontos.length < 2) return null;
                return (
                  <Polyline key={`naut-${moto.id}-${i}`}
                    positions={v.pontos.map(p => [p.lat, p.lng])}
                    pathOptions={{
                      color:     '#ef4444',
                      weight:    isAtiva ? 6 : 3,
                      opacity:   isAtiva ? 1 : 0.6,
                      dashArray: isAtiva ? null : '6,5',
                    }}
                  />
                );
              });
            })}

            {/* Motos */}
            {motos.map(moto => {
              const pos = posicoes[moto.id];
              if (!pos) return null;
              const semEntrega = !posStatus[moto.id];
              return (
                <Marker key={moto.id} position={[pos.lat, pos.lng]}
                  icon={criarIconeMoto(moto.cor || '#185FA5', moto.apelido, pos.velocidade, semEntrega)}
                >
                  <Popup>
                    <strong>{moto.apelido}</strong><br/>
                    {moto.motoqueiro?.nome || '—'}<br/>
                    Velocidade: {pos.velocidade != null ? `${Math.round(pos.velocidade)} km/h` : '—'}<br/>
                    {semEntrega && <span style={{color:'#ef4444',fontWeight:600}}>⚠️ Sem entrega ativa</span>}
                  </Popup>
                </Marker>
              );
            })}

            {/* Locais das entregas */}
            {locaisAtivos.map((local, i) => local?.lat && (
              <Marker key={i} position={[local.lat, local.lng]} icon={criarIconeLocal(local.status)}>
                <Popup>
                  <strong>{local.nome}</strong><br/>{local.endereco}<br/>Status: {local.status}
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Legenda */}
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
                <span className="w-8 h-0.5 bg-gray-400 inline-block" style={{borderTop:'2px dashed #ef4444'}}></span>
                <span className="text-red-500">Não autorizado</span>
              </div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span><span className="text-gray-500">Entregue</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span><span className="text-gray-500">Chegou</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span><span className="text-gray-500">Pendente</span></div>
            </div>
          </div>
        </div>

        {/* PAINEL LATERAL */}
        <div className="w-[250px] bg-white border-l border-gray-100 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {['resumo', 'entregas', 'alertas', 'viagens'].map(t => (
              <button key={t} onClick={() => setTabAtiva(t)}
                className={`flex-1 py-2.5 text-[10px] font-medium capitalize transition-all border-b-2 ${
                  tabAtiva === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >{t}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-3">

            {/* ── RESUMO ── */}
            {tabAtiva === 'resumo' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Entregas',   valor: entregasHoje.length, cor: 'text-gray-900' },
                    { label: 'Concluídas', valor: concluidas,          cor: 'text-green-600' },
                    { label: 'Em rota',    valor: emRota,              cor: 'text-blue-600' },
                    { label: 'Alertas',    valor: alertasAtivos,       cor: 'text-red-600' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{m.label}</div>
                      <div className={`text-xl font-semibold ${m.cor}`}>{m.valor}</div>
                    </div>
                  ))}
                </div>

                {/* KM não autorizado por moto */}
                {motos.map(moto => {
                  const naoAut = naoAutPorMoto[moto.id] || [];
                  const kmNA   = naoAut.reduce((s, v) => s + v.km, 0);
                  const minhasE = entregasHoje.filter(e => e.motoId === moto.id);
                  const kmPrev  = minhasE.reduce((s, e) => s + (e.kmPrevisto || 0), 0);
                  const kmReal  = minhasE.reduce((s, e) => s + (e.kmRealizado || 0), 0);
                  return (
                    <div key={moto.id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: moto.cor || '#185FA5' }}></span>
                        <span className="text-xs font-semibold text-gray-800">{moto.apelido}</span>
                        <span className="ml-auto text-[10px] text-gray-400">{moto.motoqueiro?.nome?.split(' ')[0] || '—'}</span>
                      </div>
                      <div className="space-y-1 text-[10px]">
                        <div className="flex justify-between text-gray-500">
                          <span>Prev.</span><span className="font-medium">{kmPrev.toFixed(1)} km</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Real.</span>
                          <span className={`font-medium ${kmReal > kmPrev ? 'text-red-500' : 'text-green-600'}`}>{kmReal.toFixed(1)} km</span>
                        </div>
                        {kmNA > 0.1 && (
                          <div className="flex justify-between text-red-500 font-semibold border-t border-gray-100 pt-1 mt-1">
                            <span>Não autorizado</span><span>{kmNA.toFixed(1)} km</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── ENTREGAS ── */}
            {tabAtiva === 'entregas' && (
              <div className="space-y-2">
                {entregasHoje.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">Nenhuma entrega hoje</div>}
                {entregasHoje.map(e => {
                  const moto = motos.find(m => m.id === e.motoId);
                  const cfg  = STATUS_CONFIG[e.status] || STATUS_CONFIG.PENDENTE;
                  return (
                    <div key={e.id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-gray-800 font-mono">{e.notaFiscal}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.cor}`}>{cfg.label}</span>
                      </div>
                      {moto && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                          <span className="w-2 h-2 rounded-full" style={{ background: moto.cor || '#185FA5' }}></span>
                          {moto.apelido} · {moto.motoqueiro?.nome?.split(' ')[0] || '—'}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-1">
                        {(e.locais || []).length} parada{(e.locais || []).length !== 1 ? 's' : ''} · {(e.locais || []).filter(l => l.status === 'CONFIRMADO').length} confirmada{(e.locais || []).filter(l => l.status === 'CONFIRMADO').length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── ALERTAS ── */}
            {tabAtiva === 'alertas' && (
              <div className="space-y-2">
                {listaAlertas.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
                    Nenhum alerta ativo
                  </div>
                )}
                {listaAlertas.map(a => (
                  <div key={a.id} className={`rounded-xl p-3 border ${a.lido ? 'bg-gray-50 border-gray-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={13} className={a.lido ? 'text-gray-400 mt-0.5' : 'text-red-500 mt-0.5'} />
                      <div>
                        <div className="text-xs text-gray-700 leading-relaxed">{a.descricao}</div>
                        <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                          <Clock size={10} /> {formatarHora(a.criadoEm)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── VIAGENS ── */}
            {tabAtiva === 'viagens' && (() => {
              // Mescla autorizadas + não autorizadas com flag
              const todas = motos.flatMap(moto => [
                ...(viagensPorMoto[moto.id] || []).map(v => ({ ...v, moto, autorizada: true })),
                ...(naoAutPorMoto[moto.id]  || []).map(v => ({ ...v, moto, autorizada: false })),
              ]).sort((a, b) => new Date(b.inicio) - new Date(a.inicio));

              const comEntrega = todas.filter(v => v.autorizada);
              const semEntrega = todas.filter(v => !v.autorizada);

              const renderViagem = (v) => {
                const isAtiva = viagemAtiva?.motoId === v.moto.id && viagemAtiva?.viagem?.id === v.id && viagemAtiva?.autorizada === v.autorizada;
                const dur = Math.round((new Date(v.fim) - new Date(v.inicio)) / 60000);
                return (
                  <button
                    key={`${v.moto.id}-${v.autorizada ? 'a' : 'n'}-${v.id}`}
                    onClick={() => setViagemAtiva(isAtiva ? null : { motoId: v.moto.id, viagem: v, autorizada: v.autorizada })}
                    className={`w-full text-left border rounded-xl p-3 transition-all ${
                      isAtiva
                        ? (v.autorizada ? 'border-brand-400 bg-brand-50' : 'border-red-400 bg-red-50')
                        : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: v.autorizada ? (v.moto.cor || '#185FA5') : '#ef4444' }}></span>
                      <span className="text-xs font-semibold text-gray-800">{v.moto.apelido}</span>
                      {!v.autorizada && (
                        <span className="ml-auto text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">N/AUT</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 space-y-0.5">
                      <div className="flex justify-between">
                        <span>{formatarHora(v.inicio)}</span>
                        <span>→</span>
                        <span>{formatarHora(v.fim)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>{dur} min</span>
                        <span className={`font-medium ${v.autorizada ? 'text-gray-600' : 'text-red-500'}`}>{v.km} km</span>
                      </div>
                    </div>
                    {v.entrega && (
                      <div className="mt-1.5 pt-1.5 border-t border-gray-100 text-[10px] text-brand-600 font-medium truncate">
                        NF {v.entrega.notaFiscal} · {v.entrega.status}
                      </div>
                    )}
                  </button>
                );
              };

              if (todas.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <Route size={32} className="mx-auto mb-2 text-gray-300" />
                    Nenhuma viagem hoje
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {comEntrega.length > 0 && (
                    <div>
                      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2 px-1">
                        Com entrega ({comEntrega.length})
                      </div>
                      <div className="space-y-2">{comEntrega.map(renderViagem)}</div>
                    </div>
                  )}
                  {semEntrega.length > 0 && (
                    <div>
                      <div className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-2 px-1 flex items-center gap-1">
                        <AlertCircle size={11} /> Não autorizadas ({semEntrega.length}) · {semEntrega.reduce((s, v) => s + v.km, 0).toFixed(1)} km
                      </div>
                      <div className="space-y-2">{semEntrega.map(renderViagem)}</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </Layout>
  );
}
