import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { IcCurtir } from './icones';
import { nomeDe, REACOES, type Emoji, type Post } from './tipos';

const SEGURAR_MS = 350; // toque: segurar abre o seletor
const HOVER_MS = 400; // mouse: pairar abre o seletor

// Aplica a reação (ou a retirada, com null) no post sem esperar o servidor: contagens, linha de emojis e minha reação.
export function comReacao(p: Post, novo: Emoji | null): Post {
  const velho = p.minhaReacao ?? (p.curtiu ? '❤️' : null);
  let lista = (p.reacoes ?? []).map((r) => ({ ...r }));
  if (velho) lista = lista.map((r) => (r.emoji === velho ? { ...r, total: r.total - 1 } : r)).filter((r) => r.total > 0);
  if (novo) {
    const r = lista.find((x) => x.emoji === novo);
    if (r) r.total++;
    else lista.push({ emoji: novo, total: 1 });
  }
  lista.sort((a, b) => b.total - a.total);
  return { ...p, minhaReacao: novo, curtiu: !!novo, curtidas: Math.max(0, p.curtidas - (velho ? 1 : 0) + (novo ? 1 : 0)), reacoes: lista.slice(0, 3) };
}

// Botão Reagir: toque curto = ❤️ (ou tira a que já existe); segurar/pairar/↑ abre o seletor com os 6 emojis.
export function BotaoReagir({ minha, aoReagir }: { minha: Emoji | null; aoReagir: (e: Emoji | null) => void }) {
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState<Emoji | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const segurou = useRef(false); // o clique que vem depois de segurar não é toque curto
  useEffect(() => () => clearTimeout(timer.current), []);

  // tocar fora fecha sem mudar
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);
  // teclado: o foco vai para o emoji atual (ou o primeiro)
  useEffect(() => {
    if (aberto) caixa.current?.querySelector<HTMLElement>(`[data-emoji="${minha ?? '❤️'}"]`)?.focus();
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = (e: Emoji) => {
    setAberto(false);
    setDestaque(null);
    aoReagir(e);
  };

  function apertou(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;
    segurou.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      segurou.current = true;
      setAberto(true);
    }, SEGURAR_MS);
  }
  // arrastar o dedo escolhe o emoji sob ele; soltar aplica
  function moveu(e: PointerEvent) {
    if (!aberto || e.pointerType === 'mouse') return;
    const sob = document.elementFromPoint?.(e.clientX, e.clientY)?.closest<HTMLElement>('[data-emoji]');
    setDestaque((sob?.dataset.emoji as Emoji) ?? null);
  }
  function soltou() {
    clearTimeout(timer.current);
    if (aberto && destaque) escolher(destaque);
  }
  function clicou() {
    if (segurou.current) return void (segurou.current = false);
    setAberto(false);
    aoReagir(minha ? null : '❤️');
  }
  function tecla(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAberto(true);
    }
  }
  function tecladoMenu(e: KeyboardEvent) {
    const itens = [...(caixa.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      setAberto(false);
      caixa.current?.querySelector<HTMLElement>('button[aria-haspopup]')?.focus();
    } else if (e.key === 'ArrowRight') itens[(i + 1) % itens.length]?.focus();
    else if (e.key === 'ArrowLeft') itens[(i - 1 + itens.length) % itens.length]?.focus();
  }

  return (
    <div
      className="reagir"
      ref={caixa}
      // só mouse de verdade: no celular o toque emula mouseenter e abriria o seletor em todo toque curto
      onPointerEnter={(e) => { if (e.pointerType !== 'mouse') return; clearTimeout(timer.current); timer.current = setTimeout(() => setAberto(true), HOVER_MS); }}
      onPointerLeave={(e) => { if (e.pointerType !== 'mouse') return; clearTimeout(timer.current); setAberto(false); }}
    >
      <button
        type="button"
        className={minha === '❤️' ? 'curtido' : ''}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={minha ? `Remover reação: ${nomeDe(minha)}` : 'Reagir'}
        onPointerDown={apertou}
        onPointerMove={moveu}
        onPointerUp={soltou}
        onPointerCancel={() => clearTimeout(timer.current)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={clicou}
        onKeyDown={tecla}
      >
        {minha && minha !== '❤️' ? <span className="emoji-reacao" aria-hidden="true">{minha}</span> : <IcCurtir cheio={minha === '❤️'} />}
      </button>
      {/* ação de acessibilidade (leitor de tela): abre o seletor sem precisar segurar */}
      <button type="button" className="sr" aria-label="Mais reações" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(true)} />
      {aberto && (
        <div role="menu" aria-label="Reações" className="seletor" onKeyDown={tecladoMenu}>
          {REACOES.map((r) => (
            <button
              key={r.emoji}
              type="button"
              role="menuitemradio"
              aria-checked={minha === r.emoji}
              aria-label={r.nome}
              data-emoji={r.emoji}
              className={`${minha === r.emoji ? 'minha' : ''} ${destaque === r.emoji ? 'destaque' : ''}`}
              onClick={() => escolher(r.emoji)}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// "14 reações" com até 3 emojis; zero some
export function LinhaReacoes({ post }: { post: Post }) {
  if (post.curtidas <= 0) return null;
  const lista = post.reacoes ?? [];
  const rotulo = `${post.curtidas} ${post.curtidas === 1 ? 'reação' : 'reações'}`;
  const completo = lista.length ? `${rotulo}: ${lista.map((r) => `${r.total} ${nomeDe(r.emoji)}`).join(', ')}` : rotulo;
  return (
    <div className="linha-reacoes" role="group" aria-label={completo} aria-live="polite">
      <span className="emojis" aria-hidden="true">{lista.map((r) => <span key={r.emoji}>{r.emoji}</span>)}</span>
      <span className="numero">{rotulo}</span>
    </div>
  );
}
