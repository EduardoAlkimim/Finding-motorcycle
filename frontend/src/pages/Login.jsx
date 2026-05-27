import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Truck, MapPin, BarChart3, Route, Eye, EyeOff } from 'lucide-react';

const PERFIS = [
  { key: 'ADMIN',       label: 'Admin',       email: 'admin@autopecas.com',       icon: '🛡️', desc: 'Visão geral e relatórios' },
  { key: 'DESPACHANTE', label: 'Despachante', email: 'despachante@autopecas.com', icon: '📋', desc: 'Montar rotas e entregas' },
  { key: 'MOTOQUEIRO',  label: 'Motoqueiro',  email: 'moto1@autopecas.com',       icon: '🏍️', desc: 'Minhas entregas do dia' },
];

const ROTAS = { ADMIN: '/admin', DESPACHANTE: '/despachante', MOTOQUEIRO: '/motoqueiro' };

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [perfilSel, setPerfilSel] = useState('DESPACHANTE');
  const [email, setEmail] = useState('despachante@autopecas.com');
  const [senha, setSenha] = useState('123456');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const selecionarPerfil = (p) => {
    setPerfilSel(p.key);
    setEmail(p.email);
    setErro('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const user = await login(email, senha);
      navigate(ROTAS[user.perfil]);
    } catch (err) {
      setErro('E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-brand-500 p-10 text-white flex-shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl">🏍️</div>
            <div>
              <div className="font-semibold text-lg leading-tight">AutoParts Tracker</div>
              <div className="text-white/50 text-xs">Sistema de entregas</div>
            </div>
          </div>
          <h1 className="text-3xl font-semibold leading-tight mb-4">
            Controle total das suas entregas
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Rastreie em tempo real, gerencie rotas e acompanhe cada entrega com precisão.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { icon: MapPin,   label: 'GPS em tempo real',         sub: 'Tracker físico nas motos' },
            { icon: Route,    label: 'KM previsto vs realizado',  sub: 'Anti-fraude automático' },
            { icon: BarChart3, label: 'Relatórios completos',    sub: 'Por motoqueiro e período' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-white/80" />
              </div>
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-white/50 text-xs">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lado direito */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900">Entrar</h2>
            <p className="text-gray-500 text-sm mt-1">Selecione seu perfil para continuar</p>
          </div>

          {/* Seleção de perfil */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {PERFIS.map(p => (
              <button
                key={p.key}
                onClick={() => selecionarPerfil(p)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                  perfilSel === p.key
                    ? 'border-brand-500 bg-brand-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-xl">{p.icon}</span>
                <span className={`text-xs font-medium ${perfilSel === p.key ? 'text-brand-600' : 'text-gray-600'}`}>
                  {p.label}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-all"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-all pr-10"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-600">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Truck size={16} />
              )}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Senha padrão: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">123456</span>
          </p>
        </div>
      </div>
    </div>
  );
}
