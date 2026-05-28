import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import Layout from '../../components/shared/Layout';
import { ClipboardList, Map, Bell, Plus, X, Send, ChevronRight, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { motos as motosApi, locais as locaisApi, entregas as entregasApi } from '../../services/api';

const NAV = [
  { href: '/despachante',         label: 'Entregas',  icon: ClipboardList },
  { href: '/despachante/mapa',    label: 'Mapa',      icon: Map },
  { href: '/despachante/alertas', label: 'Alertas',   icon: Bell, badge: true },
];

const STATUS_CONFIG = {
  CONCLUIDA: { label: 'Concluída', cor: 'bg-green-100 text-green-700 border-green-200' },
  EM_ROTA:   { label: 'Em rota',   cor: 'bg-blue-50 text-blue-600 border-blue-200' },
  PENDENTE:  { label: 'Pendente',  cor: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const LOJA = {
  lat: parseFloat(import.meta.env.VITE_LOJA_LAT || '-15.7942'),
  lng: parseFloat(import.meta.env.VITE_LOJA_LNG || '-47.8825'),
};

const criarIconeLocal = (selecionado, ordem) => L.divIcon({
  html: `<div style="background:${selecionado ? '#185FA5' : '#6b7280'};color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${ordem || '+'}</div>`,
  className: '', iconAnchor: [13, 13],
});

const criarIconeLoja = () => L.divIcon({
  html: `<div style="background:#1f2937;color:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-family:'DM Sans',sans-serif;font-weight:600;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏪 Loja</div>`,
  className: '', iconAnchor: [30, 14],
});

export default function Despachante() {
  const [aba, setAba]           = useState('lista');
  const [motos, setMotos]       = useState([]);
  const [locais, setLocais]     = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso]   = useState(false);

  const [locaisSel, setLocaisSel] = useState([]);
  const [motoSel, setMotoSel]     = useState('');
  const [nf, setNf]               = useState('');

  const carregar = useCallback(async () => {
    try {
      const [motosData, locaisData, entregasData] = await Promise.all([
        motosApi.listar(),
        locaisApi.listar(),
        entregasApi.listar({ data: new Date().toISOString().split('T')[0] }),
      ]);
      setMotos(motosData);
      setLocais(locaisData);
      setEntregas(entregasData);
    } catch (err) {
      console.error('Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const toggleLocal = (local) => {
    setLocaisSel(prev =>
      prev.find(l => l.id === local.id)
        ? prev.filter(l => l.id !== local.id)
        : [...prev, local]
    );
  };

  const disparar = async () => {
    if (!nf || !motoSel || locaisSel.length === 0) return;
    setEnviando(true);
    try {
      await entregasApi.criar({
        notaFiscal: nf,
        motoId: motoSel,
        locais: locaisSel.map((l, i) => ({ localId: l.id, ordem: i + 1 })),
      });
      setSucesso(true);
      setTimeout(async () => {
        setSucesso(false);
        setAba('lista');
        setNf(''); setMotoSel(''); setLocaisSel([]);
        await carregar();
      }, 1500);
    } catch (err) {
      console.error('Erro ao criar entrega:', err);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <Layout navItems={NAV}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout navItems={NAV}>
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            {aba === 'lista' ? 'Entregas do dia' : 'Nova entrega'}
          </h1>
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</p>
        </div>
        <button
          onClick={() => { setAba(aba === 'lista' ? 'nova' : 'lista'); setLocaisSel([]); setMotoSel(''); setNf(''); }}
          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-all ${
            aba === 'nova'
              ? 'bg-gray-100 text-gray-600'
              : 'bg-brand-500 text-white hover:bg-brand-600'
          }`}
        >
          {aba === 'nova' ? <><X size={13} /> Cancelar</> : <><Plus size={13} /> Nova entrega</>}
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex">

        {/* ABA LISTA */}
        {aba === 'lista' && (
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Total hoje',  valor: entregas.length,                                          cor: 'text-gray-900' },
                { label: 'Em rota',     valor: entregas.filter(e => e.status === 'EM_ROTA').length,      cor: 'text-blue-600' },
                { label: 'Concluídas', valor: entregas.filter(e => e.status === 'CONCLUIDA').length,    cor: 'text-green-600' },
              ].map(c => (
                <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-3 text-center">
                  <div className={`text-2xl font-semibold ${c.cor}`}>{c.valor}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>

            {entregas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ClipboardList size={32} className="mb-3 text-gray-200" />
                <div className="text-sm">Nenhuma entrega hoje</div>
                <div className="text-xs mt-1">Clique em "Nova entrega" para começar</div>
              </div>
            ) : (
              <div className="space-y-2">
                {entregas.map(e => {
                  const moto = motos.find(m => m.id === e.motoId);
                  const cfg  = STATUS_CONFIG[e.status] || STATUS_CONFIG.PENDENTE;
                  const confirmadas = (e.locais || []).filter(l => l.status === 'CONFIRMADO').length;
                  return (
                    <div key={e.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 font-mono">{e.notaFiscal}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.cor}`}>{cfg.label}</span>
                          </div>
                          {moto && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="w-2 h-2 rounded-full" style={{ background: moto.cor || '#185FA5' }}></span>
                              <span className="text-[11px] text-gray-400">{moto.apelido} · {moto.motoqueiro?.nome || moto.motoqueiro || '—'}</span>
                            </div>
                          )}
                        </div>
                        <ChevronRight size={15} className="text-gray-300 mt-0.5" />
                      </div>

                      <div className="space-y-1 mt-3">
                        {(e.locais || []).map((el, i) => {
                          const local = el.local || locais.find(l => l.id === el.localId);
                          if (!local) return null;
                          return (
                            <div key={el.id || i} className="flex items-center gap-2.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 ${
                                el.status === 'CONFIRMADO' ? 'bg-green-500 text-white' :
                                el.status === 'CHEGOU'     ? 'bg-blue-500 text-white'  :
                                'bg-gray-100 text-gray-400'
                              }`}>{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-700 truncate">{local.nome}</div>
                                {el.chegouEm && <div className="text-[10px] text-gray-400">Chegou {el.chegouEm}{el.saiuEm ? ` · Saiu ${el.saiuEm}` : ''}</div>}
                              </div>
                              {el.status === 'CONFIRMADO' && <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      {e.kmPrevisto && (
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50 text-[10px] text-gray-400">
                          <span>KM prev. {e.kmPrevisto}km</span>
                          {e.kmRealizado && <span className={e.kmRealizado > e.kmPrevisto ? 'text-red-500' : 'text-green-600'}>Real. {e.kmRealizado}km</span>}
                          <span className="ml-auto">{confirmadas}/{(e.locais || []).length} confirmadas</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA NOVA ENTREGA */}
        {aba === 'nova' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-[300px] flex-shrink-0 overflow-y-auto scrollbar-thin p-5 border-r border-gray-100 bg-white space-y-5">
              {sucesso ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={28} className="text-green-600" />
                  </div>
                  <div className="font-semibold text-gray-800">Entrega criada!</div>
                  <div className="text-xs text-gray-400">Redirecionando...</div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Nota fiscal</label>
                    <input
                      value={nf}
                      onChange={e => setNf(e.target.value)}
                      placeholder="NF-2024-006"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Motoqueiro</label>
                    {motos.length === 0 ? (
                      <div className="text-xs text-gray-400 italic py-2">Nenhuma moto cadastrada</div>
                    ) : (
                      <div className="space-y-2">
                        {motos.map(moto => (
                          <button
                            key={moto.id}
                            onClick={() => setMotoSel(moto.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              motoSel === moto.id ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: moto.cor || '#185FA5' }}></span>
                            <div className="text-left">
                              <div className="text-xs font-medium text-gray-800">{moto.apelido}</div>
                              <div className="text-[10px] text-gray-400">{moto.motoqueiro?.nome || moto.motoqueiro || '—'} · {moto.placa}</div>
                            </div>
                            {motoSel === moto.id && <CheckCircle2 size={14} className="ml-auto text-brand-500" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      Destinos <span className="text-gray-400">({locaisSel.length} selecionados)</span>
                    </label>
                    {locais.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-4 text-center text-gray-400">
                        <MapPin size={20} className="text-gray-300" />
                        <div className="text-xs">Nenhum local cadastrado.</div>
                        <div className="text-[10px] text-gray-300">Cadastre locais no painel Admin → Locais</div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                        {locais.map((local, i) => {
                          const idx = locaisSel.findIndex(l => l.id === local.id);
                          const sel = idx !== -1;
                          return (
                            <button
                              key={local.id}
                              onClick={() => toggleLocal(local)}
                              className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${
                                sel ? 'border-brand-300 bg-brand-50' : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 transition-all ${
                                sel ? 'bg-brand-500 text-white' : 'bg-gray-200 text-gray-500'
                              }`}>{sel ? idx + 1 : i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-gray-800 truncate">{local.nome}</div>
                                <div className="text-[10px] text-gray-400 truncate">{local.endereco}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {locaisSel.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-[10px] text-gray-400 mb-1">KM estimado</div>
                      <div className="text-lg font-semibold text-gray-800">~{(locaisSel.length * 4.2).toFixed(1)} km</div>
                    </div>
                  )}

                  <button
                    onClick={disparar}
                    disabled={!nf || !motoSel || locaisSel.length === 0 || enviando}
                    className="w-full flex items-center justify-center gap-2 bg-brand-500 disabled:opacity-40 hover:bg-brand-600 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
                  >
                    {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {enviando ? 'Enviando…' : 'Disparar entrega'}
                  </button>
                </>
              )}
            </div>

            {/* Mapa de seleção */}
            <div className="flex-1 relative">
              <MapContainer center={[LOJA.lat, LOJA.lng]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={true}>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  maxZoom={19}
                />
                <Marker position={[LOJA.lat, LOJA.lng]} icon={criarIconeLoja()}>
                  <Popup>Ponto de origem</Popup>
                </Marker>
                {locais.map((local) => {
                  const idx = locaisSel.findIndex(l => l.id === local.id);
                  return (
                    <Marker
                      key={local.id}
                      position={[local.lat, local.lng]}
                      icon={criarIconeLocal(idx !== -1, idx !== -1 ? idx + 1 : null)}
                      eventHandlers={{ click: () => toggleLocal(local) }}
                    >
                      <Popup>
                        <strong>{local.nome}</strong><br />{local.endereco}<br />
                        <em style={{ fontSize: '11px', color: '#185FA5' }}>Clique para {idx !== -1 ? 'remover' : 'adicionar'}</em>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
              <div className="absolute top-3 right-3 bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs z-[400]">
                <div className="font-medium text-gray-700 mb-1">Clique nos pins</div>
                <div className="text-gray-400">para adicionar destinos</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}