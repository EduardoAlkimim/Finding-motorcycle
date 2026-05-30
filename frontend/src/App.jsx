import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertasProvider } from './context/AlertasContext';
import Login from './pages/Login';
import AdminMapa from './pages/admin/AdminMapa';
import AdminRelatorios from './pages/admin/AdminRelatorios';
import AdminLocais from './pages/admin/AdminLocais';
import AdminAlertas from './pages/admin/AdminAlertas';
import Despachante from './pages/despachante/Despachante';
import DespachanteMapa from './pages/despachante/DespachanteMapa';
import DespachanteAlertas from './pages/despachante/DespachanteLertas';
import Motoqueiro from './pages/motoqueiro/Motoqueiro';

function RotaProtegida({ children, perfis }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/" replace />;
  if (perfis && !perfis.includes(usuario.perfil)) return <Navigate to="/" replace />;
  return children;
}

function RedirecionarPorPerfil() {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/" replace />;
  const rotas = { ADMIN: '/admin', DESPACHANTE: '/despachante', MOTOQUEIRO: '/motoqueiro' };
  return <Navigate to={rotas[usuario.perfil] || '/'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <AlertasProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/inicio" element={<RedirecionarPorPerfil />} />

            {/* Admin */}
            <Route path="/admin" element={<RotaProtegida perfis={['ADMIN']}><AdminMapa /></RotaProtegida>} />
            <Route path="/admin/relatorios" element={<RotaProtegida perfis={['ADMIN']}><AdminRelatorios /></RotaProtegida>} />
            <Route path="/admin/locais" element={<RotaProtegida perfis={['ADMIN']}><AdminLocais /></RotaProtegida>} />
            <Route path="/admin/alertas" element={<RotaProtegida perfis={['ADMIN']}><AdminAlertas /></RotaProtegida>} />

            {/* Despachante */}
            <Route path="/despachante" element={<RotaProtegida perfis={['DESPACHANTE','ADMIN']}><Despachante /></RotaProtegida>} />
            <Route path="/despachante/mapa" element={<RotaProtegida perfis={['DESPACHANTE','ADMIN']}><DespachanteMapa /></RotaProtegida>} />
            <Route path="/despachante/alertas" element={<RotaProtegida perfis={['DESPACHANTE','ADMIN']}><DespachanteAlertas /></RotaProtegida>} />

            {/* Motoqueiro */}
            <Route path="/motoqueiro" element={<RotaProtegida perfis={['MOTOQUEIRO']}><Motoqueiro /></RotaProtegida>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AlertasProvider>
    </AuthProvider>
  );
}
