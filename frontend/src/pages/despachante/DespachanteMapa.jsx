import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import Layout from '../../components/shared/Layout';
import { ClipboardList, Map, Bell, AlertTriangle, Navigation2 } from 'lucide-react';
import { motos as motosApi, entregas as entregasApi, alertas as alertasApi, criarWebSocket } from '../../services/api';

const LOJA = {
  lat:  parseFloat(import.meta.env.VITE_LOJA_LAT  || '-15.7942'),
  lng:  parseFloat(import.meta.env.VITE_LOJA_LNG  || '-47.8825'),
  nome: import.meta.env.VITE_LOJA_NOME || 'AutoPeças Central',
};

const NAV = [
  { href: '/despachante',         label: 'Entregas', icon: ClipboardList },
  { href: '/despachante/mapa',    label: 'Mapa',     icon: Map },
  { href: '/despachante/alertas', label: 'Alertas',  icon: Bell, badge: true },
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

function MapaControle() {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);
  return null;
}

export default function DespachanteMapa() {
  const [montado, setMontado]       = useState(false);
  const [motos, setMotos]           = useState([]);
  const [posicoes, setPosicoes]     = useState({});
  const [entregasHoje, setEntregas] = useState([]);
  const [alertasNaoLidos, setAlertasNaoLidos] = useState(0);
  const [loading, setLoading]       = useState(true);

  // Fix crash Leaflet + StrictMode
  useEffect(() => {
    const t = setTimeout(() => setMontado(true), 50);
    return () => clearTimeout(t);
  }, []);

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
        setAlertasNaoLidos(alertasData.filter(a => !a.lido).length);

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

    const ws = criarWebSocket((msg) => {
      if (msg.evento === 'posicao_moto') {
        const d = msg.dados;
        setPosicoes(prev => ({
          ...prev,
          [d.motoId]: { lat: d.lat, lng: d.lng, velocidade: d.velocidade, ignicao: d.ignicao },
        }));
      }
    });
    return () => ws.close();
  }, []);

  const entregasEmRota = entregasHoje.filter(e => e.status === 'EM_ROTA');
  const locaisAtivos   = entregasHoje.flatMap(e =>
    (e.locais || []).map(el => ({ ...el.local, status: el.status }))
  );

  return (
    <Layout navItems={NAV} titulo="Despachante">
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
          {loading && (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              Carregando dados reais…
            </div>
          )}
          {!loading && !montado && (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              Carregando mapa…
            </div>
          )}
          {!loading && montado && (
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
          )}

          {montado && (
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
          )}
        </div>

        {/* Painel lateral */}
        <div className="w-[220px] bg-white border-l border-gray-100 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-700">Entregas em rota</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {entregasEmRota.map(e => (
              <div key={e.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: motos.find(m => m.id === e.motoId)?.cor || '#185FA5' }}></span>
                  <span className="text-xs font-semibold text-gray-800 font-mono">{e.notaFiscal}</span>
                </div>
                <div className="text-[10px] text-gray-400 mb-2">
                  {motos.find(m => m.id === e.motoId)?.apelido || '—'} · {motos.find(m => m.id === e.motoId)?.motoqueiro?.nome?.split(' ')[0] || '—'}
                </div>
                <div className="space-y-1">
                  {(e.locais || []).map((el, i) => (
                    <div key={el.id || i} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 ${
                        el.status === 'CONFIRMADO' ? 'bg-green-500 text-white' :
                        el.status === 'CHEGOU'     ? 'bg-blue-500 text-white'  :
                        'bg-gray-200 text-gray-500'
                      }`}>{i + 1}</div>
                      <span className="text-[10px] text-gray-600 truncate">{el.local?.nome || '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-50">
                  {(e.locais || []).filter(l => l.status === 'CONFIRMADO').length}/{(e.locais || []).length} confirmadas
                </div>
              </div>
            ))}
            {entregasEmRota.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-400 text-xs">
                <Navigation2 size={24} className="mx-auto mb-2 text-gray-300" />
                Nenhuma entrega em rota
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}