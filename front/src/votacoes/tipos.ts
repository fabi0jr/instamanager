export type Votacao = {
  id: string; titulo: string; tipo: 'CLUBE' | 'TECNICO' | 'POST'; prazo: string; aberta: boolean; encerrada: boolean;
  opcoes: { id: string; rotulo: string }[]; meuVoto: string | null; resultado?: { opcao: string; rotulo: string; votos: number }[];
};
export const prazoTexto = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Prazo acabou';
  const h = ms / 3600_000;
  return h < 24 ? `Termina em ${Math.max(1, Math.round(h))} h` : `Termina em ${Math.round(h / 24)} ${Math.round(h / 24) === 1 ? 'dia' : 'dias'}`;
};
// selo: vence(m) quem tem mais votos (empate = todos os empatados; ninguém votou = sem selo)
export const vencedores = (r: NonNullable<Votacao['resultado']>) => {
  const max = Math.max(0, ...r.map((x) => x.votos));
  return max > 0 ? r.filter((x) => x.votos === max) : [];
};
