import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import { extrairMencoes, resolverMencoes } from '../mencoes.js';
import type { UserComClube } from '../auth/auth.service.js';
import { PrismaService } from '../prisma.service.js';
import { codificarCursor, decodificarCursor, UUID } from './cursor.js';
import { apagarImagem, dimensoesJpeg, ehJpeg, salvarImagem } from './imagens.js';
import { escaparLike } from '../like.js';
import { processarVideo } from '../midia/video.js';
import { PostsEventos } from './posts.eventos.js';
import { normalizarTag } from './tags.js';
import { comentariosVisiveis, ondeVisivel } from './visibilidade.js';

const POR_PAGINA = 12;
const POR_PAGINA_GALERIA = 24;
const POR_PAGINA_BUSCA = 20;
const LEGENDA_MAX = 2200;
const PROMPT_MAX = 4000;
const MAX_IMAGENS = 10;
const TEXTO_MAX = 500;
const MAX_FIXADOS = 3;
const MAX_IMAGEM = 3 * 1024 * 1024; // o multer aceita até 60 MB (vídeo); imagem acima de 3 MB é recusada aqui

type Arquivo = { buffer: Buffer };

const incluir = ({ id: userId, isAdmin }: { id: string; isAdmin: boolean }) =>
  ({
    club: true,
    author: { select: { id: true, name: true } },
    images: { orderBy: { position: 'asc' } },
    video: true,
    _count: { select: { likes: true, comments: { where: comentariosVisiveis(isAdmin) } } },
    likes: { where: { userId }, select: { emoji: true } },
  }) satisfies Prisma.PostInclude;
type PostCompleto = Prisma.PostGetPayload<{ include: ReturnType<typeof incluir> }>;
type Reacoes = { emoji: string; total: number }[];

// `@[Nome](uuid)` como regex do Postgres
const MARCA_MENCAO = String.raw`@\[[^\]]*\]\([0-9a-f-]{36}\)`;
const imagemGaleria = {
  post: { select: { createdAt: true, club: true } },
} as const;
const itemGaleria = (i: { id: string; postId: string; thumbPath: string; fullPath: string; prompt: string | null; post: { club: { id: string; name: string; crestPath: string } }; favorites: unknown[] }) => ({
  imagemId: i.id,
  postId: i.postId,
  miniUrl: i.thumbPath,
  cheiaUrl: i.fullPath,
  prompt: i.prompt,
  clube: clubeMini(i.post.club),
  favorito: i.favorites.length > 0,
});
const clubeMini = (c: { id: string; name: string; crestPath: string }) => ({ id: c.id, nome: c.name, escudoUrl: c.crestPath });
const naoEncontrado = () => new ApiError(404, 'NAO_ENCONTRADO', 'Não encontramos o que você procurou.');
const invalido = (mensagem: string, campo: string) => new ApiError(400, 'DADOS_INVALIDOS', mensagem, [campo]);

/** Texto de post sem imagem: 1 a 500 caracteres, sem espaços nas pontas. */
function lerTexto(v: unknown) {
  const texto = typeof v === 'string' ? v.trim() : '';
  if (!texto || texto.length > TEXTO_MAX) throw invalido(`Sem imagem, o post precisa de um texto de 1 a ${TEXTO_MAX} caracteres.`, 'texto');
  return texto;
}

function lerLegenda(v: unknown) {
  if (typeof v !== 'string' || v.length > LEGENDA_MAX) throw invalido(`A legenda tem no máximo ${LEGENDA_MAX} caracteres.`, 'legenda');
  return v;
}

/** `prompts`: lista (uma posição por imagem) de texto ≤ 4000 ou null. */
function lerPrompts(v: unknown, n: number): (string | null)[] {
  let lista: unknown = v;
  if (typeof v === 'string') {
    try {
      lista = JSON.parse(v);
    } catch {
      throw invalido('prompts precisa ser uma lista JSON.', 'prompts');
    }
  }
  if (!Array.isArray(lista) || lista.length !== n || lista.some((p) => p !== null && (typeof p !== 'string' || p.length > PROMPT_MAX)))
    throw invalido(`Envie um prompt (texto ou null) para cada uma das ${n} imagens, com até ${PROMPT_MAX} caracteres.`, 'prompts');
  return lista.map((p) => (p === '' ? null : (p as string | null)));
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: PostsEventos,
  ) {}

  private paraJson(p: PostCompleto, user: UserComClube, reacoes: Reacoes, mencoes: { id: string; nome: string }[]) {
    return {
      id: p.id,
      clube: clubeMini(p.club),
      autor: { id: p.author.id, nome: p.author.name },
      legenda: p.caption,
      texto: p.texto,
      mencoes,
      fixado: p.pinnedAt !== null,
      oculto: p.hiddenAt !== null,
      criadoEm: p.createdAt,
      video: p.video && { url: p.video.path, capaUrl: p.video.capaPath, duracaoS: p.video.duracaoS, largura: p.video.largura, altura: p.video.altura },
      imagens: p.images.map((i) => ({ id: i.id, miniUrl: i.thumbPath, cheiaUrl: i.fullPath, largura: i.width, altura: i.height, prompt: i.prompt })),
      curtidas: p._count.likes,
      curtiu: p.likes.length > 0,
      reacoes,
      minhaReacao: p.likes[0]?.emoji ?? null,
      comentarios: p._count.comments,
      podeEditar: this.podeEditar(p, user),
    };
  }

  /** Até 3 emojis por post, o mais usado primeiro (empate: ordem estável por emoji). */
  private async jsonDe(posts: PostCompleto[], user: UserComClube) {
    const grupos = posts.length
      ? await this.prisma.like.groupBy({ by: ['postId', 'emoji'], where: { postId: { in: posts.map((p) => p.id) } }, _count: { _all: true } })
      : [];
    const nomes = await resolverMencoes(this.prisma, [...new Set(posts.flatMap((p) => extrairMencoes(`${p.caption}\n${p.texto ?? ''}`)))]);
    return posts.map((p) => {
      const mencoes = nomes.filter((m) => extrairMencoes(`${p.caption}\n${p.texto ?? ''}`).includes(m.id));
      const reacoes = grupos
        .filter((g) => g.postId === p.id)
        .map((g) => ({ emoji: g.emoji, total: g._count._all }))
        .sort((a, b) => b.total - a.total || a.emoji.localeCompare(b.emoji))
        .slice(0, 3);
      return this.paraJson(p, user, reacoes, mencoes);
    });
  }

  private podeEditar(p: { club: { coachId: string | null } }, user: UserComClube) {
    return user.isAdmin || p.club.coachId === user.id;
  }

  private async buscar(id: string, user: UserComClube) {
    const p = UUID.test(id) ? await this.prisma.post.findFirst({ where: { id, ...ondeVisivel(user.id, user.isAdmin, { lista: false }) }, include: incluir(user) }) : null;
    if (!p) throw naoEncontrado();
    return p;
  }

  async criar(user: UserComClube, corpo: { legenda?: unknown; texto?: unknown; prompts?: unknown; comoCbf?: unknown }, cheia: Arquivo[], mini: Arquivo[], avisar = true, video?: Arquivo) {
    // multipart manda string; só o admin posta pela CBF (o admin pode nem ter clube)
    const comoCbf = corpo.comoCbf === true || corpo.comoCbf === 'true';
    if (comoCbf && !user.isAdmin) throw new ApiError(403, 'NAO_E_ADMIN', 'Só o admin posta como CBF.');
    const clubId = comoCbf ? 'cbf' : user.club?.id;
    if (!clubId) throw new ApiError(403, 'SEM_CLUBE', 'Só técnicos com clube podem postar.');
    const n = cheia.length;
    if (video) return this.criarVideo(user, clubId, corpo, n + mini.length, video);
    if ([...cheia, ...mini].some((a) => a.buffer.length > MAX_IMAGEM)) throw new ApiError(413, 'ARQUIVO_GRANDE', 'A imagem passou de 3 MB.');
    if (n === 0 && mini.length === 0) return this.criarTexto(user, clubId, corpo.texto, avisar);
    if (corpo.texto !== undefined) throw invalido('O texto é só para posts sem imagem.', 'texto');
    if (n < 1 || n > MAX_IMAGENS || mini.length !== n) throw invalido(`Envie de 1 a ${MAX_IMAGENS} imagens, com a cheia e a miniatura de cada uma.`, 'cheia');
    const legenda = lerLegenda(corpo.legenda ?? '');
    const prompts = lerPrompts(corpo.prompts ?? Array(n).fill(null), n);

    // tudo é validado antes de gravar qualquer arquivo
    const dims = cheia.map((a) => (ehJpeg(a.buffer) ? dimensoesJpeg(a.buffer) : null));
    if (dims.some((d) => !d) || !mini.every((a) => ehJpeg(a.buffer)))
      throw new ApiError(400, 'IMAGEM_INVALIDA', 'Não consegui ler uma das imagens. Envie JPEG.');

    const gravados: string[] = [];
    try {
      const imagens: Prisma.PostImageCreateWithoutPostInput[] = [];
      for (let i = 0; i < n; i++) {
        const fullPath = await salvarImagem(cheia[i].buffer, 'posts');
        gravados.push(fullPath);
        const thumbPath = await salvarImagem(mini[i].buffer, 'posts');
        gravados.push(thumbPath);
        imagens.push({ position: i, fullPath, thumbPath, width: dims[i]!.largura, height: dims[i]!.altura, prompt: prompts[i] });
      }
      const criado = await this.prisma.post.create({
        data: { clubId, authorId: user.id, caption: legenda, images: { create: imagens } },
        include: incluir(user),
      });
      this.eventos.emit('posts.criado', criado.id);
      return (await this.jsonDe([criado], user))[0];
    } catch (e) {
      await Promise.all(gravados.map(apagarImagem));
      throw e;
    }
  }

  /** Post de vídeo: um vídeo (≤ 30 s, convertido para MP4 H.264) no lugar das imagens, com legenda opcional. */
  private async criarVideo(user: UserComClube, clubId: string, corpo: { legenda?: unknown; texto?: unknown }, imagens: number, video: Arquivo) {
    if (imagens > 0) throw invalido('Um post tem imagens ou um vídeo, não os dois.', 'video');
    if (corpo.texto !== undefined) throw invalido('O texto é só para posts sem imagem nem vídeo.', 'texto');
    const legenda = lerLegenda(corpo.legenda ?? '');
    const v = await processarVideo(video.buffer, 'videos');
    try {
      const criado = await this.prisma.post.create({
        data: { clubId, authorId: user.id, caption: legenda, video: { create: { path: v.path, capaPath: v.capaPath, duracaoS: v.duracaoS, largura: v.largura, altura: v.altura } } },
        include: incluir(user),
      });
      this.eventos.emit('posts.criado', criado.id);
      return (await this.jsonDe([criado], user))[0];
    } catch (e) {
      await Promise.all([apagarImagem(v.path), apagarImagem(v.capaPath)]);
      throw e;
    }
  }

  /** Post sem imagem: `texto` de 1 a 500 caracteres (legenda fica vazia). */
  private async criarTexto(user: UserComClube, clubId: string, bruto: unknown, avisar = true) {
    const criado = await this.prisma.post.create({ data: { clubId, authorId: user.id, caption: '', texto: lerTexto(bruto) }, include: incluir(user) });
    if (avisar) this.eventos.emit('posts.criado', criado.id); // o bot da CBF manda o próprio push
    return (await this.jsonDe([criado], user))[0];
  }

  async obter(id: string, user: UserComClube) {
    return (await this.jsonDe([await this.buscar(id, user)], user))[0];
  }

  /** Admin: fixa/desafixa. No máximo 3 fixados; a trava (advisory lock) evita dois fixares simultâneos passarem do limite. */
  async fixar(id: string, fixado: boolean) {
    if (!UUID.test(id) || !(await this.prisma.post.findUnique({ where: { id }, select: { id: true } }))) throw naoEncontrado();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(31001)`;
      if (!fixado) return void (await tx.post.updateMany({ where: { id }, data: { pinnedAt: null } }));
      if ((await tx.post.count({ where: { id, pinnedAt: { not: null } } })) > 0) return; // já fixado
      if ((await tx.post.count({ where: { pinnedAt: { not: null } } })) >= MAX_FIXADOS)
        throw new ApiError(409, 'LIMITE_FIXADOS', `Já existem ${MAX_FIXADOS} posts fixados. Desafixe um antes.`);
      await tx.post.updateMany({ where: { id }, data: { pinnedAt: new Date() } });
    });
  }

  async editar(id: string, user: UserComClube, corpo: { legenda?: unknown; texto?: unknown; prompts?: unknown }) {
    const p = await this.buscar(id, user);
    if (!this.podeEditar(p, user)) throw new ApiError(403, 'NAO_E_TECNICO', 'Só o técnico atual do clube edita este post.');
    if (p.images.length === 0 && !p.video && (corpo.legenda !== undefined || corpo.prompts !== undefined)) throw invalido('Post de texto não tem legenda nem prompts; edite o texto.', 'legenda');
    const legenda = corpo.legenda === undefined ? undefined : lerLegenda(corpo.legenda);
    const prompts = corpo.prompts === undefined ? undefined : lerPrompts(corpo.prompts, p.images.length);
    if (corpo.texto !== undefined && (p.images.length > 0 || p.video)) throw invalido('Só post sem imagem tem texto; neste, edite a legenda.', 'texto');
    const texto = corpo.texto === undefined ? undefined : lerTexto(corpo.texto);
    await this.prisma.$transaction([
      this.prisma.post.update({ where: { id }, data: { caption: legenda, texto } }),
      ...(prompts ?? []).map((prompt, i) => this.prisma.postImage.update({ where: { id: p.images[i].id }, data: { prompt } })),
    ]);
    if (legenda !== undefined || texto !== undefined) this.eventos.emit('posts.editado', id); // menção nova avisa; a que já avisou não repete
    return this.obter(id, user);
  }

  async apagar(id: string, user: UserComClube) {
    const p = await this.buscar(id, user);
    if (!this.podeEditar(p, user)) throw new ApiError(403, 'NAO_E_TECNICO', 'Só o técnico atual do clube apaga este post.');
    await this.prisma.post.delete({ where: { id } }); // imagens, curtidas e comentários vão em cascata
    await Promise.all([...p.images.flatMap((i) => [i.fullPath, i.thumbPath]), ...(p.video ? [p.video.path, p.video.capaPath] : [])].map(apagarImagem));
  }

  /** Ids dos posts cuja legenda ou texto tem `#tag` (sem acento, palavra inteira). Só acha; quem vê o quê é o `ondeVisivel`. */
  private async idsComTag(tag: string): Promise<string[]> {
    const t = normalizarTag(tag);
    if (!t) return [];
    // t só tem [a-z0-9_]: seguro dentro da regex. shortcut: varre todos os posts, ok para uma liga de amigos; indexar se passar de ~10 mil posts.
    const rx = `(^|[^[:alnum:]_/#&])#${t}($|[^a-z0-9_])`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Post" WHERE lower(unaccent(caption || ' ' || coalesce(texto, ''))) ~ ${rx}`;
    return rows.map((r) => r.id);
  }

  /**
   * Sem `clube` e sem `tag`, os fixados vêm à parte (`fixados`, só na 1ª página) e nunca entram em `itens`, em página nenhuma.
   * Com `tag`: mesma resposta do feed, só com os posts que têm a hashtag.
   */
  async feed(user: UserComClube, antes?: string, clube?: string, tag?: string) {
    const c = decodificarCursor(antes);
    const visivel = ondeVisivel(user.id, user.isAdmin);
    const geral = !clube && tag === undefined;
    const posts = await this.prisma.post.findMany({
      where: {
        ...visivel,
        ...(clube && { clubId: clube }),
        ...(tag !== undefined && { id: { in: await this.idsComTag(tag) } }),
        ...(geral && { pinnedAt: null }),
        ...(c && { OR: [{ createdAt: { lt: c.criadoEm } }, { createdAt: c.criadoEm, id: { lt: c.id } }] }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: POR_PAGINA + 1,
      include: incluir(user),
    });
    const primeira = geral && !c;
    const fixados = primeira ? await this.prisma.post.findMany({ where: { ...visivel, pinnedAt: { not: null } }, orderBy: { pinnedAt: 'desc' }, include: incluir(user) }) : [];
    const pagina = posts.slice(0, POR_PAGINA);
    const ultimo = pagina.at(-1);
    const json = await this.jsonDe([...pagina, ...fixados], user);
    return {
      ...(primeira && { fixados: json.slice(pagina.length) }),
      itens: json.slice(0, pagina.length),
      proximo: posts.length > POR_PAGINA && ultimo ? codificarCursor(ultimo.createdAt, ultimo.id) : null,
    };
  }

  /** Admin: oculta/mostra o post para todo mundo (reversível). */
  async ocultar(id: string, oculto: boolean) {
    if (!UUID.test(id) || !(await this.prisma.post.findUnique({ where: { id }, select: { id: true } }))) throw naoEncontrado();
    // ocultar também desafixa (libera a vaga); mostrar de novo não volta a fixar
    await this.prisma.post.updateMany({ where: { id }, data: oculto ? { hiddenAt: new Date(), pinnedAt: null } : { hiddenAt: null } });
  }

  /** "Ocultar para mim": só some das listas de quem pediu. */
  async ocultarParaMim(id: string, user: UserComClube, oculto: boolean) {
    await this.buscar(id, user);
    if (oculto) await this.prisma.hiddenPost.createMany({ data: [{ userId: user.id, postId: id }], skipDuplicates: true });
    else await this.prisma.hiddenPost.deleteMany({ where: { userId: user.id, postId: id } });
  }

  /** Favorito do prompt (a imagem tem que existir e estar visível para quem pede). */
  async favoritar(imagemId: string, user: UserComClube, favorito: boolean) {
    const img = UUID.test(imagemId) ? await this.prisma.postImage.findFirst({ where: { id: imagemId, post: ondeVisivel(user.id, user.isAdmin, { lista: false }) }, select: { id: true } }) : null;
    if (!img) throw naoEncontrado();
    if (favorito) await this.prisma.promptFavorite.createMany({ data: [{ userId: user.id, imageId: imagemId }], skipDuplicates: true });
    else await this.prisma.promptFavorite.deleteMany({ where: { userId: user.id, imageId: imagemId } });
  }

  /** Só imagens com prompt (de posts com imagem); cursor = criadoEm do post | id da imagem. `favoritos`: só as que eu favoritei. */
  async galeria(user: UserComClube, antes?: string, clube?: string, favoritos = false) {
    const c = decodificarCursor(antes);
    const imagens = await this.prisma.postImage.findMany({
      where: {
        prompt: { not: null },
        post: { ...ondeVisivel(user.id, user.isAdmin), ...(clube && { clubId: clube }) },
        ...(favoritos && { favorites: { some: { userId: user.id } } }),
        ...(c && { OR: [{ post: { createdAt: { lt: c.criadoEm } } }, { post: { createdAt: c.criadoEm }, id: { lt: c.id } }] }),
      },
      orderBy: [{ post: { createdAt: 'desc' } }, { id: 'desc' }],
      take: POR_PAGINA_GALERIA + 1,
      include: { ...imagemGaleria, favorites: { where: { userId: user.id }, select: { userId: true } } },
    });
    const pagina = imagens.slice(0, POR_PAGINA_GALERIA);
    const ultima = pagina.at(-1);
    return {
      itens: pagina.map(itemGaleria),
      proximo: imagens.length > POR_PAGINA_GALERIA && ultima ? codificarCursor(ultima.post.createdAt, ultima.id) : null,
    };
  }

  /**
   * Busca em posts (legenda e texto) ou nos prompts das imagens: sem acento, sem diferenciar maiúsculas, `%`/`_` literais, sempre parametrizada.
   * Mesma visibilidade do feed; 20 por página, cursor `antes` como o do feed.
   * shortcut: varre todos os posts/prompts para achar os ids, ok para uma liga de amigos; indexar (pg_trgm) se passar de ~10 mil posts.
   */
  async pesquisar(user: UserComClube, tipo: 'posts' | 'prompts', q: string, antes?: string) {
    const c = decodificarCursor(antes);
    const p = escaparLike(q);
    const visivel = ondeVisivel(user.id, user.isAdmin);
    const depois = (campo: string) => (c ? { OR: [{ [campo]: { lt: c.criadoEm } }, { [campo]: c.criadoEm, id: { lt: c.id } }] } : {});
    if (tipo === 'posts') {
      // o markup `@[Nome](uuid)` não conta como texto (nem o uuid nem o nome escrito); a menção é achada pelo nome de hoje da pessoa, no banco
      const ids = (
        await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT p.id FROM "Post" p
          WHERE lower(unaccent(regexp_replace(p.caption || ' ' || coalesce(p.texto, ''), ${MARCA_MENCAO}, ' ', 'gi'))) LIKE '%' || lower(unaccent(${p})) || '%'
             OR EXISTS (
               SELECT 1 FROM "User" u
               WHERE lower(unaccent(u.name)) LIKE '%' || lower(unaccent(${p})) || '%'
                 AND (p.caption || ' ' || coalesce(p.texto, '')) LIKE '%](' || u.id::text || ')%')`
      ).map((r) => r.id);
      const posts = await this.prisma.post.findMany({ where: { ...visivel, id: { in: ids }, ...depois('createdAt') }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: POR_PAGINA_BUSCA + 1, include: incluir(user) });
      const pagina = posts.slice(0, POR_PAGINA_BUSCA);
      const ultimo = pagina.at(-1);
      return { itens: await this.jsonDe(pagina, user), proximo: posts.length > POR_PAGINA_BUSCA && ultimo ? codificarCursor(ultimo.createdAt, ultimo.id) : null };
    }
    const ids = (await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "PostImage" WHERE prompt IS NOT NULL AND lower(unaccent(prompt)) LIKE '%' || lower(unaccent(${p})) || '%'`).map((r) => r.id);
    const imagens = await this.prisma.postImage.findMany({
      where: {
        id: { in: ids },
        post: visivel,
        ...(c && { OR: [{ post: { createdAt: { lt: c.criadoEm } } }, { post: { createdAt: c.criadoEm }, id: { lt: c.id } }] }),
      },
      orderBy: [{ post: { createdAt: 'desc' } }, { id: 'desc' }],
      take: POR_PAGINA_BUSCA + 1,
      include: { ...imagemGaleria, favorites: { where: { userId: user.id }, select: { userId: true } } },
    });
    const pagina = imagens.slice(0, POR_PAGINA_BUSCA);
    const ultima = pagina.at(-1);
    return { itens: pagina.map(itemGaleria), proximo: imagens.length > POR_PAGINA_BUSCA && ultima ? codificarCursor(ultima.post.createdAt, ultima.id) : null };
  }
}
