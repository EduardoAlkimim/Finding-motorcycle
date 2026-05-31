import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { Map, BarChart3, MapPin, Bell, Download, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { relatorios, motos as motosApi, entregas as entregasApi } from '../../services/api';

const NAV = [
  { href: '/admin',            label: 'Mapa ao vivo', icon: Map },
  { href: '/admin/relatorios', label: 'Relatórios',   icon: BarChart3 },
  { href: '/admin/locais',     label: 'Locais',       icon: MapPin },
  { href: '/admin/alertas',    label: 'Alertas',      icon: Bell, badge: true },
];

const STATUS_CONFIG = {
  PENDENTE:      { label: 'Pendente',      cor: 'bg-gray-100 text-gray-500' },
  EM_ROTA:       { label: 'Em rota',       cor: 'bg-blue-50 text-blue-600' },
  CONCLUIDA:     { label: 'Concluída',     cor: 'bg-yellow-50 text-yellow-600' },
  VOLTANDO_LOJA: { label: 'Voltando loja', cor: 'bg-orange-50 text-orange-600' },
  FINALIZADA:    { label: 'Finalizada',    cor: 'bg-green-100 text-green-700' },
  CANCELADA:     { label: 'Cancelada',     cor: 'bg-red-50 text-red-500' },
};

function DesvioIcon({ prev, real }) {
  if (!real || real === 0) return <Minus size={14} className="text-gray-300" />;
  const d = ((real - prev) / prev) * 100;
  if (d > 10) return <TrendingUp size={14} className="text-red-500" />;
  if (d < -5) return <TrendingDown size={14} className="text-green-600" />;
  return <Minus size={14} className="text-gray-400" />;
}

function ultimosDias(n) {
  const dias = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dias.push(d.toISOString().split('T')[0]);
  }
  return dias;
}

function formatarData(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function km(val) {
  if (!val && val !== 0) return '—';
  return `${parseFloat(val).toFixed(1)} km`;
}

function formatarHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Modal de relatório individual da entrega ────────────────────────────────
function ModalRelatorio({ entrega, onClose }) {
  if (!entrega) return null;
  const cfg = STATUS_CONFIG[entrega.status] || STATUS_CONFIG.PENDENTE;
  const confirmadas = (entrega.locais || []).filter(l => l.status === 'CONFIRMADO').length;

  const kmPrev   = parseFloat(entrega.kmPrevisto || 0);
  const kmReal   = parseFloat(entrega.kmRealizado || 0);
  const kmRetPrev= parseFloat(entrega.kmRetornoPrevisto || 0);
  const kmRet    = parseFloat(entrega.kmRetorno || 0);
  const kmTotal  = parseFloat(entrega.kmTotal || 0);
  const desvio   = kmReal - kmPrev;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-semibold text-gray-900 font-mono">{entrega.notaFiscal}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.cor}`}>{cfg.label}</span>
            </div>
            {entrega.moto && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: entrega.moto.cor || '#185FA5' }}></span>
                <span className="text-xs text-gray-400">{entrega.moto.apelido} · {entrega.motoqueiro?.nome || '—'}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all text-xs font-medium">
            Fechar
          </button>
        </div>

        {/* KM detalhado */}
        <div className="p-5 border-b border-gray-100">
          <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-3">Quilometragem</div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">KM previsto entregas</span>
              <span className="text-xs font-medium text-gray-800">{km(kmPrev)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">KM realizado entregas</span>
              <span className={`text-xs font-medium ${kmReal > kmPrev ? 'text-red-500' : 'text-green-600'}`}>{km(kmReal)}</span>
            </div>
            {desvio !== 0 && kmReal > 0 && (
              <div className="flex justify-between items-center pl-3 border-l-2 border-gray-100">
                <span className="text-[10px] text-gray-400">Desvio</span>
                <span className={`text-[10px] font-medium ${desvio > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {desvio > 0 ? '+' : ''}{desvio.toFixed(1)} km
                </span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">KM previsto retorno</span>
              <span className="text-xs font-medium text-gray-800">{km(kmRetPrev)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">KM realizado retorno</span>
              <span className="text-xs font-medium text-gray-800">{km(kmRet)}</span>
            </div>
            {kmTotal > 0 && (
              <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-700">Total percorrido</span>
                <span className="text-sm font-bold text-brand-600">{km(kmTotal)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Paradas */}
        <div className="p-5 border-b border-gray-100">
          <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-3">Paradas ({confirmadas}/{(entrega.locais||[]).length})</div>
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
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-800">{local.nome}</div>
                    {el.chegouEm && (
                      <div className="text-[10px] text-gray-400">
                        {formatarHora(el.chegouEm)} — {el.status === 'CONFIRMADO' ? `Confirmado ${formatarHora(el.confirmadoEm)}` : el.status}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        <div className="p-5">
          <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-3">Timeline</div>
          <div className="space-y-1.5 text-[11px]">
            {[
              { label: 'Criada',              val: entrega.criadoEm },
              { label: 'Saída',               val: entrega.saidaEm },
              { label: 'Entregas concluídas', val: entrega.chegadaEm },
              { label: 'Retorno iniciado',    val: entrega.retornoIniciadoEm },
              { label: 'Finalizada',          val: entrega.finalizadoEm },
            ].filter(t => t.val).map(({ label, val }) => (
              <div key={label} className="flex justify-between text-gray-600">
                <span className="text-gray-400">{label}</span>
                <span className="font-medium">{formatarHora(val)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function AdminRelatorios() {
  const [loading, setLoading]           = useState(true);
  const [motos, setMotos]               = useState([]);
  const [motoSel, setMotoSel]           = useState('todas');
  const [historico, setHistorico]       = useState([]);
  const [locaisTop, setLocaisTop]       = useState([]);
  const [resumo, setResumo]             = useState({ totalEntregas: 0, kmPrevisto: '0', kmRealizado: '0', kmTotal: '0' });
  const [entregasHoje, setEntregasHoje] = useState([]);
  const [entregaModal, setEntregaModal] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const motosData = await motosApi.listar();
      setMotos(motosData);

      // Entregas de hoje para o relatório individual
      const hoje = new Date().toISOString().split('T')[0];
      const entregasData = await entregasApi.listar({ data: hoje });
      setEntregasHoje(entregasData);

      const dias = ultimosDias(7);
      const resultados = await Promise.all(
        dias.map(data => relatorios.resumo({ data }).catch(() => null))
      );

      const hist = dias.map((data, i) => {
        const r = resultados[i];
        const row = { data: formatarData(data), entregas: 0 };
        if (r) {
          row.entregas = r.resumo?.totalEntregas || 0;
          (r.porMotoqueiro || []).forEach(pm => {
            const moto = motosData.find(m => m.motoqueiroId === pm.motoqueiro?.id);
            if (moto) {
              row[`${moto.id}_prev`]  = parseFloat(pm.kmPrevisto || 0);
              row[`${moto.id}_real`]  = parseFloat(pm.kmRealizado || 0);
              row[`${moto.id}_ret`]   = parseFloat(pm.kmRetorno || 0);
              row[`${moto.id}_total`] = parseFloat(pm.kmTotal || 0);
            }
          });
          if (r.entregas) {
            r.entregas.forEach(e => {
              (e.locais || []).forEach(el => {
                if (el.local) {
                  const nome = el.local.nome;
                  if (!row._locais) row._locais = [];
                  const idx = row._locais.findIndex(l => l.nome === nome);
                  if (idx === -1) row._locais.push({ nome, visitas: 1 });
                  else row._locais[idx].visitas++;
                }
              });
            });
          }
        }
        return row;
      });

      const locaisMap = {};
      hist.forEach(d => {
        (d._locais || []).forEach(({ nome, visitas }) => {
          locaisMap[nome] = (locaisMap[nome] || 0) + visitas;
        });
      });
      setLocaisTop(
        Object.entries(locaisMap)
          .map(([nome, visitas]) => ({ nome, visitas }))
          .sort((a, b) => b.visitas - a.visitas)
          .slice(0, 5)
      );

      setHistorico(hist);

      const totalEntregas = hist.reduce((s, d) => s + d.entregas, 0);
      let totalPrev = 0, totalReal = 0, totalKmTotal = 0;
      hist.forEach(d => {
        motosData.forEach(m => {
          totalPrev     += d[`${m.id}_prev`]  || 0;
          totalReal     += d[`${m.id}_real`]  || 0;
          totalKmTotal  += d[`${m.id}_total`] || 0;
        });
      });
      setResumo({
        totalEntregas,
        kmPrevisto:  totalPrev.toFixed(0),
        kmRealizado: totalReal.toFixed(0),
        kmTotal:     totalKmTotal.toFixed(0),
      });
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const desvio = parseFloat(resumo.kmRealizado) - parseFloat(resumo.kmPrevisto);
  const maxKm  = Math.max(
    ...historico.flatMap(d =>
      motos.flatMap(m => [d[`${m.id}_prev`] || 0, d[`${m.id}_real`] || 0, d[`${m.id}_total`] || 0])
    ),
    1
  );

  if (loading) {
    return (
      <Layout navItems={NAV}>
        <div className="flex-1 flex items-center justify-center gap-2 text-gray-400 text-sm">
          <Loader2 size={16} className="animate-spin" /> Carregando relatórios…
        </div>
      </Layout>
    );
  }

  return (
    <Layout navItems={NAV}>
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Relatórios</h1>
          <p className="text-xs text-gray-400">Últimos 7 dias</p>
        </div>
        <button className="flex items-center gap-2 text-xs bg-brand-500 text-white px-3 py-2 rounded-lg hover:bg-brand-600 transition-colors">
          <Download size={13} /> Exportar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-5">

        {/* Cards resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total de entregas',  valor: resumo.totalEntregas,              sub: 'últimos 7 dias',          cor: 'text-gray-900' },
            { label: 'KM previsto',        valor: `${resumo.kmPrevisto} km`,         sub: 'estimado pelo OSRM',      cor: 'text-brand-600' },
            { label: 'KM realizado',       valor: `${resumo.kmRealizado} km`,        sub: 'só entregas',             cor: desvio > 0 ? 'text-red-500' : 'text-green-600' },
            { label: 'KM total c/ retorno',valor: `${resumo.kmTotal} km`,            sub: 'entregas + volta loja',   cor: 'text-gray-800' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-[11px] text-gray-400 mb-1">{c.label}</div>
              <div className={`text-xl font-semibold ${c.cor}`}>{c.valor}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Entregas de hoje — relatório individual */}
        {entregasHoje.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Entregas de hoje — clique para detalhar</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {entregasHoje.map(e => {
                const cfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.PENDENTE;
                const confirmadas = (e.locais || []).filter(l => l.status === 'CONFIRMADO').length;
                return (
                  <button
                    key={e.id}
                    onClick={() => setEntregaModal(e)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-800 font-mono">{e.notaFiscal}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.cor}`}>{cfg.label}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {e.moto?.apelido || '—'} · {confirmadas}/{(e.locais||[]).length} paradas
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {e.kmTotal ? (
                        <div className="text-xs font-semibold text-brand-600">{parseFloat(e.kmTotal).toFixed(1)} km</div>
                      ) : e.kmRealizado ? (
                        <div className="text-xs font-medium text-gray-700">{parseFloat(e.kmRealizado).toFixed(1)} km</div>
                      ) : e.kmPrevisto ? (
                        <div className="text-xs text-gray-400">~{parseFloat(e.kmPrevisto).toFixed(1)} km</div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtro de moto */}
        {motos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setMotoSel('todas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                motoSel === 'todas' ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              Todas as motos
            </button>
            {motos.map(m => (
              <button
                key={m.id}
                onClick={() => setMotoSel(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  motoSel === m.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {m.apelido}
              </button>
            ))}
          </div>
        )}

        {/* Tabela histórico */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">KM previsto vs realizado — por dia</h2>
          </div>
          {historico.every(d => d.entregas === 0) ? (
            <div className="py-10 text-center text-gray-400 text-sm">Nenhuma entrega nos últimos 7 dias</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Data</th>
                    <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Entregas</th>
                    {(motoSel === 'todas' ? motos : motos.filter(m => m.id === motoSel)).map(m => (
                      <>
                        <th key={`${m.id}_prev`} className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">{m.apelido} Prev.</th>
                        <th key={`${m.id}_real`} className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">{m.apelido} Real.</th>
                        <th key={`${m.id}_total`} className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">{m.apelido} Total</th>
                      </>
                    ))}
                    <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Desvio</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((d, i) => {
                    const motosFiltradas = motoSel === 'todas' ? motos : motos.filter(m => m.id === motoSel);
                    const prev  = motosFiltradas.reduce((s, m) => s + (d[`${m.id}_prev`]  || 0), 0);
                    const real  = motosFiltradas.reduce((s, m) => s + (d[`${m.id}_real`]  || 0), 0);
                    const total = motosFiltradas.reduce((s, m) => s + (d[`${m.id}_total`] || 0), 0);
                    const desvioLinha = real - prev;
                    return (
                      <tr key={i} className={`border-b border-gray-50 last:border-0 ${d.entregas === 0 ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-3 text-xs font-medium text-gray-700">{d.data}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{d.entregas}</td>
                        {motosFiltradas.map(m => (
                          <>
                            <td key={`${m.id}_p`} className="px-4 py-3 text-xs text-gray-500">
                              {(d[`${m.id}_prev`] || 0) > 0 ? `${(d[`${m.id}_prev`] || 0).toFixed(1)} km` : '—'}
                            </td>
                            <td key={`${m.id}_r`} className="px-4 py-3 text-xs font-medium">
                              <span className={(d[`${m.id}_real`] || 0) > (d[`${m.id}_prev`] || 0) && (d[`${m.id}_prev`] || 0) > 0 ? 'text-red-500' : 'text-green-600'}>
                                {(d[`${m.id}_real`] || 0) > 0 ? `${(d[`${m.id}_real`] || 0).toFixed(1)} km` : '—'}
                              </span>
                            </td>
                            <td key={`${m.id}_t`} className="px-4 py-3 text-xs font-semibold text-brand-600">
                              {(d[`${m.id}_total`] || 0) > 0 ? `${(d[`${m.id}_total`] || 0).toFixed(1)} km` : '—'}
                            </td>
                          </>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <DesvioIcon prev={prev} real={real} />
                            {real > 0 && (
                              <span className={`text-[11px] font-medium ${desvioLinha > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                {desvioLinha > 0 ? '+' : ''}{desvioLinha.toFixed(1)} km
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Gráfico por moto */}
        {motos.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(motoSel === 'todas' ? motos : motos.filter(m => m.id === motoSel)).map(moto => (
              <div key={moto.id} className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-3 h-3 rounded-full" style={{ background: moto.cor || '#185FA5' }}></span>
                  <h3 className="text-sm font-semibold text-gray-800">{moto.apelido} — {moto.motoqueiro?.nome || '—'}</h3>
                </div>
                <div className="space-y-3">
                  {historico.filter(d => d.entregas > 0).map((d, i) => {
                    const prev  = d[`${moto.id}_prev`]  || 0;
                    const real  = d[`${moto.id}_real`]  || 0;
                    const total = d[`${moto.id}_total`] || 0;
                    return (
                      <div key={i}>
                        <div className="text-[10px] text-gray-400 mb-1">{d.data}</div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-14 text-[10px] text-gray-400">Prev.</div>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full opacity-40" style={{ width: `${(prev / maxKm) * 100}%`, background: moto.cor || '#185FA5' }}></div>
                            </div>
                            <div className="w-12 text-[10px] text-gray-500 text-right">{prev.toFixed(1)}km</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-14 text-[10px] text-gray-400">Real.</div>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min((real / maxKm) * 100, 100)}%`, background: moto.cor || '#185FA5' }}></div>
                            </div>
                            <div className={`w-12 text-[10px] text-right font-medium ${real > prev ? 'text-red-500' : 'text-green-600'}`}>{real.toFixed(1)}km</div>
                          </div>
                          {total > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="w-14 text-[10px] text-gray-400">Total</div>
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full opacity-60" style={{ width: `${Math.min((total / maxKm) * 100, 100)}%`, background: moto.cor || '#185FA5' }}></div>
                              </div>
                              <div className="w-12 text-[10px] text-right font-semibold text-brand-600">{total.toFixed(1)}km</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Locais mais visitados */}
        {locaisTop.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Locais mais visitados</h2>
            <div className="space-y-2">
              {locaisTop.map((local, i) => (
                <div key={local.nome} className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium">{local.nome}</span>
                      <span className="text-gray-400">{local.visitas} visita{local.visitas !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-full bg-brand-400 rounded-full" style={{ width: `${(local.visitas / locaisTop[0].visitas) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {entregaModal && (
        <ModalRelatorio entrega={entregaModal} onClose={() => setEntregaModal(null)} />
      )}
    </Layout>
  );
}
