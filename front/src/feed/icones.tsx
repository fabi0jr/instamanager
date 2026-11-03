import type { ReactNode } from 'react';
import camera from '../icones/camera.svg?raw';
import comentar from '../icones/comentar.svg?raw';
import copiar from '../icones/copiar.svg?raw';
import curtido from '../icones/curtido.svg?raw';
import curtir from '../icones/curtir.svg?raw';
import escudo from '../icones/escudo.svg?raw';
import galeria from '../icones/galeria.svg?raw';
import inicio from '../icones/inicio.svg?raw';
import mais from '../icones/mais.svg?raw';
import novoPost from '../icones/novo-post.svg?raw';
import perfil from '../icones/perfil.svg?raw';
import voltar from '../icones/voltar.svg?raw';

// Ícones oficiais do board Icones (docs/design/icones, copiados para src/icones): herdam a cor por currentColor.
const OFICIAIS = { camera, comentar, copiar, curtido, curtir, escudo, galeria, inicio, mais, 'novo-post': novoPost, perfil, voltar };
export function Icone({ nome }: { nome: keyof typeof OFICIAIS }) {
  return <span className="icone" aria-hidden="true" dangerouslySetInnerHTML={{ __html: OFICIAIS[nome] }} />;
}

export const IcCurtir = ({ cheio }: { cheio?: boolean }) => <Icone nome={cheio ? 'curtido' : 'curtir'} />;
export const IcComentar = () => <Icone nome="comentar" />;
export const IcMais = () => <Icone nome="mais" />;
export const IcCopiar = () => <Icone nome="copiar" />;
export const IcGaleria = () => <Icone nome="galeria" />;
export const IcCamera = () => <Icone nome="camera" />;
export const IcVoltar = () => <Icone nome="voltar" />;

// Fora do conjunto exportado até agora: mesmos parâmetros (grade 24, traço 1,75). Trocar quando o board Icones exportar.
const base = (d: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const IcFechar = () => base(<path d="M6 6l12 12M18 6L6 18" />);
export const IcSeta = () => base(<path d="M9 6l6 6-6 6" />);
export const IcFiltro = () => base(<path d="M4 6h16M7 12h10M10 18h4" />);
export const IcOk = () => base(<path d="M5 12l5 5 9-10" />);
export const IcEditar = () => base(<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />);
export const IcLixo = () => base(<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" />);
