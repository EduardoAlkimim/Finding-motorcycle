import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import Layout from '../../components/shared/Layout';
import { Map, BarChart3, Users, MapPin, Bell, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { motos as motosApi, entregas as entregasApi, alertas as alertasApi, criarWebSocket } from '../../services/api';

const LOJA = {
  lat:  parseFloat(import.meta.env.VITE_LOJA_LAT  || '-15.7942'),
  lng:  parseFloat(import.meta.env.VITE_LOJA_LNG  || '-47.8825'),
  nome: import.meta.env.VITE_LOJA_NOME || 'AutoPeças Central',
};

const NAV = [
  { href: '/admin',            label: 'Mapa ao vivo', icon: Map },
  { href: '/admin/relatorios', label: 'Relatórios',   icon: BarChart3 },
  { href: '/admin/usuarios',   label: 'Usuários',     icon: Users },
  { href: '/admin/locais',     label: 'Locais',       icon: MapPin },
  { href: '/admin/alertas',    label: 'Alertas',      icon: Bell, badge: true },
];

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
  html: `<div style="width:12px;height:12px;border-radius:50%;background:${status === 'CONFIRMADO' ? '#16a34a' : status === 'CHEGOU' ? '#2563eb' : '#ef4444'};border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,0.3)"></div>`,
  className: '', iconAnchor: [6, 6],
});

const STATUS_CONFIG = {
  CONCLUIDA: { label: 'Concluída', cor: 'bg-green-100 text-green-700' },
  EM_ROTA:   { label: 'Em rota',   cor: 'bg-brand-50 text-brand-600' },
  PENDENTE:  { label: 'Pendente',  cor: 'bg-gray-100 text-gray-500' },
  CANCELADA: { label: 'Cancelada', cor: 'bg-red-50 text-red-500' },
};

function MapaControle() {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);
  return null;
}

export default function AdminMapa() {
  const [tabAtiva, setTabAtiva]     = useState('resumo');
  const [motos, setMotos]           = useState([]);
  const [posicoes, setPosicoes]     = useState({});
  const [entregasHoje, setEntregas] = useState([]);
  const [listaAlertas, setAlertas]  = useState([]);
  const [loading, setLoading]       = useState(true);
  const wsRef = useRef(null);

  useEffect(() => {
    async function carregar() {
      try {
        const [motosData, posicoesData, entregasData, alertasData] = await Promise.all([
          motosApi.listar(),
          motosApi.posicoesLive(),
          entregasApi.listar({ data: new Date().toISOString().split('T')[0] }),
          alertasApi.listar(),
        ]);
        setMotos(motosData);
        setEntregas(entregasData);
        setAlertas(alertasData);
        const mapa = {};
        for (const item of posicoesData) {
          if (item.posicao) {
            mapa[item.moto.id] = {
              lat:        item.posicao.lat,
              lng:        item.posicao.lng,
              velocidade: item.posicao.velocidade,
              ignicao:    item.posicao.ignicao,
            };
          }
        }
        setPosicoes(mapa);
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
      }
    });
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const concluidas    = entregasHoje.filter(e => e.status === 'CONCLUIDA').length;
  const emRota        = entregasHoje.filter(e => e.status === 'EM_ROTA').length;
  const alertasAtivos = listaAlertas.filter(a => !a.lido).length;

  const locaisAtivos = entregasHoje.flatMap(e =>
    (e.locais || []).map(el => ({ ...el.local, status: el.status }))
  );

  if (loading) {
    return (
      <Layout navItems={NAV} titulo="Mapa ao vivo">
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Carregando dados reais…
        </div>
      </Layout>
    );
  }

  return (
    <Layout navItems={NAV} titulo="Mapa ao vivo">
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Mapa ao vivo</h1>
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} · Atualização automática</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block"></span>
            GPS ativo
          </div>
          {alertasAtivos > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
              <AlertTriangle size={12} />
              {alertasAtivos} alerta{alertasAtivos > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <MapContainer center={[LOJA.lat, LOJA.lng]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={true}>
            <MapaControle />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            <Marker position={[LOJA.lat, LOJA.lng]} icon={criarIconeLoja()}>
              <Popup><strong>🏪 {LOJA.nome}</strong><br/>Ponto de origem</Popup>
            </Marker>

            {motos.map(moto => {
              const pos = posicoes[moto.id];
              if (!pos) return null;
              return (
                <Marker key={moto.id} position={[pos.lat, pos.lng]} icon={criarIconeMoto(moto.cor || '#185FA5', moto.apelido, pos.velocidade)}>
                  <Popup>
                    <strong>{moto.apelido}</strong><br/>
                    Placa: {moto.placa}<br/>
                    Motoqueiro: {moto.motoqueiro?.nome || '—'}<br/>
                    Velocidade: {pos.velocidade ?? '?'} km/h<br/>
                    Ignição: {pos.ignicao ? '✅ ligada' : '🔴 desligada'}
                  </Popup>
                </Marker>
              );
            })}

            {locaisAtivos.map((local, i) => local?.lat && (
              <Marker key={i} position={[local.lat, local.lng]} icon={criarIconeLocal(local.status)}>
                <Popup>
                  <strong>{local.nome}</strong><br/>
                  {local.endereco}<br/>
                  Status: {local.status}
                </Popup>
              </Marker>
            ))}

            {motos.map(moto => {
              const pos = posicoes[moto.id];
              if (!pos) return null;
              return (
                <Polyline key={moto.id}
                  positions={[[LOJA.lat, LOJA.lng], [pos.lat, pos.lng]]}
                  pathOptions={{ color: moto.cor || '#185FA5', weight: 2, dashArray: '5,8', opacity: 0.5 }}
                />
              );
            })}
          </MapContainer>

          <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs space-y-1.5 z-[400]">
            <div className="font-semibold text-gray-700 mb-2">Legenda</div>
            {motos.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: m.cor || '#185FA5' }}></span>
                <span className="text-gray-600">{m.apelido} · {m.motoqueiro?.nome?.split(' ')[0] || '—'}</span>
              </div>
            ))}
            {motos.length === 0 && <div className="text-gray-400 italic">Nenhuma moto cadastrada</div>}
            <div className="border-t border-gray-100 pt-1.5 mt-1.5 space-y-1">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span><span className="text-gray-500">Entregue</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span><span className="text-gray-500">Chegou</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span><span className="text-gray-500">Pendente</span></div>
            </div>
          </div>
        </div>

        <div className="w-[240px] bg-white border-l border-gray-100 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {['resumo', 'entregas', 'alertas'].map(t => (
              <button key={t} onClick={() => setTabAtiva(t)}
                className={`flex-1 py-2.5 text-xs font-medium capitalize transition-all border-b-2 ${
                  tabAtiva === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >{t}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
            {tabAtiva === 'resumo' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Entregas',   valor: entregasHoje.length, cor: 'text-gray-900' },
                    { label: 'Concluídas', valor: concluidas,          cor: 'text-green-600' },
                    { label: 'Em rota',    valor: emRota,              cor: 'text-brand-600' },
                    { label: 'Alertas',    valor: alertasAtivos,       cor: 'text-red-600' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{m.label}</div>
                      <div className={`text-2xl font-semibold ${m.cor}`}>{m.valor}</div>
                    </div>
                  ))}
                </div>
                {motos.map(moto => {
                  const minhasEntregas = entregasHoje.filter(e => e.motoId === moto.id);
                  const kmPrev = minhasEntregas.reduce((s, e) => s + (e.kmPrevisto || 0), 0);
                  const kmReal = minhasEntregas.filter(e => e.kmRealizado).reduce((s, e) => s + (e.kmRealizado || 0), 0);
                  const desvio = kmReal - kmPrev;
                  return (
                    <div key={moto.id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: moto.cor || '#185FA5' }}></span>
                        <span className="text-xs font-semibold text-gray-800">{moto.apelido}</span>
                        <span className="ml-auto text-[10px] text-gray-400">{moto.motoqueiro?.nome?.split(' ')[0] || '—'}</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>Previsto</span><span className="font-medium text-gray-600">{kmPrev.toFixed(1)} km</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full">
                            <div className="h-full rounded-full opacity-40" style={{ background: moto.cor || '#185FA5', width: '100%' }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>Realizado</span>
                            <span className={`font-medium ${desvio > 0 ? 'text-red-500' : 'text-green-600'}`}>{kmReal.toFixed(1)} km</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full">
                            <div className="h-full rounded-full" style={{ background: moto.cor || '#185FA5', width: `${kmPrev > 0 ? Math.min((kmReal / kmPrev) * 100, 120) : 0}%` }}></div>
                          </div>
                        </div>
                        {kmReal > 0 && (
                          <div className={`text-[10px] ${desvio > 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {desvio > 0 ? `+${desvio.toFixed(1)} km acima` : 'Dentro do previsto'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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
                          <Clock size={10} /> {new Date(a.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}