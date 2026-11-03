import { isIPv6 } from 'node:net';
import { Injectable } from '@nestjs/common';

export type Limite = [chave: string, maximo: number, janelaMs: number];

const TETO = 100_000; // chaves no Map; acima disso, varre as vencidas e, se ainda cheio, descarta a mais antiga

/** IP para as chaves do limitador: IPv4 inteiro, IPv6 pelo prefixo /64 (um cliente costuma ter o /64 todo). */
export function ipBucket(ip: string | undefined): string {
  if (!ip) return 'sem-ip';
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (v4) return v4[1];
  if (!isIPv6(ip)) return ip;
  const [cabeca, cauda] = ip.toLowerCase().split('::');
  const partes = cabeca ? cabeca.split(':') : [];
  if (cauda !== undefined) {
    const fim = cauda ? cauda.split(':') : [];
    partes.push(...Array<string>(8 - partes.length - fim.length).fill('0'), ...fim);
  }
  return partes.slice(0, 4).map((p) => p.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

// shortcut: contador em memória, vale para um processo só e zera ao reiniciar; trocar por Redis/Postgres se houver mais de uma instância.
@Injectable()
export class RateLimiter {
  private readonly janelas = new Map<string, { count: number; resetAt: number }>();
  private ultimaLimpeza = -Infinity;

  get size() {
    return this.janelas.size;
  }

  /**
   * Conta a tentativa em cada limite, em ordem, e para no primeiro estourado
   * (os seguintes nem são criados). Devolve 0 se pode seguir, ou os segundos até liberar.
   */
  check(limites: Limite[], agora = Date.now()): number {
    this.limpar(agora);
    for (const [chave, maximo, janelaMs] of limites) {
      let janela = this.janelas.get(chave);
      if (!janela || janela.resetAt <= agora) {
        janela = { count: 0, resetAt: agora + janelaMs };
        this.janelas.delete(chave); // reinsere no fim: a ordem do Map fica "mais antiga primeiro"
        this.janelas.set(chave, janela);
        if (this.janelas.size > TETO) {
          this.limpar(agora, 1000); // vencidas primeiro (no máx. 1×/s, para um Map cheio de válidas não varrer a cada pedido)
          if (this.janelas.size > TETO) this.janelas.delete(this.janelas.keys().next().value!);
        }
      }
      janela.count++;
      if (janela.count > maximo) return Math.ceil((janela.resetAt - agora) / 1000);
    }
    return 0;
  }

  apagar(chave: string) {
    this.janelas.delete(chave);
  }

  /** Apaga as chaves que começam com o prefixo (ex.: os contadores de login de um e-mail). */
  esquecer(prefixo: string) {
    for (const chave of this.janelas.keys()) if (chave.startsWith(prefixo)) this.janelas.delete(chave);
  }

  // varre as vencidas no máx. 1× por intervalo, não a cada pedido
  private limpar(agora: number, intervaloMs = 60_000) {
    if (agora - this.ultimaLimpeza < intervaloMs) return;
    this.ultimaLimpeza = agora;
    for (const [chave, janela] of this.janelas) if (janela.resetAt <= agora) this.janelas.delete(chave);
  }
}
