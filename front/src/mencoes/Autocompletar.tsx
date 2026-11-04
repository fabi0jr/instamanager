import { useEffect, useState, type RefObject } from 'react';
import { api } from '../api/cliente';
import { Escudo } from '../feed/Escudo';
import { sigla } from '../feed/siglas';
import { MAX_MENCOES, type useMencoes } from './mencoes';
import './mencoes.css';

type Pessoa = { id: string; nome: string; avatarUrl: string | null; clube: { id: string; nome: string; escudoUrl: string } | null };

const FIM = /(^|\s)@([^\s@]{0,60})$/; // `@` + o que foi digitado, logo antes do cursor

// Lista de pessoas presa logo acima do campo: digitar `@fa` busca (a partir de 2 letras, 250 ms depois da última tecla)
export function Autocompletar({ valor, aoMudar, campo, mencoes }: { valor: string; aoMudar: (v: string) => void; campo: RefObject<HTMLTextAreaElement | null>; mencoes: ReturnType<typeof useMencoes> }) {
  const [achadas, setAchadas] = useState<Pessoa[] | null>(null);
  const [consulta, setConsulta] = useState<string | null>(null);
  const [ativa, setAtiva] = useState(0);

  useEffect(() => {
    const pos = campo.current?.selectionStart ?? valor.length;
    const m = valor.slice(0, pos).match(FIM);
    if (!m || mencoes.cheio) return setConsulta(null);
    const q = m[2];
    setConsulta(q);
    setAchadas(null);
    if (q.trim().length < 2) return;
    const t = setTimeout(() => api<Pessoa[]>(`/pessoas?q=${encodeURIComponent(q.trim())}`).then((l) => { setAchadas(Array.isArray(l) ? l : []); setAtiva(0); }, () => setAchadas([])), 250);
    return () => clearTimeout(t);
  }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps

  const aviso = !mencoes.cheio && valor.slice(0, campo.current?.selectionStart ?? valor.length).match(FIM) && mencoes.mapa.length >= MAX_MENCOES;
  if (mencoes.cheio && FIM.test(valor.slice(0, campo.current?.selectionStart ?? valor.length)))
    return <p className="mencao-aviso" role="status">No máximo {MAX_MENCOES} menções</p>;
  if (consulta === null || aviso) return null;

  function escolher(p: Pessoa) {
    const el = campo.current;
    const pos = el?.selectionStart ?? valor.length;
    const antes = valor.slice(0, pos);
    const inicio = antes.search(/@[^\s@]{0,60}$/);
    const novo = `${valor.slice(0, inicio)}@${p.nome} ${valor.slice(pos)}`;
    mencoes.registrar({ id: p.id, nome: p.nome });
    aoMudar(novo);
    setConsulta(null);
    const cursor = inicio + p.nome.length + 2;
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(cursor, cursor); });
  }

  const digitado = consulta.trim();
  return (
    <div className="mencao-lista" role="listbox" aria-label="Pessoas">
      {digitado.length < 2 && <p className="mencao-dica">Digite 2 letras do nome para buscar uma pessoa.</p>}
      {digitado.length >= 2 && achadas === null && <p className="mencao-dica">Buscando…</p>}
      {achadas?.length === 0 && <p className="mencao-dica">Ninguém com “{digitado}” no nome.</p>}
      {achadas?.map((p, i) => (
        <button key={p.id} type="button" role="option" aria-selected={i === ativa} className={i === ativa ? 'ativa' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(p)}>
          {p.avatarUrl ? <img className="av32" src={p.avatarUrl} alt="" /> : <span className="av32" aria-hidden="true">{p.nome[0]?.toUpperCase()}</span>}
          <span className="mencao-nome"><b>{p.nome.slice(0, digitado.length)}</b>{p.nome.slice(digitado.length)}</span>
          {p.clube ? <span className="pilula"><Escudo src={p.clube.escudoUrl} tam={14} />{sigla(p.clube.id)}</span> : <span className="pilula">torcedor</span>}
        </button>
      ))}
    </div>
  );
}
