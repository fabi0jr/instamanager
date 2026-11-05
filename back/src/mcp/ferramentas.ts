import { HttpException } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import type { BolaoService } from '../bolao/bolao.service.js';
import type { CopaService } from '../copa/copa.service.js';
import { ApiError } from '../http.js';
import type { LigaService } from '../liga/liga.service.js';
import type { PostsService } from '../posts/posts.service.js';
import type { PrismaService } from '../prisma.service.js';
import type { StoriesService } from '../stories/stories.service.js';

export type Deps = {
  prisma: PrismaService;
  posts: PostsService;
  stories: StoriesService;
  liga: LigaService;
  copa: CopaService;
  bolao: BolaoService;
};
type Args = Record<string, unknown>;
type Ferramenta = {
  name: string;
  description: string;
  inputSchema: object;
  escrita: boolean;
  run: (a: Args, d: Deps, admin: UserComClube) => Promise<unknown>;
  resumo: (a: Args) => string;
  /** O que vai para o log (McpAcao.entrada), se não for a entrada inteira: nada de base64. `resumo` lê esta forma. */
  registro?: (a: Args) => Args;
};

const invalido = (mensagem: string, campo: string) =>
  new ApiError(400, 'DADOS_INVALIDOS', mensagem, [campo]);
const cortar = (s: unknown, n = 60) => {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const limite = (a: Args, padrao: number, max: number) => {
  const v = a.limite ?? padrao;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max)
    throw invalido(`limite: inteiro de 1 a ${max}.`, 'limite');
  return v;
};
const lista = (v: unknown, campo: string) => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'object' || !x))
    throw invalido(`${campo}: envie uma lista de objetos.`, campo);
  return v as Record<string, unknown>[];
};
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const decodificar = (v: unknown, campo: string) => {
  if (typeof v !== 'string' || !BASE64.test(v))
    throw invalido(`${campo}: envie o arquivo em base64.`, campo);
  return { buffer: Buffer.from(v, 'base64') };
};
const semEntrada = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};
const comLimite = (max: number, padrao: number) => ({
  type: 'object',
  properties: {
    limite: { type: 'integer', minimum: 1, maximum: max, default: padrao },
  },
  additionalProperties: false,
});
const placar = (extra: object = {}) => ({
  type: 'object',
  properties: {
    mandanteId: { type: 'string' },
    visitanteId: { type: 'string' },
    golsMandante: { type: 'integer', minimum: 0, maximum: 99 },
    golsVisitante: { type: 'integer', minimum: 0, maximum: 99 },
    ...extra,
  },
  required: ['mandanteId', 'visitanteId', 'golsMandante', 'golsVisitante'],
  additionalProperties: false,
});

/** Troca só os placares informados no jogo certo (mandante+visitante) e devolve a lista inteira para `lancarJogos`. Jogo que não existe → 400, sem gravar. */
function mesclar<J extends { mandanteId: string; visitanteId: string }>(
  atuais: J[],
  novos: Record<string, unknown>[],
  campos: string[],
) {
  const chave = (j: { mandanteId: unknown; visitanteId: unknown }) =>
    `${String(j.mandanteId)}|${String(j.visitanteId)}`;
  const por = new Map(
    atuais.map((j) => [chave(j), { ...j } as Record<string, unknown>]),
  );
  for (const n of novos) {
    const j = por.get(
      chave(n as { mandanteId: unknown; visitanteId: unknown }),
    );
    if (!j)
      throw invalido(
        'Esse jogo (mandante x visitante) não existe aí.',
        'placares',
      );
    for (const k of campos) if (k in n) j[k] = n[k];
  }
  return [...por.values()];
}

export const FERRAMENTAS: Ferramenta[] = [
  {
    name: 'ultimos_posts',
    description:
      'Lê os posts mais recentes do app (autor, clube, texto, reações e quantidade de comentários).',
    inputSchema: comLimite(30, 10),
    escrita: false,
    resumo: () => '',
    async run(a, d, admin) {
      const n = limite(a, 10, 30);
      const itens: Awaited<ReturnType<PostsService['feed']>>['itens'] = [];
      let antes: string | undefined;
      for (let i = 0; i < 6 && itens.length < n; i++) {
        const f = await d.posts.feed(admin, antes);
        itens.push(...f.itens.filter((p) => !p.oculto));
        if (!f.proximo) break;
        antes = f.proximo;
      }
      return itens.slice(0, n).map((p) => ({
        id: p.id,
        clube: p.clube.nome,
        autor: p.autor.nome,
        texto: p.texto,
        legenda: p.legenda,
        reacoes: p.reacoes,
        curtidas: p.curtidas,
        comentarios: p.comentarios,
        criadoEm: p.criadoEm,
      }));
    },
  },
  {
    name: 'ultimos_comentarios',
    description:
      'Lê os comentários mais recentes (quem comentou, em qual post e o texto).',
    inputSchema: comLimite(50, 20),
    escrita: false,
    resumo: () => '',
    async run(a, d) {
      const cs = await d.prisma.comment.findMany({
        where: { hiddenAt: null, post: { hiddenAt: null } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limite(a, 20, 50),
        select: {
          id: true,
          text: true,
          createdAt: true,
          postId: true,
          user: { select: { name: true } },
        },
      });
      return cs.map((c) => ({
        id: c.id,
        postId: c.postId,
        autor: c.user.name,
        texto: c.text,
        criadoEm: c.createdAt,
      }));
    },
  },
  {
    name: 'tabela',
    description: 'Tabela de classificação do Brasileirão do app.',
    inputSchema: semEntrada,
    escrita: false,
    resumo: () => '',
    run: (_a, d) => d.liga.tabela(),
  },
  {
    name: 'calendario',
    description: 'Próximos jogos sem placar (Brasileirão e Copa).',
    inputSchema: semEntrada,
    escrita: false,
    resumo: () => '',
    run: (_a, d) => d.liga.calendario(),
  },
  {
    name: 'bolao_ranking',
    description: 'Ranking geral do bolão (pontos e placares exatos).',
    inputSchema: semEntrada,
    escrita: false,
    resumo: () => '',
    run: async (_a, d) =>
      (await d.bolao.ranking()).map((l) => ({
        posicao: l.posicao,
        nome: l.usuario.nome,
        pontos: l.pontos,
        exatos: l.exatos,
      })),
  },
  {
    name: 'criar_post',
    description:
      'Publica um post de texto (até 500 caracteres) como CBF. Todo mundo recebe o aviso normal.',
    inputSchema: {
      type: 'object',
      properties: { texto: { type: 'string', minLength: 1, maxLength: 500 } },
      required: ['texto'],
      additionalProperties: false,
    },
    escrita: true,
    resumo: (a) => `post: '${cortar(a.texto)}'`,
    run: async (a, d, admin) => {
      const p = await d.posts.criar(
        admin,
        { comoCbf: true, texto: a.texto },
        [],
        [],
      );
      return { id: p.id };
    },
  },
  {
    name: 'postar_no_clube',
    description:
      'Publica um post no clube do admin (o do técnico logado no app), com push normal. Só imagens OU só vídeo. imagens: de 1 a 10 itens {cheia, mini}, JPEG em base64 (cheia 1080x1350, mini com 400 px no lado maior); video: MP4 H.264 4:5 de até 30 s em base64. legenda: até 2200 caracteres.',
    inputSchema: {
      type: 'object',
      properties: {
        legenda: { type: 'string', maxLength: 2200 },
        imagens: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          items: {
            type: 'object',
            properties: { cheia: { type: 'string' }, mini: { type: 'string' } },
            required: ['cheia', 'mini'],
            additionalProperties: false,
          },
        },
        video: { type: 'string' },
      },
      required: ['legenda'],
      additionalProperties: false,
    },
    escrita: true,
    registro: (a) => ({
      legenda: typeof a.legenda === 'string' ? a.legenda.slice(0, 500) : '',
      ...(a.imagens !== undefined && {
        imagens: Array.isArray(a.imagens) ? a.imagens.length : 0,
      }),
      ...(a.video !== undefined && { video: true }),
    }),
    resumo: (a) =>
      `post do clube: '${cortar(a.legenda)}' · ${a.video ? 'vídeo' : `${String(a.imagens ?? 0)} imagens`}`,
    run: async (a, d, admin) => {
      if (!admin.club || admin.club.oficial)
        throw new ApiError(
          403,
          'SEM_CLUBE',
          'O admin precisa ter um clube para postar no clube.',
        );
      if ((a.imagens === undefined) === (a.video === undefined))
        throw invalido('Envie só imagens ou só um vídeo.', 'imagens');
      let cheia: { buffer: Buffer }[] = [];
      let mini: { buffer: Buffer }[] = [];
      let video: { buffer: Buffer } | undefined;
      if (a.imagens !== undefined) {
        const itens = lista(a.imagens, 'imagens');
        if (itens.length < 1 || itens.length > 10)
          throw invalido('Envie de 1 a 10 imagens.', 'imagens');
        cheia = itens.map((i) => decodificar(i.cheia, 'cheia'));
        // mini faltando fica de fora: o PostsService recusa (400) quando o número não bate com as cheias, como no post normal
        mini = itens
          .filter((i) => i.mini !== undefined)
          .map((i) => decodificar(i.mini, 'mini'));
      } else video = decodificar(a.video, 'video');
      const p = await d.posts.criar(
        admin,
        { legenda: a.legenda ?? '' },
        cheia,
        mini,
        true,
        video,
      );
      return { id: p.id };
    },
  },
  {
    name: 'criar_story',
    description:
      'Publica um story de texto como CBF (some em 24 h). Até 200 caracteres e 8 linhas; fundo: gramado (padrão), carvao, vermelho ou azul.',
    inputSchema: {
      type: 'object',
      properties: {
        texto: { type: 'string', minLength: 1, maxLength: 200 },
        fundo: {
          type: 'string',
          enum: ['gramado', 'carvao', 'vermelho', 'azul'],
        },
      },
      required: ['texto'],
      additionalProperties: false,
    },
    escrita: true,
    resumo: (a) => `story: '${cortar(a.texto)}'`,
    run: async (a, d, admin) => {
      const s = await d.stories.criar(admin, {
        comoCbf: true,
        texto: a.texto,
        fundo: a.fundo,
      });
      return { id: s.id };
    },
  },
  {
    name: 'lancar_placares',
    description:
      'Lança placares de jogos de uma rodada do Brasileirão ainda aberta. Troca só os jogos informados (achados por mandanteId + visitanteId); os outros ficam como estão. Fechar a rodada não é possível por aqui.',
    inputSchema: {
      type: 'object',
      properties: {
        rodada: { type: 'integer', minimum: 1, maximum: 38 },
        placares: { type: 'array', items: placar(), minItems: 1 },
      },
      required: ['rodada', 'placares'],
      additionalProperties: false,
    },
    escrita: true,
    resumo: (a) =>
      `rodada ${String(a.rodada)} · ${Array.isArray(a.placares) ? a.placares.length : 0} placares`,
    run: async (a, d) => {
      const novos = lista(a.placares, 'placares');
      const rodada = (await d.liga.rodadas()).find(
        (r) => r.numero === a.rodada,
      );
      if (!rodada)
        throw new ApiError(404, 'NAO_ENCONTRADO', 'Rodada não encontrada.');
      const atuais = rodada.jogos.map((j) => ({
        mandanteId: j.mandante.id,
        visitanteId: j.visitante.id,
        golsMandante: j.golsMandante,
        golsVisitante: j.golsVisitante,
      }));
      await d.liga.lancarJogos(rodada.numero, {
        jogos: mesclar(atuais, novos, ['golsMandante', 'golsVisitante']),
      });
      return { rodada: rodada.numero, atualizados: novos.length };
    },
  },
  {
    name: 'lancar_placares_copa',
    description:
      'Lança placares (e pênaltis) de jogos de uma fase da Copa ainda aberta. Troca só os jogos informados (mandanteId + visitanteId). Fechar a fase não é possível por aqui.',
    inputSchema: {
      type: 'object',
      properties: {
        faseId: { type: 'string' },
        placares: {
          type: 'array',
          items: placar({
            penaltisMandante: { type: 'integer', minimum: 0, maximum: 99 },
            penaltisVisitante: { type: 'integer', minimum: 0, maximum: 99 },
          }),
          minItems: 1,
        },
      },
      required: ['faseId', 'placares'],
      additionalProperties: false,
    },
    escrita: true,
    resumo: (a) =>
      `fase da copa · ${Array.isArray(a.placares) ? a.placares.length : 0} placares`,
    run: async (a, d) => {
      const novos = lista(a.placares, 'placares');
      const fase = (await d.copa.chave()).find((f) => f.fase.id === a.faseId);
      if (!fase)
        throw new ApiError(404, 'NAO_ENCONTRADO', 'Fase não encontrada.');
      const atuais = fase.jogos.map((j) => ({
        mandanteId: j.mandante.id,
        visitanteId: j.visitante.id,
        golsMandante: j.golsMandante,
        golsVisitante: j.golsVisitante,
        penaltisMandante: j.penaltisMandante,
        penaltisVisitante: j.penaltisVisitante,
      }));
      await d.copa.lancarJogos(fase.fase.id, {
        jogos: mesclar(atuais, novos, [
          'golsMandante',
          'golsVisitante',
          'penaltisMandante',
          'penaltisVisitante',
        ]),
      });
      return { fase: fase.fase.nome, atualizados: novos.length };
    },
  },
];

/** Resumo curto da ação para o log do admin (a entrada em si fica só no banco). */
export const resumir = (ferramenta: string, entrada: unknown) =>
  FERRAMENTAS.find((f) => f.name === ferramenta)?.resumo(
    (entrada ?? {}) as Args,
  ) || ferramenta;

/** "<codigo>: <mensagem>" de um erro de negócio (ApiError ou outra HttpException); null se não for. */
export function textoDoErro(e: unknown): string | null {
  if (!(e instanceof HttpException)) return null;
  const r = e.getResponse() as { codigo?: string; mensagem?: string } | string;
  return typeof r === 'object' && r.codigo
    ? `${r.codigo}: ${r.mensagem}`
    : `ERRO_${e.getStatus()}: ${e.message}`;
}
