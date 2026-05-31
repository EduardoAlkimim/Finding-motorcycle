import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import Layout from '../../components/shared/Layout';
import {
  ClipboardList, Map, Bell, Plus, X, Send, CheckCircle2, Loader2,
  MapPin, Trash2, AlertCircle, ChevronRight, Play, Flag, Home, RotateCcw,
} from 'lucide-react';
import { motos as motosApi, locais as locaisApi, entregas as entregasApi } from '../../services/api';

const NAV = [
  { href: '/despachante',         label: 'Entregas', icon: ClipboardList },
  { href: '/despachante/mapa',    label: 'Mapa',     icon: Map },
  { href: '/despachante/alertas', label: 'Alertas',  icon: Bell, badge: true },
];

const STATUS_CONFIG = {
  PENDENTE:      { label: 'Pendente',       cor: 'bg-gray-100 text-gray-500 border-gray-200' },
  EM_ROTA:       { label: 'Em rota',        cor: 'bg-blue-50 text-blue-600 border-blue-200' },
  CONCLUIDA:     { label: 'Concluída',      cor: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  VOLTANDO_LOJA: { label: 'Voltando loja',  cor: 'bg-orange-50 text-orange-600 border-orange-200' },
  FINALIZADA:    { label: 'Finalizada',     cor: 'bg-green-100 text-green-700 border-green-200' },
  CANCELADA:     { label: 'Cancelada',      cor: 'bg-red-50 text-red-500 border-red-200' },
};

const LOJA = {
  lat: parseFloat(import.meta.env.VITE_LOJA_LAT || '-15.7942'),
  lng: parseFloat(import.meta.env.VITE_LOJA_LNG || '-47.8825'),
};

const OSRM_URL = import.meta.env.VITE_OSRM_URL || 'https://router.project-osrm.org';

const criarIconeLocal = (selecionado, ordem) => L.divIcon({
  html: `<div style="background:${selecionado ? '#185FA5' : '#6b7280'};color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${ordem || '+'}</div>`,
  className: '', iconAnchor: [13, 13],
});

const criarIconeLoja = () => L.divIcon({
  html: `<div style="background:#1f2937;color:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-family:'DM Sans',sans-serif;font-weight:600;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏪 Loja</div>`,
  className: '', iconAnchor: [30, 14],
});

async function calcularKmOSRM(locais) {
  if (!locais || locais.length === 0) return null;
  try {
    const pontos = [LOJA, ...locais.map(l => ({ lat: l.lat, lng: l.lng })), LOJA];
    const coords = pontos.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${OSRM_URL}/route/v1/driving/${coords}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.code === 'Ok' && data.routes[0]) {
      return parseFloat((data.routes[0].distance / 1000).toFixed(2));
    }
    return null;
  } catch {
    return null;
  }
}

function formatarHora(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function km(val) {
  if (!val && val !== 0) return '—';
  return `${parseFloat(val).toFixed(1)} km`;
}

// ─── Modal de detalhes da entrega ───────────────────────────────────────────
function ModalEntrega({ entrega, onClose, onAcao, onDeletar, atualizando }) {
  const cfg = STATUS_CONFIG[entrega.status] || STATUS_CONFIG.PENDENTE;
  const moto = entrega.moto;
  const confirmadas = (entrega.locais || []).filter(l => l.status === 'CONFIRMADO').length;
  const total = (entrega.locais || []).length;

  const acoes = [];
  if (entrega.status === 'PENDENTE') acoes.push({ label: 'Iniciar rota', acao: 'iniciar', icon: Play, cor: 'bg-blue-500 hover:bg-blue-600' });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-semibold text-gray-900 font-mono">{entrega.notaFiscal}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.cor}`}>{cfg.label}</span>
            </div>
            {moto && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: moto.cor || '#185FA5' }}></span>
                <span className="text-xs text-gray-400">{moto.apelido} · {entrega.motoqueiro?.nome || '—'}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all">
            <X size={15} />
          </button>
        </div>

        {/* Paradas */}
        <div className="p-5 border-b border-gray-100">
          <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-3">Paradas ({confirmadas}/{total})</div>
          <div className="space-y-2">
            {(entrega.locais || []).map((el, i) => {
              const local = el.local;
              if (!local) return null;
              return (
                <div key={el.id || i} className="flex items-start gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 mt-0.5 ${
                    el.status === 'CONFIRMADO' ? 'bg-green-500 text-white' :
                    el.status === 'CHEGOU'     ? 'bg-blue-500 text-white' :
                    el.status === 'PROBLEMA'   ? 'bg-red-400 text-white' :
                    'bg-gray-100 text-gray-400'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800">{local.nome}</div>
                    <div className="text-[10px] text-gray-400 truncate">{local.endereco}</div>
                    {el.chegouEm && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        Chegou {formatarHora(el.chegouEm)}
                        {el.confirmadoEm ? ` · Confirmado ${formatarHora(el.confirmadoEm)}` : ''}
                      </div>
                    )}
                  </div>
                  {el.status === 'CONFIRMADO' && <CheckCircle2 size={13} className="text-green-500 flex-shrink-0 mt-0.5" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* KM */}
        <div className="p-5 border-b border-gray-100">
          <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-3">Quilometragem</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Previsto entregas', val: entrega.kmPrevisto },
              { label: 'Realizado entregas', val: entrega.kmRealizado },
              { label: 'Previsto retorno', val: entrega.kmRetornoPrevisto },
              { label: 'Realizado retorno', val: entrega.kmRetorno },
            ].map(({ label, val }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] text-gray-400 mb-1">{label}</div>
                <div className="text-sm font-semibold text-gray-800">{km(val)}</div>
              </div>
            ))}
          </div>
          {entrega.kmTotal != null && (
            <div className="mt-2 bg-brand-50 border border-brand-100 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-brand-700 font-medium">Total percorrido</span>
              <span className="text-sm font-bold text-brand-700">{km(entrega.kmTotal)}</span>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="p-5 border-b border-gray-100">
          <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-3">Timeline</div>
          <div className="space-y-1.5 text-[11px]">
            {[
              { label: 'Criada',             val: entrega.criadoEm },
              { label: 'Saída',              val: entrega.saidaEm },
              { label: 'Entregas concluídas',val: entrega.chegadaEm },
              { label: 'Retorno iniciado',   val: entrega.retornoIniciadoEm },
              { label: 'Finalizada',         val: entrega.finalizadoEm },
            ].filter(t => t.val).map(({ label, val }) => (
              <div key={label} className="flex justify-between text-gray-600">
                <span className="text-gray-400">{label}</span>
                <span className="font-medium">{formatarHora(val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ações */}
        {(acoes.length > 0 || ['PENDENTE','CONCLUIDA','CANCELADA','FINALIZADA'].includes(entrega.status)) && (
          <div className="p-5 space-y-2">
            {acoes.map(({ label, acao, icon: Icon, cor }) => (
              <button
                key={acao}
                onClick={() => onAcao(entrega.id, acao)}
                disabled={atualizando === entrega.id}
                className={`w-full flex items-center justify-center gap-2 ${cor} disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-all`}
              >
                {atualizando === entrega.id ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                {label}
              </button>
            ))}
            {!['EM_ROTA','VOLTANDO_LOJA'].includes(entrega.status) && (
              <button
                onClick={() => onDeletar(entrega.id)}
                className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                <Trash2 size={14} /> Deletar entrega
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Despachante() {
  const [aba, setAba]                 = useState('lista');
  const [motos, setMotos]             = useState([]);
  const [locais, setLocais]           = useState([]);
  const [entregas, setEntregas]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [enviando, setEnviando]       = useState(false);
  const [sucesso, setSucesso]         = useState(false);
  const [deletando, setDeletando]     = useState(null);
  const [atualizando, setAtualizando] = useState(null);
  const [confirmarDeletar, setConfirmarDeletar] = useState(null);
  const [entregaAberta, setEntregaAberta]       = useState(null);

  const [locaisSel, setLocaisSel]       = useState([]);
  const [motoSel, setMotoSel]           = useState('');
  const [nf, setNf]                     = useState('');
  const [kmEstimado, setKmEstimado]     = useState(null);
  const [calculandoKm, setCalculandoKm] = useState(false);
  const kmTimerRef = useRef(null);

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
      // Atualiza entrega aberta se existir
      setEntregaAberta(prev =>
        prev ? entregasData.find(e => e.id === prev.id) || null : null
      );
    } catch (err) {
      console.error('Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (locaisSel.length === 0) { setKmEstimado(null); return; }
    if (kmTimerRef.current) clearTimeout(kmTimerRef.current);
    kmTimerRef.current = setTimeout(async () => {
      setCalculandoKm(true);
      const km = await calcularKmOSRM(locaisSel);
      setKmEstimado(km);
      setCalculandoKm(false);
    }, 500);
    return () => clearTimeout(kmTimerRef.current);
  }, [locaisSel]);

  const toggleLocal = (local) => {
    setLocaisSel(prev =>
      prev.find(l => l.id === local.id)
        ? prev.filter(l => l.id !== local.id)
        : [...prev, local]
    );
  };

  const disparar = async () => {
    if (!nf?.trim() || !motoSel || locaisSel.length === 0) return;
    setEnviando(true);
    try {
      await entregasApi.criar({
        notaFiscal: nf.trim(),
        motoId:     motoSel,
        locaisIds:  locaisSel.map(l => l.id),
      });
      setSucesso(true);
      setTimeout(async () => {
        setSucesso(false);
        setAba('lista');
        setNf(''); setMotoSel(''); setLocaisSel([]); setKmEstimado(null);
        await carregar();
      }, 1500);
    } catch (err) {
      alert('Erro ao criar entrega: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const executarAcao = async (id, acao) => {
    setAtualizando(id);
    try {
      const fns = {
        iniciar:   () => entregasApi.iniciar(id),
        concluir:  () => entregasApi.concluir(id),
        retorno:   () => entregasApi.iniciarRetorno(id),
        finalizar: () => entregasApi.finalizar(id),
      };
      await fns[acao]?.();
      await carregar();
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      setAtualizando(null);
    }
  };

  const deletarEntrega = async (id) => {
    setDeletando(id);
    try {
      await entregasApi.deletar(id);
      setConfirmarDeletar(null);
      await carregar();
    } catch (err) {
      alert('Erro ao deletar: ' + err.message);
    } finally {
      setDeletando(null);
    }
  };

  const linhaRota = locaisSel.length > 0
    ? [LOJA, ...locaisSel.map(l => ({ lat: l.lat, lng: l.lng })), LOJA].map(p => [p.lat, p.lng])
    : [];

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
          onClick={() => { setAba(aba === 'lista' ? 'nova' : 'lista'); setLocaisSel([]); setMotoSel(''); setNf(''); setKmEstimado(null); }}
          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-all ${
            aba === 'nova' ? 'bg-gray-100 text-gray-600' : 'bg-brand-500 text-white hover:bg-brand-600'
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
                { label: 'Total hoje',  valor: entregas.length,                                                  cor: 'text-gray-900' },
                { label: 'Em rota',     valor: entregas.filter(e => ['EM_ROTA','VOLTANDO_LOJA'].includes(e.status)).length, cor: 'text-blue-600' },
                { label: 'Finalizadas', valor: entregas.filter(e => e.status === 'FINALIZADA').length,           cor: 'text-green-600' },
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
                  const podeDeletar = !['EM_ROTA','VOLTANDO_LOJA'].includes(e.status);
                  return (
                    <div
                      key={e.id}
                      className="bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-all cursor-pointer"
                      onClick={() => setEntregaAberta(e)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 font-mono">{e.notaFiscal}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.cor}`}>{cfg.label}</span>
                          </div>
                          {moto && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="w-2 h-2 rounded-full" style={{ background: moto.cor || '#185FA5' }}></span>
                              <span className="text-[11px] text-gray-400">{moto.apelido} · {moto.motoqueiro?.nome || '—'}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1" onClick={ev => ev.stopPropagation()}>
                          {podeDeletar && (
                            <button
                              onClick={() => setConfirmarDeletar(e.id)}
                              className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <ChevronRight size={14} className="text-gray-300" />
                        </div>
                      </div>

                      <div className="space-y-1 mt-3">
                        {(e.locais || []).map((el, i) => {
                          const local = el.local || locais.find(l => l.id === el.localId);
                          if (!local) return null;
                          return (
                            <div key={el.id || i} className="flex items-center gap-2.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 ${
                                el.status === 'CONFIRMADO' ? 'bg-green-500 text-white' :
                                el.status === 'CHEGOU'     ? 'bg-blue-500 text-white' :
                                'bg-gray-100 text-gray-400'
                              }`}>{i + 1}</div>
                              <span className="text-xs text-gray-700 truncate">{local.nome}</span>
                              {el.status === 'CONFIRMADO' && <CheckCircle2 size={11} className="text-green-500 ml-auto flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50 text-[10px] text-gray-400">
                        {e.kmPrevisto && <span>Prev. {parseFloat(e.kmPrevisto).toFixed(1)} km</span>}
                        {e.kmRealizado && (
                          <span className={parseFloat(e.kmRealizado) > parseFloat(e.kmPrevisto) ? 'text-red-500' : 'text-green-600'}>
                            Real. {parseFloat(e.kmRealizado).toFixed(1)} km
                          </span>
                        )}
                        {e.kmTotal && <span className="font-medium text-brand-600">Total {parseFloat(e.kmTotal).toFixed(1)} km</span>}
                        <span className="ml-auto">{confirmadas}/{(e.locais || []).length} confirmadas</span>
                      </div>
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
                              <div className="text-[10px] text-gray-400">{moto.motoqueiro?.nome || '—'} · {moto.placa}</div>
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
                      <div className="text-[10px] text-gray-400 mb-1">KM estimado (loja → destinos → loja)</div>
                      {calculandoKm ? (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Loader2 size={13} className="animate-spin" />
                          <span className="text-sm">Calculando rota...</span>
                        </div>
                      ) : kmEstimado !== null ? (
                        <div className="text-lg font-semibold text-gray-800">~{kmEstimado} km</div>
                      ) : (
                        <div className="text-sm text-gray-400 italic">OSRM indisponível</div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={disparar}
                    disabled={!nf?.trim() || !motoSel || locaisSel.length === 0 || enviando}
                    className="w-full flex items-center justify-center gap-2 bg-brand-500 disabled:opacity-40 hover:bg-brand-600 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
                  >
                    {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {enviando ? 'Enviando…' : 'Disparar entrega'}
                  </button>
                </>
              )}
            </div>

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
                {linhaRota.length > 1 && (
                  <Polyline positions={linhaRota} pathOptions={{ color: '#185FA5', weight: 2, dashArray: '5,8', opacity: 0.6 }} />
                )}
              </MapContainer>
            </div>
          </div>
        )}
      </div>

      {/* Modal detalhes da entrega */}
      {entregaAberta && (
        <ModalEntrega
          entrega={entregaAberta}
          onClose={() => setEntregaAberta(null)}
          onAcao={executarAcao}
          onDeletar={(id) => { setEntregaAberta(null); setConfirmarDeletar(id); }}
          atualizando={atualizando}
        />
      )}

      {/* Modal confirmar deletar */}
      {confirmarDeletar && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} className="text-red-500" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800">Deletar entrega?</div>
                <div className="text-xs text-gray-400">Essa ação não pode ser desfeita</div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmarDeletar(null)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => deletarEntrega(confirmarDeletar)}
                disabled={deletando === confirmarDeletar}
                className="flex-1 py-2 bg-red-500 disabled:opacity-60 hover:bg-red-600 text-white rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5"
              >
                {deletando === confirmarDeletar ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}