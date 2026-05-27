import { createContext, useContext, useState } from 'react';
import { auth } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const salvo = localStorage.getItem('ap_usuario');
    return salvo ? JSON.parse(salvo) : null;
  });

  // Faz login real na API e guarda o token JWT
  const login = async (email, senha) => {
    const data = await auth.login(email, senha); // { token, usuario }
    localStorage.setItem('ap_token', data.token);
    localStorage.setItem('ap_usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  };

  const logout = () => {
    setUsuario(null);
    localStorage.removeItem('ap_token');
    localStorage.removeItem('ap_usuario');
  };

  return (
    <AuthContext.Provider value={{ usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);