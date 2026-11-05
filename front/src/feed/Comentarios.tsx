import { useEffect, useRef, useState } from 'react';
import { api, ErroApi, type Me } from '../api/cliente';
import { Denunciar } from './Denunciar';
import { Escudo } from './Escudo';
import { Folha } from './Folha';
import { Texto } from './Texto';
import { Autocompletar } from '../mencoes/Autocompletar';
import { useMencoes, type Mencao } from '../mencoes/mencoes';
import { Alerta } from '../conta/ui';
import { IcBandeira, IcFechar, IcLixo, IcMais, IcOlhoOff, IcResponder } from './icones';
import { sigla } from './siglas';
import { haQuanto, type Comentario } from './tipos';
import { Link } from '../rotas';

type Item = Comentario & { estado?: 'enviando' | 'falhou'; alvoId?: string }; // alvoId: o comentário clicado em Responder (o back avisa o autor dele)
const MUITAS = 3; // acima disso só as 2 últimas respostas ficam à vista (docs/design/pack3-onda-b.md §4)
type Respondendo = { raiz: string; alvo: string; nome: string; uid: string; erro?: boolean }; // `alvo` é o comentário clicado e vai como parentId (o back sobe para o raiz); `raiz` só agrupa a resposta na tela

function Avatar({ nome, url, pequeno }: { nome: string; url: string | null; pequeno?: boolean }) {
  const cl = pequeno ? 'av32 av28' : 'av32';
  return url ? <img className={cl} src={url} alt="" /> : <span className={cl} aria-hidden="true">{nome[0]?.toUpperCase()}</span>;
}

export function Comentarios({ postId, me, aoFechar, aoContar }: { postId: string; me: Me; aoFechar: () => void; aoContar: (n: number) => void }) {
  const [lista, setLista] = useState<Item[] | 'carregando' | 'erro'>('carregando');
  const [texto, setTexto] = useState('');
  const [menu, setMenu] = useState<Item | null>(null);
  const [denunciando, setDenunciando] = useState<Item | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [aviso, setAviso] = useState('');
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const mencoes = useMencoes();
  const seq = useRef(0);
  const voltarFoco = useRef<string | null>(null);
  const [respondendo, setRespondendo] = useState<Respondendo | null>(null);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  function carregar() {
    setLista('carregando');
    api<Comentario[]>(`/posts/${postId}/comentarios`).then(setLista, () => setLista('erro'));
  }
  useEffect(carregar, [postId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (Array.isArray(lista)) {
      aoContar(lista.length);
      fim.current?.scrollIntoView?.({ block: 'end' }); // abre rolado até o último
    }
  }, [lista]); // eslint-disable-line react-hooks/exhaustive-deps

  const mudar = (f: (l: Item[]) => Item[]) => setLista((l) => (Array.isArray(l) ? f(l) : l));

  async function enviar(t: string, tmp?: string, resp?: { alvo: string; raiz: string }, devolver?: { texto: string; mapa: Mencao[] }) {
    const parentId = resp?.alvo;
    const id = tmp ?? `tmp-${++seq.current}`;
    const novo: Item = { id, texto: t, parentId: resp?.raiz ?? null, alvoId: parentId, criadoEm: new Date().toISOString(), usuario: { id: me.id, nome: me.nome, avatarUrl: me.avatarUrl, clube: me.clube }, estado: 'enviando' };
    mudar((l) => (tmp ? l.map((c) => (c.id === tmp ? novo : c)) : [...l, novo]));
    try {
      const salvo = await api<Comentario>(`/posts/${postId}/comentarios`, { method: 'POST', body: JSON.stringify(parentId ? { texto: t, parentId } : { texto: t }) });
      mudar((l) => l.map((c) => (c.id === id ? salvo : c)));
      if (parentId) setRespondendo((r) => (r?.alvo === parentId ? null : r));
    } catch (e) {
      if (parentId && e instanceof ErroApi && e.status === 400 && e.campos.includes('parentId')) { // o comentário respondido sumiu: a faixa vira erro e a resposta não fica pendurada
        mudar((l) => l.filter((c) => c.id !== id));
        setRespondendo((r) => (r ? { ...r, erro: true } : r));
        if (devolver) { setTexto(devolver.texto); devolver.mapa.forEach(mencoes.registrar); } // o texto e as menções não se perdem
        return;
      }
      mudar((l) => l.map((c) => (c.id === id ? { ...c, estado: 'falhou' } : c)));
    }
  }
  function publicar() {
    const t = texto.trim();
    if (!t || respondendo?.erro) return; // com a faixa de erro, o ✕ vem antes
    const guardado = mencoes.serializar(t);
    setTexto('');
    mencoes.limpar();
    enviar(guardado, undefined, respondendo ? { alvo: respondendo.alvo, raiz: respondendo.raiz } : undefined, { texto, mapa: mencoes.mapa });
  }
  function responder(c: Item) {
    // o rascunho fica: '@Nome ' entra na frente (troca o '@Fulano ' de uma resposta anterior, se estiver lá)
    let resto = texto;
    if (respondendo) {
      const antes = `@${respondendo.nome} `;
      if (resto.startsWith(antes)) { resto = resto.slice(antes.length); mencoes.remover(respondendo.uid); }
    }
    setRespondendo({ raiz: c.parentId ?? c.id, alvo: c.id, nome: c.usuario.nome, uid: c.usuario.id });
    if (c.usuario.id !== me.id) {
      const marca = `@${c.usuario.nome} `;
      if (!mencoes.mapa.some((m) => m.id === c.usuario.id)) mencoes.registrar({ id: c.usuario.id, nome: c.usuario.nome });
      if (!resto.startsWith(marca)) resto = marca + resto;
    }
    setTexto(resto);
    requestAnimationFrame(() => { const el = campo.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  }
  function cancelarResposta() {
    if (respondendo) { // tira só o '@Nome ' do início (e a menção dele); o resto do que a pessoa escreveu fica
      const marca = `@${respondendo.nome} `;
      if (texto.startsWith(marca) || texto === marca.trimEnd()) { setTexto(texto.slice(marca.length)); mencoes.remover(respondendo.uid); }
      voltarFoco.current = respondendo.alvo; // depois que a faixa sair, o foco volta ao Responder do comentário
    }
    setRespondendo(null);
  }
  useEffect(() => {
    if (respondendo || !voltarFoco.current) return;
    document.querySelector<HTMLElement>(`[data-resp="${voltarFoco.current}"]`)?.focus();
    voltarFoco.current = null;
  }, [respondendo]);
  async function apagar(c: Item) {
    setMenu(null);
    mudar((l) => l.filter((x) => x.id !== c.id));
    try {
      await api(`/comentarios/${c.id}`, { method: 'DELETE' });
    } catch {
      mudar((l) => [...l, c].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)));
      setAviso('Não deu para apagar o comentário. Tente de novo.');
    }
  }

  async function ocultar(c: Item) {
    setMenu(null);
    const novo = !c.oculto;
    mudar((l) => l.map((x) => (x.id === c.id ? { ...x, oculto: novo } : x)));
    try {
      await api(`/admin/comentarios/${c.id}/ocultar`, { method: novo ? 'PUT' : 'DELETE' });
    } catch {
      mudar((l) => l.map((x) => (x.id === c.id ? { ...x, oculto: !novo } : x)));
      setAviso('Não deu para ocultar o comentário. Tente de novo.');
    }
  }

  const raizes = Array.isArray(lista) ? lista.filter((c) => !c.parentId) : []; // resposta cujo raiz não está na lista (oculto/apagado) não aparece
  const linha = (c: Item, resposta: boolean) => (
    <div className={resposta ? 'comentario resposta' : 'comentario'} style={{ opacity: c.estado === 'enviando' ? 0.55 : c.oculto ? 0.6 : 1 }}>
      <Link para={`/u/${c.usuario.id}`} className="avatar-link" aria-label={`Perfil de ${c.usuario.nome}`}><Avatar nome={c.usuario.nome} url={c.usuario.avatarUrl} pequeno={resposta} /></Link>
      <div className="corpo">
        <div>
          <Link para={`/u/${c.usuario.id}`} className="nome-link"><strong>{c.usuario.nome}</strong></Link>{' '}
          {c.oculto && <span className="pilula oculto-selo"><IcOlhoOff />Oculto</span>}
          {c.usuario.clube && <span className="pilula" aria-label={`Clube ${c.usuario.clube.nome}`}><Escudo src={`/escudos/${c.usuario.clube.id}.svg`} tam={12} />{sigla(c.usuario.clube.id)}</span>}
        </div>
        <p><Texto mencoes={c.mencoes}>{c.texto}</Texto></p>
        {c.estado === 'falhou' ? (
          <button type="button" className="link erro-txt sem-sublinhado" onClick={() => enviar(c.texto, c.id, c.alvoId && c.parentId ? { alvo: c.alvoId, raiz: c.parentId } : undefined)}>Não enviou. Toque para tentar de novo.</button>
        ) : c.estado === 'enviando' ? (
          <span className="giz2 mini">Enviando…</span>
        ) : (
          <span className="giz2 mini linha-hora">{haQuanto(c.criadoEm)} · <button type="button" className="responder" data-resp={c.id} aria-label={`Responder a ${c.usuario.nome}`} onClick={() => responder(c)}><IcResponder />Responder</button></span>
        )}
      </div>
      {!c.estado && (
        <button type="button" aria-label="Opções do comentário" onClick={() => setMenu(c)}><IcMais /></button>
      )}
    </div>
  );

  return (
    <Folha titulo="Comentários" aoFechar={aoFechar} alta>
      <div className="alca" aria-hidden="true" />
      <header className="folha-topo">
        <h2>Comentários {Array.isArray(lista) && <span className="giz2">{lista.length}</span>}</h2>
        <button type="button" aria-label="Fechar" onClick={aoFechar}><IcFechar /></button>
      </header>
      {aviso && <p role="alert" className="erro-txt">{aviso}</p>}
      <div className="comentarios-lista">
        {lista === 'carregando' && [0, 1, 2, 3].map((n) => <div key={n} className="esqueleto" />)}
        {lista === 'erro' && (
          <div className="caixa-info" role="alert">
            <h2>Não deu para carregar os comentários</h2>
            <button type="button" className="botao secundario" onClick={carregar}>Tentar de novo</button>
          </div>
        )}
        {Array.isArray(lista) && lista.length === 0 && (
          <div><h3>Ainda ninguém comentou</h3><p className="giz2">Seja o primeiro a mandar um recado.</p></div>
        )}
        {Array.isArray(lista) && (
          <ul className="threads">
            {raizes.map((r) => {
              const rs = lista.filter((x) => x.parentId === r.id);
              const resumida = rs.length > MUITAS && !abertas.has(r.id);
              return (
                <li key={r.id} className="thread">
                  {linha(r, false)}
                  {rs.length > 0 && (
                    <ul className="respostas">
                      {resumida && <li><button type="button" className="ver-mais" onClick={() => setAbertas((a) => new Set(a).add(r.id))}>Ver mais {rs.length - 2} respostas</button></li>}
                      {(resumida ? rs.slice(-2) : rs).map((x) => <li key={x.id}>{linha(x, true)}</li>)}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div ref={fim} />
      </div>
      {respondendo && (respondendo.erro
        ? <div className="respondendo erro" role="alert"><Alerta tam={16} /><span>Esse comentário não existe mais.</span><button type="button" aria-label="Cancelar resposta" onClick={cancelarResposta}><IcFechar /></button></div>
        : <div className="respondendo" role="status"><span>Respondendo a <b>{respondendo.nome}</b></span><button type="button" aria-label="Cancelar resposta" onClick={cancelarResposta}><IcFechar /></button></div>)}
      <form className="comentar" onSubmit={(e) => { e.preventDefault(); publicar(); }}>
        <Autocompletar valor={texto} aoMudar={setTexto} campo={campo} mencoes={mencoes} />
        <Avatar nome={me.nome} url={me.avatarUrl} />
        <textarea ref={campo} data-foco rows={1} maxLength={1000} onKeyDown={(e) => mencoes.teclado(e, texto, setTexto)} aria-label={`Comente como ${me.nome}`} placeholder={respondendo ? `Responda a ${respondendo.nome}` : `Comente como ${me.nome}`} value={texto} onChange={(e) => setTexto(e.target.value)} />
        {texto.length >= 900 && <span className="giz2 mini">{texto.length}/1000</span>}
        <button type="submit" className={texto.trim() ? 'ativo' : ''} disabled={!texto.trim()}>Publicar</button>
      </form>
      {denunciando && <Denunciar alvo={{ commentId: denunciando.id }} aoFechar={() => setDenunciando(null)} aoEnviada={() => { setDenunciando(null); setAviso(''); setEnviada(true); }} />}
      {enviada && <p role="status" className="toast-card">Denúncia enviada. O admin vai olhar.</p>}
      {menu && (
        <Folha titulo="Comentário" aoFechar={() => setMenu(null)}>
          <div className="alca" aria-hidden="true" />
          {menu.usuario.id !== me.id && !me.isAdmin && (
            <button type="button" className="item-folha" onClick={() => { setDenunciando(menu); setMenu(null); }}><IcBandeira />Denunciar comentário</button>
          )}
          {me.isAdmin && <button type="button" className="item-folha" onClick={() => ocultar(menu)}><IcOlhoOff />{menu.oculto ? 'Mostrar de novo' : 'Ocultar comentário'}</button>}
          {(menu.usuario.id === me.id || me.isAdmin) && <button type="button" className="item-folha perigo" onClick={() => apagar(menu)}><IcLixo />Apagar comentário</button>}
          <button type="button" className="botao fantasma" onClick={() => setMenu(null)}>Cancelar</button>
        </Folha>
      )}
    </Folha>
  );
}
