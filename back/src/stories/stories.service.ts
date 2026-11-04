import { Injectable } from '@nestjs/common';
import type { UserComClube } from '../auth/auth.service.js';
import type { Story } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import { processarVideo } from '../midia/video.js';
import { UUID } from '../posts/cursor.js';
import { apagarImagem, dimensoesJpeg, ehJpeg, salvarImagem } from '../posts/imagens.js';
import { PrismaService } from '../prisma.service.js';

const DURACAO_MS = 24 * 3_600_000;
const MAX_IMAGEM = 3 * 1024 * 1024;
type Arquivo = { buffer: Buffer };
const naoEncontrado = () => new ApiError(404, 'NAO_ENCONTRADO', 'Não encontramos o que você procurou.');
const invalido = (mensagem: string, campo: string) => new ApiError(400, 'DADOS_INVALIDOS', mensagem, [campo]);
const clubeMini = (c: { id: string; name: string; crestPath: string }) => ({ id: c.id, nome: c.name, escudoUrl: c.crestPath });
const itemJson = (s: Story, visto: boolean) => ({ id: s.id, tipo: s.tipo, url: s.path, capaUrl: s.capaPath, criadoEm: s.createdAt, visto });

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Story vivo (não expirado) ou 404: expirado some de tudo, mesmo antes da limpeza apagar a linha. */
  private async vivo(id: string) {
    const s = UUID.test(id) ? await this.prisma.story.findFirst({ where: { id, expiraEm: { gt: new Date() } }, include: { club: true } }) : null;
    if (!s) throw naoEncontrado();
    return s;
  }

  /** Imagem (JPEG ≤ 3 MB) ou vídeo (≤ 30 s, convertido) do clube do técnico atual; o admin posta como CBF. Some em 24 h. */
  async criar(user: UserComClube, corpo: { comoCbf?: unknown }, imagem?: Arquivo, video?: Arquivo) {
    const comoCbf = corpo.comoCbf === true || corpo.comoCbf === 'true';
    if (comoCbf && !user.isAdmin) throw new ApiError(403, 'NAO_E_ADMIN', 'Só o admin posta story como CBF.');
    const clubId = comoCbf ? 'cbf' : user.club?.id;
    if (!clubId) throw new ApiError(403, 'SEM_CLUBE', 'Só técnicos com clube podem postar story.');
    if (!imagem === !video) throw invalido('Envie uma imagem ou um vídeo.', imagem ? 'video' : 'imagem');

    const base = { clubId, autorId: user.id, expiraEm: new Date(Date.now() + DURACAO_MS) };
    let gravados: string[] = [];
    let dados: Omit<Parameters<PrismaService['story']['create']>[0]['data'], 'club' | 'autor'>;
    if (imagem) {
      if (imagem.buffer.length > MAX_IMAGEM) throw new ApiError(413, 'ARQUIVO_GRANDE', 'A imagem passou de 3 MB.');
      const dims = ehJpeg(imagem.buffer) ? dimensoesJpeg(imagem.buffer) : null;
      if (!dims) throw new ApiError(400, 'IMAGEM_INVALIDA', 'Não consegui ler a imagem. Envie JPEG.');
      const path = await salvarImagem(imagem.buffer, 'stories');
      gravados = [path];
      dados = { ...base, tipo: 'IMAGEM', path, largura: dims.largura, altura: dims.altura };
    } else {
      const v = await processarVideo(video!.buffer, 'stories');
      gravados = [v.path, v.capaPath];
      dados = { ...base, tipo: 'VIDEO', path: v.path, capaPath: v.capaPath, duracaoS: v.duracaoS, largura: v.largura, altura: v.altura };
    }
    try {
      const s = await this.prisma.story.create({ data: dados as Parameters<PrismaService['story']['create']>[0]['data'], include: { club: true } });
      return { ...itemJson(s, false), clube: clubeMini(s.club), expiraEm: s.expiraEm };
    } catch (e) {
      await Promise.all(gravados.map(apagarImagem));
      throw e;
    }
  }

  /** Uma bolinha por clube com story vivo: as não vistas primeiro, e dentro de cada grupo a do story mais novo primeiro. Stories do mais velho ao mais novo. */
  async listar(user: UserComClube) {
    const stories = await this.prisma.story.findMany({
      where: { expiraEm: { gt: new Date() } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { club: true, vistos: { where: { userId: user.id }, select: { userId: true } } },
    });
    const grupos = new Map<string, { clube: ReturnType<typeof clubeMini>; stories: ReturnType<typeof itemJson>[]; todosVistos: boolean; maisNovo: number }>();
    for (const s of stories) {
      const g = grupos.get(s.clubId) ?? { clube: clubeMini(s.club), stories: [], todosVistos: true, maisNovo: 0 };
      g.stories.push(itemJson(s, s.vistos.length > 0));
      g.todosVistos &&= s.vistos.length > 0;
      g.maisNovo = Math.max(g.maisNovo, s.createdAt.getTime());
      grupos.set(s.clubId, g);
    }
    return [...grupos.values()]
      .sort((a, b) => Number(a.todosVistos) - Number(b.todosVistos) || b.maisNovo - a.maisNovo)
      .map(({ clube, stories: itens, todosVistos }) => ({ clube, stories: itens, todosVistos }));
  }

  async visto(id: string, user: UserComClube) {
    await this.vivo(id);
    await this.prisma.storyVisto.createMany({ data: [{ storyId: id, userId: user.id }], skipDuplicates: true });
  }

  /** Quem viu (sem o próprio autor): só o autor do story ou o admin. */
  async vistos(id: string, user: UserComClube) {
    const s = await this.vivo(id);
    if (s.autorId !== user.id && !user.isAdmin) throw new ApiError(403, 'NAO_E_AUTOR', 'Só quem postou o story (ou o admin) vê quem viu.');
    const lista = await this.prisma.storyVisto.findMany({ where: { storyId: id, userId: { not: s.autorId } }, orderBy: [{ vistoEm: 'desc' }, { userId: 'asc' }], include: { user: { select: { id: true, name: true } } } });
    return lista.map((v) => ({ id: v.user.id, nome: v.user.name }));
  }

  /** Autor, técnico atual do clube ou admin. Apaga a linha e os arquivos. */
  async apagar(id: string, user: UserComClube) {
    const s = await this.vivo(id);
    if (s.autorId !== user.id && s.club.coachId !== user.id && !user.isAdmin) throw new ApiError(403, 'NAO_E_AUTOR', 'Só quem postou, o técnico do clube ou o admin apaga o story.');
    await this.prisma.story.deleteMany({ where: { id } });
    await Promise.all([s.path, s.capaPath].flatMap((p) => (p ? [apagarImagem(p)] : [])));
  }
}
