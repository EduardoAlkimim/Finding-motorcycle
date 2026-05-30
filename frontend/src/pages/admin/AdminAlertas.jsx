import { useState, useEffect } from 'react';
import { Map, BarChart3, MapPin, Bell, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';
import Layout from '../../components/shared/Layout';
import { alertas as alertasApi } from '../../services/api';

const NAV = [
  { href: '/admin',            label: 'Mapa ao vivo', icon: Map },
  { href: '/admin/relatorios', label: 'Relatórios',   icon: BarChart3 },
  { href: '/admin/locais',     label: 'Locais',       icon: MapPin },
  { href: '/admin/alertas',    label: 'Alertas',      icon: Bell, badge: true },
];

const TIPO_CONFIG = {
  DESVIO_ROTA:         { label: 'Desvio de rota',     cor: 'bg-orange-50 border-orange-200', iconCor: 'text-orange-500' },
  CONFIRMACAO_SEM_GPS: { label: 'Confirmação sem GPS', cor: 'bg-red-50 border-red-200',       iconCor: 'text-red-500' },
  PARADA_LONGA:        { label: 'Parada longa',        cor: 'bg-yellow-50 border-yellow-200', iconCor: 'text-yellow-600' },
  MOTO_FORA_HORARIO:   { label: 'Fora do horário',     cor: 'bg-purple-50 border-purple-200', iconCor: 'text-purple-500' },
};

export default function AdminAlertas() {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    alertasApi.listar()
      .then(data => setAlertas(data))
      .catch(err => console.error('Erro ao carregar alertas:', err))
      .finally(() => setLoading(false));
  }, []);

  const marcarLido = async (id) => {
    try {
      await alertasApi.marcarLido(id);
      setAlertas(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a));
    } catch (err) {
      console.error('Erro ao marcar alerta:', err);
    }
  };

  const marcarTodos = async () => {
    const naoLidos = alertas.filter(a => !a.lido);
    await Promise.allSettled(naoLidos.map(a => alertasApi.marcarLido(a.id)));
    setAlertas(prev => prev.map(a => ({ ...a, lido: true })));
  };

  const naoLidos = alertas.filter(a => !a.lido);
  const lidos    = alertas.filter(a => a.lido);

  if (loading) {
    return (
      <Layout navItems={NAV}>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Carregando alertas…</div>
      </Layout>
    );
  }

  return (
    <Layout navItems={NAV}>
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Alertas</h1>
          <p className="text-xs text-gray-400">
            {naoLidos.length > 0
              ? `${naoLidos.length} alerta${naoLidos.length > 1 ? 's' : ''} não lido${naoLidos.length > 1 ? 's' : ''}`
              : 'Tudo em ordem'}
          </p>
        </div>
        {naoLidos.length > 0 && (
          <button onClick={marcarTodos} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            Marcar todos como lidos
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {alertas.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <CheckCircle2 size={40} className="mb-3 text-green-400" />
            <div className="text-sm font-medium">Nenhum alerta</div>
            <div className="text-xs mt-1">Tudo funcionando normalmente</div>
          </div>
        )}

        {naoLidos.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Não lidos</h2>
            <div className="space-y-2">
              {naoLidos.map(a => {
                const cfg = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.DESVIO_ROTA;
                return (
                  <div key={a.id} className={`rounded-xl p-4 border ${cfg.cor} flex items-start gap-3`}>
                    <AlertTriangle size={15} className={`${cfg.iconCor} mt-0.5 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${cfg.iconCor}`}>{cfg.label}</div>
                      <div className="text-sm text-gray-800 leading-relaxed">{a.descricao}</div>
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400">
                        <Clock size={10} />
                        {new Date(a.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button onClick={() => marcarLido(a.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {lidos.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Lidos</h2>
            <div className="space-y-2">
              {lidos.map(a => (
                <div key={a.id} className="rounded-xl p-4 border border-gray-100 bg-gray-50 flex items-start gap-3">
                  <CheckCircle2 size={15} className="text-gray-300 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 leading-relaxed">{a.descricao}</div>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400">
                      <Clock size={10} />
                      {new Date(a.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
