import { useState } from 'react';
import Layout from '../../components/shared/Layout';
import { Map, BarChart3, Users, MapPin, Bell, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MOTOS, LOCAIS, ENTREGAS, ALERTAS } from '../../mock/data';

const NAV = [
  { href: '/admin',            label: 'Mapa ao vivo', icon: Map },
  { href: '/admin/relatorios', label: 'Relatórios',   icon: BarChart3 },
  { href: '/admin/usuarios',   label: 'Usuários',     icon: Users },
  { href: '/admin/locais',     label: 'Locais',       icon: MapPin },
  { href: '/admin/alertas',    label: 'Alertas',      icon: Bell, badge: true },
];

const HISTORICO = [
  { data: '19/05', m1Prev: 16.2, m1Real: 17.1, m2Prev: 12.4, m2Real: 12.2, entregas: 6 },
  { data: '20/05', m1Prev: 20.1, m1Real: 22.8, m2Prev: 15.0, m2Real: 14.8, entregas: 8 },
  { data: '21/05', m1Prev: 14.5, m1Real: 14.3, m2Prev: 11.2, m2Real: 11.5, entregas: 5 },
  { data: '22/05', m1Prev: 18.0, m1Real: 19.2, m2Prev: 13.5, m2Real: 13.0, entregas: 7 },
  { data: '23/05', m1Prev: 0,    m1Real: 0,    m2Prev: 0,    m2Real: 0,    entregas: 0 },
  { data: '24/05', m1Prev: 0,    m1Real: 0,    m2Prev: 0,    m2Real: 0,    entregas: 0 },
  { data: '25/05', m1Prev: 18.4, m1Real: 21.2, m2Prev: 14.1, m2Real: 13.8, entregas: 5 },
];

function DesvioIcon({ prev, real }) {
  if (!real || real === 0) return <Minus size={14} className="text-gray-300" />;
  const d = ((real - prev) / prev) * 100;
  if (d > 10) return <TrendingUp size={14} className="text-red-500" />;
  if (d < -5) return <TrendingDown size={14} className="text-green-600" />;
  return <Minus size={14} className="text-gray-400" />;
}

function BarraKm({ previsto, realizado, cor, max }) {
  const pW = (previsto / max) * 100;
  const rW = (realizado / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-16 text-[10px] text-gray-400">Prev.</div>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full opacity-40" style={{ width: `${pW}%`, background: cor }}></div>
        </div>
        <div className="w-12 text-[10px] text-gray-500 text-right">{previsto.toFixed(1)}km</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-16 text-[10px] text-gray-400">Real.</div>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(rW, 100)}%`, background: cor }}></div>
        </div>
        <div className={`w-12 text-[10px] text-right font-medium ${realizado > previsto ? 'text-red-500' : 'text-green-600'}`}>
          {realizado.toFixed(1)}km
        </div>
      </div>
    </div>
  );
}

export default function AdminRelatorios() {
  const [motoSel, setMotoSel] = useState('todas');

  const totalPrev = HISTORICO.reduce((s, d) => s + d.m1Prev + d.m2Prev, 0);
  const totalReal = HISTORICO.reduce((s, d) => s + d.m1Real + d.m2Real, 0);
  const maxKm = Math.max(...HISTORICO.map(d => Math.max(d.m1Prev, d.m1Real, d.m2Prev, d.m2Real)));

  return (
    <Layout navItems={NAV} titulo="Relatórios">
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Relatórios</h1>
          <p className="text-xs text-gray-400">Semana atual · 19–25 mai. 2026</p>
        </div>
        <button className="flex items-center gap-2 text-xs bg-brand-500 text-white px-3 py-2 rounded-lg hover:bg-brand-600 transition-colors">
          <Download size={13} /> Exportar PDF
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-5">
        {/* Cards de resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total de entregas', valor: HISTORICO.reduce((s, d) => s + d.entregas, 0), sub: 'na semana', cor: 'text-gray-900' },
            { label: 'KM total previsto', valor: `${totalPrev.toFixed(0)} km`, sub: 'estimado pelo OSRM', cor: 'text-brand-600' },
            { label: 'KM total realizado', valor: `${totalReal.toFixed(0)} km`, sub: 'registrado pelo GPS', cor: totalReal > totalPrev ? 'text-red-500' : 'text-green-600' },
            { label: 'Desvio acumulado', valor: `+${(totalReal - totalPrev).toFixed(1)} km`, sub: 'acima do previsto', cor: 'text-red-500' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-[11px] text-gray-400 mb-1">{c.label}</div>
              <div className={`text-xl font-semibold ${c.cor}`}>{c.valor}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Filtro de moto */}
        <div className="flex gap-2">
          {['todas', 'm1', 'm2'].map(id => (
            <button
              key={id}
              onClick={() => setMotoSel(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                motoSel === id
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {id === 'todas' ? 'Todas as motos' : MOTOS.find(m => m.id === id)?.apelido}
            </button>
          ))}
        </div>

        {/* Tabela histórico */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">KM previsto vs realizado — por dia</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Data</th>
                  <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Entregas</th>
                  {(motoSel === 'todas' || motoSel === 'm1') && (
                    <>
                      <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Moto 01 Prev.</th>
                      <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Moto 01 Real.</th>
                    </>
                  )}
                  {(motoSel === 'todas' || motoSel === 'm2') && (
                    <>
                      <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Moto 02 Prev.</th>
                      <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Moto 02 Real.</th>
                    </>
                  )}
                  <th className="text-left text-[11px] text-gray-400 px-4 py-2.5 font-medium">Desvio</th>
                </tr>
              </thead>
              <tbody>
                {HISTORICO.map((d, i) => {
                  const prev = (motoSel === 'todas' ? d.m1Prev + d.m2Prev : motoSel === 'm1' ? d.m1Prev : d.m2Prev);
                  const real = (motoSel === 'todas' ? d.m1Real + d.m2Real : motoSel === 'm1' ? d.m1Real : d.m2Real);
                  const desvio = real - prev;
                  return (
                    <tr key={i} className={`border-b border-gray-50 last:border-0 ${d.entregas === 0 ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3 text-xs font-medium text-gray-700">{d.data}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{d.entregas}</td>
                      {(motoSel === 'todas' || motoSel === 'm1') && (
                        <>
                          <td className="px-4 py-3 text-xs text-gray-500">{d.m1Prev > 0 ? `${d.m1Prev} km` : '—'}</td>
                          <td className="px-4 py-3 text-xs font-medium">
                            <span className={d.m1Real > d.m1Prev && d.m1Prev > 0 ? 'text-red-500' : 'text-green-600'}>
                              {d.m1Real > 0 ? `${d.m1Real} km` : '—'}
                            </span>
                          </td>
                        </>
                      )}
                      {(motoSel === 'todas' || motoSel === 'm2') && (
                        <>
                          <td className="px-4 py-3 text-xs text-gray-500">{d.m2Prev > 0 ? `${d.m2Prev} km` : '—'}</td>
                          <td className="px-4 py-3 text-xs font-medium">
                            <span className={d.m2Real > d.m2Prev && d.m2Prev > 0 ? 'text-red-500' : 'text-green-600'}>
                              {d.m2Real > 0 ? `${d.m2Real} km` : '—'}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <DesvioIcon prev={prev} real={real} />
                          {real > 0 && <span className={`text-[11px] font-medium ${desvio > 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {desvio > 0 ? `+${desvio.toFixed(1)}` : desvio.toFixed(1)} km
                          </span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gráfico de barras visual por moto */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {MOTOS.map(moto => (
            <div key={moto.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 rounded-full" style={{ background: moto.cor }}></span>
                <h3 className="text-sm font-semibold text-gray-800">{moto.apelido} — {moto.motoqueiro}</h3>
              </div>
              <div className="space-y-3">
                {HISTORICO.filter(d => d.entregas > 0).map((d, i) => (
                  <div key={i}>
                    <div className="text-[10px] text-gray-400 mb-1">{d.data}</div>
                    <BarraKm
                      previsto={moto.id === 'm1' ? d.m1Prev : d.m2Prev}
                      realizado={moto.id === 'm1' ? d.m1Real : d.m2Real}
                      cor={moto.cor}
                      max={maxKm}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Locais mais visitados */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Locais mais visitados</h2>
          <div className="space-y-2">
            {LOCAIS.slice(0, 5).map((local, i) => {
              const visitas = ENTREGAS.flatMap(e => e.locais).filter(el => el.localId === local.id).length;
              return (
                <div key={local.id} className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium">{local.nome}</span>
                      <span className="text-gray-400">{visitas} visita{visitas !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-full bg-brand-400 rounded-full" style={{ width: `${(visitas / 3) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
