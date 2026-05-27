import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminMapa from './pages/admin/AdminMapa';
import AdminRelatorios from './pages/admin/AdminRelatorios';
import Despachante from './pages/despachante/Despachante';
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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/inicio" element={<RedirecionarPorPerfil />} />
          <Route path="/admin" element={<RotaProtegida perfis={['ADMIN']}><AdminMapa /></RotaProtegida>} />
          <Route path="/admin/relatorios" element={<RotaProtegida perfis={['ADMIN']}><AdminRelatorios /></RotaProtegida>} />
          <Route path="/despachante" element={<RotaProtegida perfis={['DESPACHANTE','ADMIN']}><Despachante /></RotaProtegida>} />
          <Route path="/motoqueiro" element={<RotaProtegida perfis={['MOTOQUEIRO']}><Motoqueiro /></RotaProtegida>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
