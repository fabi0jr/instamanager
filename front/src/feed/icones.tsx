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
import setaVoltar from '../icones/seta-voltar.svg?raw';
import seta from '../icones/seta.svg?raw';
import editar from '../icones/editar.svg?raw';
import fechar from '../icones/fechar.svg?raw';
import filtro from '../icones/filtro.svg?raw';
import lixo from '../icones/lixo.svg?raw';
import ok from '../icones/ok.svg?raw';

// Ícones oficiais do board Icones (docs/design/icones, copiados para src/icones): herdam a cor por currentColor.
const OFICIAIS = { camera, comentar, copiar, curtido, curtir, escudo, galeria, inicio, mais, 'novo-post': novoPost, perfil, 'seta-voltar': setaVoltar, seta, editar, fechar, filtro, lixo, ok };
export function Icone({ nome }: { nome: keyof typeof OFICIAIS }) {
  return <span className="icone" aria-hidden="true" dangerouslySetInnerHTML={{ __html: OFICIAIS[nome] }} />;
}

export const IcCurtir = ({ cheio }: { cheio?: boolean }) => <Icone nome={cheio ? 'curtido' : 'curtir'} />;
export const IcComentar = () => <Icone nome="comentar" />;
export const IcMais = () => <Icone nome="mais" />;
export const IcCopiar = () => <Icone nome="copiar" />;
export const IcGaleria = () => <Icone nome="galeria" />;
export const IcCamera = () => <Icone nome="camera" />;
export const IcVoltar = () => <Icone nome="seta-voltar" />;
export const IcFechar = () => <Icone nome="fechar" />;
export const IcSeta = () => <Icone nome="seta" />;
export const IcFiltro = () => <Icone nome="filtro" />;
export const IcOk = () => <Icone nome="ok" />;
export const IcEditar = () => <Icone nome="editar" />;
export const IcLixo = () => <Icone nome="lixo" />;
