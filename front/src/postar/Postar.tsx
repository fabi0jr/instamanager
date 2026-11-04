import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { Me } from '../api/cliente';
import { guardarAviso } from '../aviso';
import { esquecerFeed } from '../feed/Feed';
import { Aviso, Botao, useEnvio } from '../conta/ui';
import { Folha } from '../feed/Folha';
import { Link, navegar } from '../rotas';
import { comprimir, ErroImagem } from './comprimir';
import { registrarErro } from '../erros';
import { ComoCbf, MSG_SEM_ADMIN, quemPosta } from './ComoCbf';
import { enviarPost } from './enviar';
import { Contador, LIMITE_LEGENDA, LIMITE_PROMPT, LinhasPrompt } from './LinhasPrompt';
import { PostarTexto } from './PostarTexto';
import './postar.css';

const MAX = 10;
const MAX_BYTES = 3 * 1024 * 1024;
type Item = { id: number; nome: string; estado: 'preparando' | 'ok' | 'erro'; erro?: string; cheia?: Blob; mini?: Blob; miniUrl?: string };
type Envio = { estado: 'enviando' | 'falhou'; carregado: number; total: number; tipo?: 'rede' | 'incerto' | 'permissao' | 'imagem' | 'admin' };
const mb = (n: number) => (n / 1048576).toFixed(1).replace('.', ',');

let seq = 0;
function PostarFoto({ me, seletor }: { me: Me; seletor: ReactNode }) {
  const [passo, setPasso] = useState(1);
  const [itens, setItens] = useState<Item[]>([]);
  const [legenda, setLegenda] = useState('');
  const [prompts, setPrompts] = useState<Record<number, string>>({});
  const [aviso, setAviso] = useState('');
  const [sair, setSair] = useState(false);
  const [cbf, setCbf] = useState(false);
  const [envio, setEnvio] = useState<Envio | null>(null);
  const cancelar = useRef<(() => void) | null>(null);
  const { bloqueado } = useEnvio();
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []); // soltar as prévias ao sair

  if (!me.clube)
    return (
      <Folha titulo="Só técnico posta" aoFechar={() => navegar('/')}>
        <h2>Só técnico posta</h2>
        <p className="giz2">Cada clube tem um técnico, e só ele publica. Veja se tem algum clube livre para você assumir.</p>
        <Link para="/clubes" className="botao">Ver clubes livres</Link>
        <button type="button" className="botao fantasma" onClick={() => navegar('/')}>Agora não</button>
      </Folha>
    );

  const editar = (id: number, f: (i: Item) => Item) => setItens((l) => l.map((i) => (i.id === id ? f(i) : i)));

  function criarUrl(b: Blob) {
    const u = URL.createObjectURL(b);
    urls.current.push(u);
    return u;
  }

  async function preparar(i: Item, arquivo: File) {
    try {
      const [cheia, mini] = [await comprimir(arquivo, 1600), await comprimir(arquivo, 800)];
      if (cheia.blob.size > MAX_BYTES) throw new Error('grande');
      editar(i.id, (x) => ({ ...x, estado: 'ok', cheia: cheia.blob, mini: mini.blob, miniUrl: criarUrl(mini.blob) }));
    } catch (e) {
      const erro = e instanceof ErroImagem ? `Não deu para ler ${arquivo.name}. Escolha outra imagem ou exporte como JPEG.` : 'Essa imagem ficou grande demais. Escolha outra.';
      editar(i.id, (x) => ({ ...x, estado: 'erro', erro }));
    }
  }

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = [...(e.target.files ?? [])];
    e.target.value = '';
    const cabem = arquivos.slice(0, MAX - itens.length);
    const fora = arquivos.length - cabem.length;
    setAviso(fora > 0 ? `O limite é ${MAX} imagens. ${fora === 1 ? 'A última ficou' : `As ${fora} últimas ficaram`} de fora.` : '');
    const novos: Item[] = cabem.map((a) => ({ id: ++seq, nome: a.name, estado: 'preparando' }));
    setItens((l) => [...l, ...novos]);
    for (let k = 0; k < novos.length; k++) await preparar(novos[k], cabem[k]); // um por vez: poupa memória do celular
  }

  function remover(id: number) {
    const sai = itens.find((i) => i.id === id)?.miniUrl;
    if (sai) URL.revokeObjectURL(sai);
    setItens((l) => l.filter((i) => i.id !== id));
    setPrompts(({ [id]: _, ...resto }) => resto);
  }

  const prontas = itens.filter((i) => i.estado === 'ok');
  const preparando = itens.filter((i) => i.estado === 'preparando').length;
  const comConteudo = itens.length > 0 || legenda.length > 0;
  const textos = prontas.map((i) => prompts[i.id] ?? '');
  const estouro = legenda.length > LIMITE_LEGENDA || textos.some((t) => t.length > LIMITE_PROMPT);

  function publicar(comoCbf = cbf) {
    const f = new FormData();
    if (comoCbf) f.append('comoCbf', 'true');
    f.append('legenda', legenda);
    f.append('prompts', JSON.stringify(textos.map((t) => t.trim() || null)));
    prontas.forEach((i, n) => {
      f.append('cheia', i.cheia!, `cheia-${n}.jpg`);
      f.append('mini', i.mini!, `mini-${n}.jpg`);
    });
    setPasso(3);
    setEnvio({ estado: 'enviando', carregado: 0, total: 0 });
    const { promessa, cancelar: abortar } = enviarPost(f, (carregado, total) => setEnvio({ estado: 'enviando', carregado, total }));
    cancelar.current = abortar;
    promessa.then(
      () => {
        guardarAviso('Post publicado');
        esquecerFeed(); // o feed guardado não tem o post novo
        navegar('/');
      },
      (e) => {
        if (e.codigo === 'CANCELADO') return;
        registrarErro(`falha ao publicar post: ${e.codigo ?? e.message}`);
        setEnvio((a) => {
          const carregado = a?.carregado ?? 0;
          const total = a?.total ?? 0;
          // tudo subiu e a resposta se perdeu: o post pode ter sido criado, então não oferece reenviar (duplicaria)
          const perdida = total > 0 && carregado >= total && (e.status === 0 || e.status >= 500);
          const tipo = e.codigo === 'NAO_E_ADMIN' ? 'admin' : e.codigo === 'SEM_CLUBE' ? 'permissao' : e.codigo === 'IMAGEM_INVALIDA' || e.status === 429 ? 'imagem' : perdida ? 'incerto' : 'rede';
          return { estado: 'falhou', carregado, total, tipo };
        });
      },
    );
  }

  // ---- passo 3
  if (passo === 3 && envio) {
    const pct = envio.total ? Math.round((envio.carregado / envio.total) * 100) : 0;
    const falhou = envio.estado === 'falhou';
    return (
      <div className="tela postar">
        {falhou && envio.tipo === 'admin' ? (
          <>
            <h1>Você não pode publicar como CBF</h1>
            <p>{MSG_SEM_ADMIN}</p>
            <button type="button" className="botao" onClick={() => { setCbf(false); publicar(false); }}>Publicar pelo meu clube</button>
            <button type="button" className="botao secundario" onClick={() => setPasso(2)}>Voltar e editar</button>
          </>
        ) : falhou && envio.tipo === 'permissao' ? (
          <>
            <h1>Você não pode publicar agora</h1>
            <p>Você deixou de ser técnico de um clube, então não dá para publicar. Nada foi enviado.</p>
            <Link para="/clubes" className="botao">Ver clubes livres</Link>
            <Link para="/" className="botao fantasma">Voltar ao feed</Link>
          </>
        ) : (
          <>
            <h1>{falhou ? (envio.tipo === 'incerto' ? 'Não sabemos se publicou' : 'Não deu para publicar') : 'Publicando…'}</h1>
            <p>
              {!falhou && `Enviando ${prontas.length} ${prontas.length === 1 ? 'imagem' : 'imagens'} e a legenda.`}
              {falhou && envio.tipo === 'incerto' && 'O envio terminou, mas não chegou a resposta. Pode ter sido publicado, confira o feed.'}
              {falhou && envio.tipo === 'imagem' && 'Alguma imagem não passou na conferência do servidor. Volte e escolha outra.'}
              {falhou && envio.tipo === 'rede' && `O envio parou em ${pct}%. Nada foi publicado. Sua legenda e os prompts continuam aqui.`}
            </p>
            <div className="miniaturas">{prontas.map((i) => <img key={i.id} src={i.miniUrl} alt="" width="56" height="56" />)}</div>
            <div className={`barra ${falhou ? 'falha' : ''}`} role="progressbar" aria-label={`Publicando, ${pct}%`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="progresso-txt"><span className="numero">{pct}%</span><span className="giz2">{envio.total ? `${mb(envio.carregado)} de ${mb(envio.total)} MB` : ''}</span></div>
            {!falhou && <p className="giz2">Não feche o app até terminar.</p>}
            {!falhou && <button type="button" className="botao fantasma" onClick={() => { cancelar.current?.(); setPasso(2); }}>Cancelar envio</button>}
            {falhou && envio.tipo === 'rede' && <button type="button" className="botao" onClick={() => publicar()}>Tentar de novo</button>}
            {falhou && envio.tipo === 'incerto' && <button type="button" className="botao" onClick={() => { esquecerFeed(); navegar('/'); }}>Ver o feed</button>}
            {falhou && <button type="button" className={`botao ${envio.tipo === 'rede' || envio.tipo === 'incerto' ? 'secundario' : ''}`} onClick={() => setPasso(2)}>Voltar e editar</button>}
          </>
        )}
      </div>
    );
  }

  const topo = (
    <>
      {passo === 1 ? (
        <button type="button" className="link" aria-label="Sair" onClick={() => (comConteudo ? setSair(true) : navegar('/'))}>✕</button>
      ) : (
        <button type="button" className="link" onClick={() => setPasso(1)}>‹ Voltar</button>
      )}
      <nav aria-label={`Passo ${passo} de 3`}>
        <div className="passos" aria-hidden="true">{[1, 2, 3].map((n) => <span key={n} className={n <= passo ? 'feito' : ''} />)}</div>
        <p>Passo {passo} de 3</p>
      </nav>
    </>
  );

  return (
    <div className="tela postar cartao largo">
      {topo}
      {passo === 1 && (
        <>
          {seletor}
          <h1>Escolha as imagens</h1>
          <p>Até {MAX} por post. Elas são reduzidas no celular antes de enviar, então sobem rápido.</p>
          <Aviso>{aviso}</Aviso>
          <div className="grade" role="list" aria-label="Imagens escolhidas">
            {itens.map((i, n) => (
              <div key={i.id} role="listitem" className={`quadro ${i.estado}`}>
                {i.miniUrl && <img src={i.miniUrl} alt="" />}
                <span className="ordem">{n + 1}</span>
                {n === 0 && <span className="capa">Capa</span>}
                {i.estado === 'preparando' && <span className="giro véu" aria-label="Preparando" />}
                {i.estado === 'erro' && <span className="nao-lida">Não lida</span>}
                <button type="button" className="x" aria-label={`Remover imagem ${n + 1}`} onClick={() => remover(i.id)}>✕</button>
              </div>
            ))}
            {itens.length > 0 && itens.length < MAX && (
              <label role="listitem" htmlFor="arquivos-postar" className="quadro add">+ Adicionar</label>
            )}
          </div>
          {itens.filter((i) => i.erro).map((i) => <Aviso key={i.id}>{i.erro}</Aviso>)}
          <p aria-live="polite" className="giz2">{itens.length > 0 && `${itens.length} de ${MAX} imagens. A primeira é a capa e define o formato do post no feed.`}</p>
          {itens.length < MAX && (
            <input id="arquivos-postar" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr" aria-label="Escolher imagens" onChange={escolher} />
          )}
          {itens.length === 0 && <label htmlFor="arquivos-postar" className="botao secundario">Escolher imagens</label>}
          <div className="acao-fixa">
            <Botao disabled={prontas.length === 0 || preparando > 0} onClick={() => setPasso(2)}>
              {preparando > 0 ? `Preparando ${itens.length - preparando} de ${itens.length}…` : 'Continuar'}
            </Botao>
          </div>
        </>
      )}
      {passo === 2 && (
        <>
          <h1>Legenda e prompts</h1>
          <p className={cbf ? 'cbf-frase' : 'giz2'}>{quemPosta(me, cbf)}</p>
          <ComoCbf me={me} ligado={cbf} aoMudar={setCbf} />
          <label htmlFor="legenda">Legenda</label>
          <textarea id="legenda" rows={5} value={legenda} aria-invalid={legenda.length > LIMITE_LEGENDA || undefined} onChange={(e) => setLegenda(e.target.value)} />
          <Contador texto={legenda} limite={LIMITE_LEGENDA} />
          <LinhasPrompt linhas={prontas.map((i) => ({ id: String(i.id), miniUrl: i.miniUrl! }))} prompts={textos} aoMudar={(n, v) => setPrompts({ ...prompts, [prontas[n].id]: v })} />
          <div className="acao-fixa">
            <Botao disabled={estouro || bloqueado} onClick={() => publicar()}>{cbf ? 'Publicar como CBF' : 'Publicar'}</Botao>
          </div>
        </>
      )}
      {sair && (
        <Folha titulo="Descartar este post?" aoFechar={() => setSair(false)}>
          <h2>Descartar este post?</h2>
          <p className="giz2">Você escolheu {itens.length} {itens.length === 1 ? 'imagem' : 'imagens'}. Se sair agora, a escolha se perde.</p>
          <button type="button" className="botao" onClick={() => setSair(false)}>Continuar editando</button>
          <button type="button" className="botao fantasma" onClick={() => navegar('/')}>Descartar</button>
        </Folha>
      )}
    </div>
  );
}

const CHAVE_MODO = 'im:postar-modo';
type Modo = 'foto' | 'texto';

// Foto | Texto: lembra a última escolha; o modo Texto tem um passo só
export function Postar({ me }: { me: Me }) {
  const [modo, setModo] = useState<Modo>(() => (localStorage.getItem(CHAVE_MODO) === 'texto' ? 'texto' : 'foto'));
  const escolher = (m: Modo) => {
    setModo(m);
    localStorage.setItem(CHAVE_MODO, m);
  };
  const seletor = (
    <div className="alternancia" role="radiogroup" aria-label="Tipo de post">
      {(['foto', 'texto'] as const).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => escolher(m)}>{m === 'foto' ? 'Foto' : 'Texto'}</button>
      ))}
    </div>
  );
  if (!me.clube || modo === 'foto') return <PostarFoto me={me} seletor={seletor} />;
  return <PostarTexto me={me} seletor={seletor} />;
}
