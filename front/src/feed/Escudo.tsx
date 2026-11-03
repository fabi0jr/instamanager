import { useState } from 'react';

// Escudo que cai no genérico se a imagem não carregar
export function Escudo({ src, tam }: { src: string; tam: number }) {
  const [erro, setErro] = useState(false);
  return <img src={erro ? '/escudos/generico.svg' : src} alt="" width={tam} height={tam} onError={() => setErro(true)} />;
}
