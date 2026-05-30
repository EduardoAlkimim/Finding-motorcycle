import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/shared/Layout';
import { Map, BarChart3, MapPin, Bell, Download, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { relatorios, motos as motosApi, usuarios as usuariosApi } from '../../services/api';

const NAV = [
  { href: '/admin',            label: 'Mapa ao vivo', icon: Map },
  { href: '/admin/relatorios', label: 'Relatórios',   icon: BarChart3 },
  { href: '/admin/locais',     label: 'Locais',       icon: MapPin },
  { href: '/admin/alertas',    label: 'Alertas',      icon: Bell, badge: true },
];

function DesvioIcon({ prev, real }) {
  if (!real || real === 0) return <Minus size={14} className="text-gray-300" />;
  const d = ((real - prev) / prev) * 100;
  if (d > 10) return <TrendingUp size={14} className="text-red-500" />;
  if (d < -5) return <TrendingDown size={14} className="text-green-600" />;
  return <Minus size={14} className="text-gray-400" />;
}

// Gera array de datas dos últimos N dias
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

export default function AdminRelatorios() {
  const [loading, setLoading]     = useState(true);
  const [motos, setMotos]         = useState([]);
  const [motoSel, setMotoSel]     = useState('todas');
  const [historico, setHistorico] = useState([]);
  const [locaisTop, setLocaisTop] = useState([]);
  const [resumo, setResumo]       = useState({ totalEntregas: 0, kmPrevisto: '0', kmRealizado: '0' });

  const carregar = useCallback(async () => {
    try {
      const motosData = await motosApi.listar();
      setMotos(motosData);

      // Últimos 7 dias
      const dias = ultimosDias(7);
      const resultados = await Promise.all(
        dias.map(data => relatorios.resumo({ data }).catch(() => null))
      );

      // Monta histórico por dia
      const hist = dias.map((data, i) => {
        const r = resultados[i];
        const row = { data: formatarData(data), entregas: 0 };
        if (r) {
          row.entregas = r.resumo?.totalEntregas || 0;
          // Por moto
          (r.porMotoqueiro || []).forEach(pm => {
            const moto = motosData.find(m => m.motoqueiroId === pm.motoqueiro?.id);
            if (moto) {
              row[`${moto.id}_prev`] = parseFloat(pm.kmPrevisto || 0);
              row[`${moto.id}_real`] = parseFloat(pm.kmRealizado || 0);
            }
          });
          // Locais visitados
          if (r.entregas) {
            r.entregas.forEach(e => {
              (e.locais || []).forEach(el => {
                if (el.local) {
                  const nome = el.local.nome;
                  const idx = row._locais?.findIndex(l => l.nome === nome) ?? -1;
                  if (!row._locais) row._locais = [];
                  if (idx === -1) row._locais.push({ nome, visitas: 1 });
                  else row._locais[idx].visitas++;
                }
              });
            });
          }
        }
        return row;
      });

      // Consolida locais mais visitados
      const locaisMap = {};
      hist.forEach(d => {
        (d._locais || []).forEach(({ nome, visitas }) => {
          locaisMap[nome] = (locaisMap[nome] || 0) + visitas;
        });
      });
      const topLocais = Object.entries(locaisMap)
        .map(([nome, visitas]) => ({ nome, visitas }))
        .sort((a, b) => b.visitas - a.visitas)
        .slice(0, 5);
      setLocaisTop(topLocais);

      setHistorico(hist);

      // Resumo geral
      const totalEntregas = hist.reduce((s, d) => s + d.entregas, 0);
      let totalPrev = 0, totalReal = 0;
      hist.forEach(d => {
        motosData.forEach(m => {
          totalPrev += d[`${m.id}_prev`] || 0;
          totalReal += d[`${m.id}_real`] || 0;
        });
      });
      setResumo({ totalEntregas, kmPrevisto: totalPrev.toFixed(0), kmRealizado: totalReal.toFixed(0) });
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const desvio = parseFloat(resumo.kmRealizado) - parseFloat(resumo.kmPrevisto);
  const maxKm = Math.max(
    ...historico.flatMap(d =>
      motos.flatMap(m => [d[`${m.id}_prev`] || 0, d[`${m.id}_real`] || 0])
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

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total de entregas',  valor: resumo.totalEntregas,              sub: 'últimos 7 dias',          cor: 'text-gray-900' },
            { label: 'KM total previsto',  valor: `${resumo.kmPrevisto} km`,         sub: 'estimado pelo OSRM',      cor: 'text-brand-600' },
            { label: 'KM total realizado', valor: `${resumo.kmRealizado} km`,        sub: 'registrado pelo GPS',     cor: desvio > 0 ? 'text-red-500' : 'text-green-600' },
            { label: 'Desvio acumulado',   valor: `${desvio >= 0 ? '+' : ''}${desvio.toFixed(1)} km`, sub: desvio >= 0 ? 'acima do previsto' : 'abaixo do previsto', cor: desvio > 0 ? 'text-red-500' : 'text-green-600' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-[11px] text-gray-400 mb-1">{c.label}</div>
              <div className={`text-xl font-semibold ${c.cor}`}>{c.valor}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Filtro de moto */}
        {motos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setMotoSel('todas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                motoSel === 'todas'
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              Todas as motos
            </button>
            {motos.map(m => (
              <button
                key={m.id}
                onClick={() => setMotoSel(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  motoSel === m.id
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
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
                      </>
                    ))}
                    <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Desvio</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((d, i) => {
                    const motosFiltradas = motoSel === 'todas' ? motos : motos.filter(m => m.id === motoSel);
                    const prev = motosFiltradas.reduce((s, m) => s + (d[`${m.id}_prev`] || 0), 0);
                    const real = motosFiltradas.reduce((s, m) => s + (d[`${m.id}_real`] || 0), 0);
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
                          </>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <DesvioIcon prev={prev} real={real} />
                            {real > 0 && (
                              <span className={`text-[11px] font-medium ${desvioLinha > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                {desvioLinha > 0 ? `+${desvioLinha.toFixed(1)}` : desvioLinha.toFixed(1)} km
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
                  <h3 className="text-sm font-semibold text-gray-800">
                    {moto.apelido} — {moto.motoqueiro?.nome || '—'}
                  </h3>
                </div>
                <div className="space-y-3">
                  {historico.filter(d => d.entregas > 0).map((d, i) => {
                    const prev = d[`${moto.id}_prev`] || 0;
                    const real = d[`${moto.id}_real`] || 0;
                    return (
                      <div key={i}>
                        <div className="text-[10px] text-gray-400 mb-1">{d.data}</div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-16 text-[10px] text-gray-400">Prev.</div>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full opacity-40" style={{ width: `${(prev / maxKm) * 100}%`, background: moto.cor || '#185FA5' }}></div>
                            </div>
                            <div className="w-12 text-[10px] text-gray-500 text-right">{prev.toFixed(1)}km</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 text-[10px] text-gray-400">Real.</div>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min((real / maxKm) * 100, 100)}%`, background: moto.cor || '#185FA5' }}></div>
                            </div>
                            <div className={`w-12 text-[10px] text-right font-medium ${real > prev ? 'text-red-500' : 'text-green-600'}`}>{real.toFixed(1)}km</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {historico.every(d => d.entregas === 0) && (
                    <div className="text-xs text-gray-400 py-2 text-center">Sem dados no período</div>
                  )}
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

        {motos.length === 0 && historico.every(d => d.entregas === 0) && (
          <div className="text-center py-16 text-gray-400">
            <BarChart3 size={36} className="mx-auto mb-3 text-gray-200" />
            <div className="text-sm">Nenhum dado disponível</div>
            <div className="text-xs mt-1">As entregas aparecerão aqui assim que forem registradas</div>
          </div>
        )}
      </div>
    </Layout>
  );
}
