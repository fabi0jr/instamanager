import { useState, type KeyboardEvent } from 'react';

export type Mencao = { id: string; nome: string };
export const MAX_MENCOES = 10;
// formato guardado: @[Nome](uuid)
export const MARCA = /@\[([^\]\n]{1,80})\]\(([0-9a-fA-F-]{36})\)/g;

// Texto guardado → texto do campo (`@Nome`) + as menções para o campo lembrar quem é quem (edição)
export function paraCampo(guardado: string) {
  const mapa: Mencao[] = [];
  const texto = guardado.replace(MARCA, (_, nome: string, id: string) => (mapa.push({ id, nome }), `@${nome}`));
  return { texto, mapa };
}

// No campo a menção é `@Nome` (o chip é só visual, no texto publicado). Ao enviar, cada uma volta a @[Nome](id).
export function useMencoes(inicial: Mencao[] = []) {
  const [mapa, setMapa] = useState<Mencao[]>(inicial);
  const cheio = mapa.length >= MAX_MENCOES;
  return {
    mapa,
    cheio,
    registrar: (m: Mencao) => setMapa((l) => [...l, m]),
    limpar: () => setMapa([]),
    serializar(texto: string) {
      let saida = texto;
      for (const m of [...mapa].sort((a, b) => b.nome.length - a.nome.length)) {
        const i = saida.search(new RegExp(`@${m.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}\\]])`, 'u'));
        if (i >= 0) saida = saida.slice(0, i) + `@[${m.nome}](${m.id})` + saida.slice(i + m.nome.length + 1);
      }
      return saida;
    },
    // apagar uma vez remove a menção inteira (é um chip, não letras soltas)
    teclado(e: KeyboardEvent<HTMLTextAreaElement>, valor: string, aoMudar: (v: string) => void) {
      const el = e.currentTarget;
      if (e.key !== 'Backspace' || el.selectionStart !== el.selectionEnd) return;
      const antes = valor.slice(0, el.selectionStart);
      for (const m of mapa) {
        const marca = `@${m.nome}`;
        const fim = antes.endsWith(marca + ' ') ? marca.length + 1 : antes.endsWith(marca) ? marca.length : 0;
        if (fim) {
          e.preventDefault();
          const pos = antes.length - fim;
          aoMudar(valor.slice(0, pos) + valor.slice(el.selectionStart));
          setMapa((l) => l.filter((x) => x !== m));
          requestAnimationFrame(() => el.setSelectionRange(pos, pos));
          return;
        }
      }
    },
  };
}
