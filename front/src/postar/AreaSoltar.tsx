import { useState, type DragEvent } from 'react';

export type Entrega = { modo: 'foto' | 'video'; arquivos: File[] };
const MOUSE = '(hover: hover) and (pointer: fine)';
const ehImagem = (a: File) => a.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(a.name); // HEIC às vezes chega sem type
const ehVideo = (a: File) => a.type.startsWith('video/') || /\.(mp4|mov)$/i.test(a.name);

/** Decide a aba pelo que foi solto; o que não serve vira mensagem. */
export function classificar(arquivos: File[]): Entrega | string {
  const imgs = arquivos.filter(ehImagem);
  const vids = arquivos.filter(ehVideo);
  if (imgs.length + vids.length < arquivos.length) return 'Esse tipo de arquivo não vale. Use imagens (JPEG, PNG, WebP ou HEIC) ou um vídeo (MP4 ou MOV).';
  if (imgs.length && vids.length) return 'Imagem e vídeo não vão juntos. Solte só imagens ou só um vídeo.';
  if (vids.length > 1) return 'Um post tem só um vídeo. Solte um de cada vez.';
  if (vids.length) return { modo: 'video', arquivos: vids };
  return imgs.length ? { modo: 'foto', arquivos: imgs } : 'Não encontrei nenhum arquivo para soltar.';
}

// Só com mouse (computador): no celular continua o botão de sempre.
const comMouse = () => typeof matchMedia === 'function' && matchMedia(MOUSE).matches;

export function AreaSoltar({ para, rotulo, aoSoltar }: { para: string; rotulo: string; aoSoltar: (arquivos: File[]) => string | void }) {
  const [mouse] = useState(comMouse);
  const [sobre, setSobre] = useState(false);
  const [erro, setErro] = useState('');
  if (!mouse) return <label htmlFor={para} className="botao secundario">{rotulo}</label>;
  const arrasto = (e: DragEvent) => { e.preventDefault(); setSobre(true); };
  return (
    <>
      <label
        htmlFor={para}
        className={`soltar${sobre ? ' sobre' : ''}`}
        onDragEnter={arrasto}
        onDragOver={arrasto}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); setErro(aoSoltar([...e.dataTransfer.files]) ?? ''); }}
      >
        Arraste as imagens ou o vídeo aqui, ou clique para escolher
      </label>
      {erro && <p role="alert" className="erro-soltar">{erro}</p>}
    </>
  );
}

/** Soltar um arquivo fora da caixa faria o navegador abrir o arquivo e sair do app. */
export function bloquearSoltarFora() {
  const parar = (e: Event) => { if ((e as globalThis.DragEvent).dataTransfer?.types.includes('Files')) e.preventDefault(); };
  addEventListener('dragover', parar);
  addEventListener('drop', parar);
  return () => { removeEventListener('dragover', parar); removeEventListener('drop', parar); };
}
