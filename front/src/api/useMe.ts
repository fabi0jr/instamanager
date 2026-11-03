import { useCallback, useEffect, useState } from 'react';
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

  return { me, carregando, recarregar };
}
