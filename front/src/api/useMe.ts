import { useCallback, useEffect, useState } from 'react';
import { navegar, PUBLICAS } from '../rotas';
import { api, type Me } from './cliente';

// me === null e carregando === false: sem sessão (ou API fora do ar)
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    api<Me>('/me')
      .then((m) => vivo && setMe(m))
      .catch(() => vivo && setMe(null))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [versao]);

  // qualquer chamada que volte 401 NAO_AUTENTICADO derruba a sessão aqui
  useEffect(() => {
    const cair = () => {
      setMe(null);
      if (!PUBLICAS.includes(location.pathname)) navegar('/entrar');
    };
    addEventListener('sessao-expirada', cair);
    return () => removeEventListener('sessao-expirada', cair);
  }, []);

  return { me, carregando, recarregar };
}
