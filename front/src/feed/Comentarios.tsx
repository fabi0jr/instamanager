import { useEffect, useRef, useState } from 'react';
import { api, type Me } from '../api/cliente';
import { Denunciar } from './Denunciar';
import { Escudo } from './Escudo';
import { Folha } from './Folha';
import { Texto } from './Texto';
import { IcBandeira, IcFechar, IcLixo, IcMais, IcOlhoOff } from './icones';
import { sigla } from './siglas';
import { haQuanto, type Comentario } from './tipos';

type Item = Comentario & { estado?: 'enviando' | 'falhou' };

function Avatar({ nome, url }: { nome: string; url: string | null }) {
  return url ? <img className="av32" src={url} alt="" /> : <span className="av32" aria-hidden="true">{nome[0]?.toUpperCase()}</span>;
}

export function Comentarios({ postId, me, aoFechar, aoContar }: { postId: string; me: Me; aoFechar: () => void; aoContar: (n: number) => void }) {
  const [lista, setLista] = useState<Item[] | 'carregando' | 'erro'>('carregando');
  const [texto, setTexto] = useState('');
  const [menu, setMenu] = useState<Item | null>(null);
  const [denunciando, setDenunciando] = useState<Item | null>(null);
  const [enviada, setEnviada] = useState(false);
  const [aviso, setAviso] = useState('');
  const fim = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

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

  async function enviar(t: string, tmp?: string) {
    const id = tmp ?? `tmp-${++seq.current}`;
    const novo: Item = { id, texto: t, criadoEm: new Date().toISOString(), usuario: { id: me.id, nome: me.nome, avatarUrl: me.avatarUrl, clube: me.clube }, estado: 'enviando' };
    mudar((l) => (tmp ? l.map((c) => (c.id === tmp ? novo : c)) : [...l, novo]));
    try {
      const salvo = await api<Comentario>(`/posts/${postId}/comentarios`, { method: 'POST', body: JSON.stringify({ texto: t }) });
      mudar((l) => l.map((c) => (c.id === id ? salvo : c)));
    } catch {
      mudar((l) => l.map((c) => (c.id === id ? { ...c, estado: 'falhou' } : c)));
    }
  }
  function publicar() {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    enviar(t);
  }
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
        {Array.isArray(lista) && lista.map((c) => (
          <div key={c.id} className="comentario" style={{ opacity: c.estado === 'enviando' ? 0.55 : c.oculto ? 0.6 : 1 }}>
            <Avatar nome={c.usuario.nome} url={c.usuario.avatarUrl} />
            <div className="corpo">
              <div>
                <strong>{c.usuario.nome}</strong>{' '}
                {c.oculto && <span className="pilula oculto-selo"><IcOlhoOff />Oculto</span>}
                {c.usuario.clube && <span className="pilula" aria-label={`Clube ${c.usuario.clube.nome}`}><Escudo src={`/escudos/${c.usuario.clube.id}.svg`} tam={12} />{sigla(c.usuario.clube.id)}</span>}
              </div>
              <p><Texto>{c.texto}</Texto></p>
              {c.estado === 'falhou' ? (
                <button type="button" className="link erro-txt sem-sublinhado" onClick={() => enviar(c.texto, c.id)}>Não enviou. Toque para tentar de novo.</button>
              ) : (
                <span className="giz2 mini">{c.estado === 'enviando' ? 'Enviando…' : haQuanto(c.criadoEm)}</span>
              )}
            </div>
            {!c.estado && (
              <button type="button" aria-label="Opções do comentário" onClick={() => setMenu(c)}><IcMais /></button>
            )}
          </div>
        ))}
        <div ref={fim} />
      </div>
      <form className="comentar" onSubmit={(e) => { e.preventDefault(); publicar(); }}>
        <Avatar nome={me.nome} url={me.avatarUrl} />
        <textarea data-foco rows={1} maxLength={1000} aria-label={`Comente como ${me.nome}`} placeholder={`Comente como ${me.nome}`} value={texto} onChange={(e) => setTexto(e.target.value)} />
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
