import { Injectable } from '@nestjs/common';
import { UUID } from '../posts/cursor.js';
import { ondeVisivel } from '../posts/visibilidade.js';
import { PrismaService } from '../prisma.service.js';

const DESC_MAX = 150;
const ICONE = '/icones/icon-512.png';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const resumo = (t: string) => {
  const limpo = t.replace(/\s+/g, ' ').trim();
  return limpo.length > DESC_MAX ? `${limpo.slice(0, DESC_MAX - 1).trimEnd()}…` : limpo;
};

@Injectable()
export class OgService {
  constructor(private readonly prisma: PrismaService) {}

  /** HTML com as tags og: para os robôs de prévia. Qualquer problema (post oculto, inexistente, erro) vira a prévia genérica. */
  async pagina(id: string): Promise<string> {
    const base = (process.env.APP_URL ?? '').replace(/\/$/, '');
    try {
      // visão de quem não é ninguém: só post não ocultado pelo admin
      const p = UUID.test(id)
        ? await this.prisma.post.findFirst({ where: { id, ...ondeVisivel('', false, { lista: false }) }, include: { club: true, images: { orderBy: { position: 'asc' }, take: 1 } } })
        : null;
      if (p)
        return html({
          titulo: `${p.club.name} no InstaManager`,
          descricao: resumo(p.texto ?? p.caption),
          imagem: base + (p.images[0]?.thumbPath ?? ICONE),
          url: `${base}/p/${p.id}`,
          destino: `/p/${p.id}`,
        });
    } catch {
      // cai na genérica
    }
    return html({ titulo: 'InstaManager', descricao: 'O feed da liga: posts, tabela e zoeira.', imagem: base + ICONE, url: base, destino: '/' });
  }
}

function html(d: { titulo: string; descricao: string; imagem: string; url: string; destino: string }) {
  const [t, desc, img, url] = [d.titulo, d.descricao, d.imagem, d.url].map(esc);
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${t}</title>
<meta property="og:type" content="article">
<meta property="og:site_name" content="InstaManager">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${img}">
<meta http-equiv="refresh" content="0;url=${esc(d.destino)}">
</head><body><a href="${esc(d.destino)}">${t}</a></body></html>
`;
}
