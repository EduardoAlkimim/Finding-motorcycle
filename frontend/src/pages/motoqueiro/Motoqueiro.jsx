import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, MapPin, Package, Navigation, LogOut, Loader2 } from 'lucide-react';
import { entregas as entregasApi } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const STATUS_PARADA = {
  PENDENTE:   { label: 'Pendente',   bg: 'bg-gray-100',  text: 'text-gray-500',  dot: 'bg-gray-300' },
  CHEGOU:     { label: 'Chegou',     bg: 'bg-blue-50',   text: 'text-blue-600',  dot: 'bg-blue-500' },
  CONFIRMADO: { label: 'Entregue',   bg: 'bg-green-50',  text: 'text-green-600', dot: 'bg-green-500' },
  PROBLEMA:   { label: 'Problema',   bg: 'bg-red-50',    text: 'text-red-600',   dot: 'bg-red-500' },
};

export default function Motoqueiro() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading]           = useState(true);
  const [entregas, setEntregas]         = useState([]);
  const [entregaAtiva, setEntregaAtiva] = useState(null);
  const [confirmando, setConfirmando]   = useState(null);

  const carregar = useCallback(async () => {
    try {
      const data = await entregasApi.listar({ data: new Date().toISOString().split('T')[0] });
      // Só as que são do motoqueiro logado e não concluídas
      const minhas = data.filter(e =>
        e.motoqueiroId === usuario?.id && e.status !== 'CONCLUIDA' && e.status !== 'CANCELADA'
      );
      setEntregas(minhas);
      // Se tinha uma ativa e ainda existe, mantém
      if (entregaAtiva) {
        const ainda = minhas.find(e => e.id === entregaAtiva.id);
        if (ainda) setEntregaAtiva(ainda);
        else setEntregaAtiva(null);
      }
    } catch (err) {
      console.error('Erro ao carregar entregas:', err);
    } finally {
      setLoading(false);
    }
  }, [usuario?.id, entregaAtiva]);

  useEffect(() => {
    carregar();
    const iv = setInterval(carregar, 30_000);
    return () => clearInterval(iv);
  }, []);  // eslint-disable-line

  const iniciarEntrega = async (entrega) => {
    try {
      await entregasApi.iniciar(entrega.id);
      setEntregaAtiva(entrega);
      await carregar();
    } catch (err) {
      console.error('Erro ao iniciar entrega:', err);
    }
  };

  const confirmarParada = async (entregaId, localEntregaId) => {
    setConfirmando(localEntregaId);
    try {
      await entregasApi.confirmarLocal(entregaId, localEntregaId);
      await carregar();
    } catch (err) {
      console.error('Erro ao confirmar parada:', err);
    } finally {
      setConfirmando(null);
    }
  };

  const concluirEntrega = async (entregaId) => {
    try {
      await entregasApi.concluir(entregaId);
      setEntregaAtiva(null);
      await carregar();
    } catch (err) {
      console.error('Erro ao concluir entrega:', err);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const entregaAtivaObj = entregaAtiva
    ? (entregas.find(e => e.id === entregaAtiva.id) || entregaAtiva)
    : null;

  const outrasEntregas = entregas.filter(e => e.id !== entregaAtivaObj?.id);

  const paradasAtivas = entregaAtivaObj?.locais || [];
  const totalConfirmadas = paradasAtivas.filter(p => p.status === 'CONFIRMADO').length;
  const todasConfirmadas = paradasAtivas.length > 0 && totalConfirmadas === paradasAtivas.length;

  // Stats do cabeçalho
  const totalParadas = entregas.reduce((s, e) => s + (e.locais?.length || 0), 0);
  const totalConfirmGeral = entregas.reduce((s, e) =>
    s + (e.locais?.filter(l => l.status === 'CONFIRMADO').length || 0), 0
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-sm mx-auto">
      {/* Header mobile */}
      <div className="bg-brand-500 text-white px-4 pt-10 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
              {usuario?.nome?.[0]}
            </div>
            <div>
              <div className="text-sm font-semibold">{usuario?.nome?.split(' ')[0]}</div>
              <div className="text-white/60 text-xs">Motoqueiro</div>
            </div>
          </div>
          <button onClick={handleLogout} className="text-white/60 hover:text-white">
            <LogOut size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Entregas',   valor: entregas.length },
            { label: 'Paradas',    valor: totalParadas },
            { label: 'Confirmadas', valor: totalConfirmGeral },
          ].map(c => (
            <div key={c.label} className="bg-white/15 rounded-xl p-2.5 text-center">
              <div className="text-xl font-semibold">{c.valor}</div>
              <div className="text-white/60 text-[10px]">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Entrega ativa */}
        {entregaAtivaObj && (
          <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
            <div className="bg-brand-50 px-4 py-3 flex items-center justify-between border-b border-brand-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-brand-700">Em andamento</span>
              </div>
              <span className="text-xs font-mono text-brand-600">{entregaAtivaObj.notaFiscal}</span>
            </div>

            <div className="p-4 space-y-3">
              {paradasAtivas.map((parada, i) => {
                const local = parada.local;
                const cfg = STATUS_PARADA[parada.status] || STATUS_PARADA.PENDENTE;
                const isProxima = parada.status === 'PENDENTE' &&
                  paradasAtivas.slice(0, i).every(p => p.status === 'CONFIRMADO');

                return (
                  <div key={parada.id} className={`rounded-xl p-3 ${cfg.bg} border ${
                    parada.status === 'CONFIRMADO' ? 'border-green-100' :
                    isProxima ? 'border-brand-200' : 'border-gray-100'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        parada.status === 'CONFIRMADO' ? 'bg-green-500 text-white' :
                        isProxima ? 'bg-brand-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {parada.status === 'CONFIRMADO' ? '✓' : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{local?.nome || '—'}</div>
                        <div className="text-[11px] text-gray-500 truncate">{local?.endereco || ''}</div>
                        {parada.confirmadoEm && (
                          <div className="text-[10px] text-green-600 mt-0.5">
                            ✓ Confirmado às {new Date(parada.confirmadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>

                    {isProxima && (
                      <div className="mt-3 flex gap-2">
                        {local?.lat && local?.lng && (
                          <a
                            href={`https://maps.google.com/?q=${local.lat},${local.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-500 text-white text-xs rounded-lg font-medium"
                          >
                            <Navigation size={12} /> Navegar
                          </a>
                        )}
                        <button
                          onClick={() => confirmarParada(entregaAtivaObj.id, parada.id)}
                          disabled={confirmando === parada.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500 disabled:opacity-60 text-white text-xs rounded-lg font-medium"
                        >
                          {confirmando === parada.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <CheckCircle2 size={12} />
                          }
                          Confirmar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {todasConfirmadas && (
                <button
                  onClick={() => concluirEntrega(entregaAtivaObj.id)}
                  className="w-full py-3 bg-green-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} /> Finalizar entrega
                </button>
              )}

              <div className="flex justify-between text-[11px] text-gray-400 pt-1">
                <span>{totalConfirmadas}/{paradasAtivas.length} confirmadas</span>
                {entregaAtivaObj?.kmPrevisto && <span>~{entregaAtivaObj.kmPrevisto} km estimados</span>}
              </div>
            </div>
          </div>
        )}

        {/* Lista de entregas pendentes */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {entregaAtivaObj ? 'Outras entregas' : 'Minhas entregas'}
          </h2>
          <div className="space-y-2">
            {outrasEntregas.map(e => {
              const locaisE = (e.locais || []).map(el => el.local).filter(Boolean);
              return (
                <div key={e.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900 font-mono">{e.notaFiscal}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {(e.locais || []).length} parada{(e.locais || []).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1 mb-3">
                    {locaisE.slice(0, 2).map((l, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-gray-500">
                        <MapPin size={10} className="text-gray-300 flex-shrink-0" />
                        <span className="truncate">{l.nome}</span>
                      </div>
                    ))}
                    {locaisE.length > 2 && (
                      <div className="text-[10px] text-gray-400 pl-4">+{locaisE.length - 2} mais</div>
                    )}
                  </div>
                  {e.kmPrevisto && (
                    <div className="text-[10px] text-gray-400 mb-3">~{e.kmPrevisto} km estimados</div>
                  )}
                  <button
                    onClick={() => iniciarEntrega(e)}
                    disabled={!!entregaAtivaObj}
                    className="w-full py-2.5 bg-brand-500 disabled:opacity-40 hover:bg-brand-600 text-white text-xs rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Package size={13} /> Iniciar entrega
                  </button>
                </div>
              );
            })}

            {entregas.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <CheckCircle2 size={36} className="mx-auto mb-2 text-green-400" />
                <div className="text-sm font-medium">Tudo entregue!</div>
                <div className="text-xs">Nenhuma entrega pendente</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
