// Texto de prazo do bolão e da Copa (docs/design/pack3-onda-a.md): “sex 14/11, 19:00”, “Faltam 2 dias.”
export function diaHora(iso: string) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia} ${data}, ${hora}`;
}

// null quando o prazo já passou. Abaixo de 24 h vira horas e minutos.
export function faltam(iso: string, agora = Date.now()) {
  const ms = new Date(iso).getTime() - agora;
  if (ms <= 0) return null;
  const min = Math.floor(ms / 60000);
  if (min >= 24 * 60) {
    const dias = Math.floor(min / (24 * 60));
    return `${dias === 1 ? 'Falta' : 'Faltam'} ${dias} ${dias === 1 ? 'dia' : 'dias'}.`;
  }
  const h = Math.floor(min / 60), m = min % 60;
  const partes = [h ? `${h} h` : '', m || !h ? `${m} min` : ''].filter(Boolean).join(' ');
  return `${h > 1 ? 'Faltam' : 'Falta'} ${partes}.`;
}

export const emMenosDe24h = (iso: string, agora = Date.now()) => new Date(iso).getTime() - agora < 24 * 3600_000;
