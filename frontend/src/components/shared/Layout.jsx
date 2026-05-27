import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { ALERTAS } from '../../mock/data';

export default function Layout({ children, navItems, titulo }) {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const alertasNaoLidos = ALERTAS.filter(a => !a.lido).length;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-[220px] bg-white border-r border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-sm">🏍️</div>
          <div>
            <div className="text-sm font-semibold text-gray-900 leading-tight">AutoParts</div>
            <div className="text-xs text-gray-400">Tracker</div>
          </div>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map(item => {
            const ativo = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all mb-0.5 ${
                  ativo
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <item.icon size={17} />
                <span className="text-sm font-medium">{item.label}</span>
                {item.badge && alertasNaoLidos > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {alertasNaoLidos}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center text-xs font-semibold text-brand-600">
              {usuario?.nome?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-800 truncate">{usuario?.nome}</div>
              <div className="text-[10px] text-gray-400 capitalize">{usuario?.perfil?.toLowerCase()}</div>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🏍️</span>
          <span className="text-sm font-semibold text-gray-900">AutoParts</span>
        </div>
        <div className="flex items-center gap-2">
          {alertasNaoLidos > 0 && (
            <div className="relative">
              <Bell size={20} className="text-gray-500" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full">{alertasNaoLidos}</span>
            </div>
          )}
          <button onClick={() => setMenuAberto(!menuAberto)} className="text-gray-500">
            {menuAberto ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuAberto && (
        <div className="lg:hidden fixed inset-0 z-20 bg-white pt-14">
          <nav className="py-4">
            {navItems.map(item => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMenuAberto(false)}
                className={`flex items-center gap-3 px-6 py-3.5 ${
                  location.pathname === item.href
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-gray-600'
                }`}
              >
                <item.icon size={18} />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="absolute bottom-8 left-0 right-0 px-6">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 border border-red-200 text-red-500 rounded-xl"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <main className="flex-1 flex flex-col overflow-hidden lg:pt-0 pt-14">
        {children}
      </main>
    </div>
  );
}
