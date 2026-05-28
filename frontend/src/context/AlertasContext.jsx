import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { alertas as alertasApi } from '../services/api';

const AlertasContext = createContext({ count: 0, recarregar: () => {} });

export function AlertasProvider({ children }) {
  const [count, setCount] = useState(0);

  const recarregar = useCallback(async () => {
    try {
      const data = await alertasApi.listar();
      setCount(data.filter(a => !a.lido).length);
    } catch (_) {}
  }, []);

  useEffect(() => {
    recarregar();
    const iv = setInterval(recarregar, 30_000);
    return () => clearInterval(iv);
  }, [recarregar]);

  return (
    <AlertasContext.Provider value={{ count, recarregar }}>
      {children}
    </AlertasContext.Provider>
  );
}

export const useAlertas = () => useContext(AlertasContext);