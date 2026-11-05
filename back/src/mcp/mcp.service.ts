import { Injectable, Logger } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { BolaoService } from '../bolao/bolao.service.js';
import { CopaService } from '../copa/copa.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { LigaService } from '../liga/liga.service.js';
import { PostsService } from '../posts/posts.service.js';
import { PrismaService } from '../prisma.service.js';
import { StoriesService } from '../stories/stories.service.js';
import { VotacoesService } from '../votacoes/votacoes.service.js';
import { FERRAMENTAS, textoDoErro } from './ferramentas.js';

const resultado = (texto: string, isError = false) => ({
  content: [{ type: 'text' as const, text: texto }],
  ...(isError && { isError }),
});

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly stories: StoriesService,
    private readonly votacoes: VotacoesService,
    private readonly liga: LigaService,
    private readonly copa: CopaService,
    private readonly bolao: BolaoService,
  ) {}

  /** Um servidor por pedido (modo sem sessão): lista as ferramentas e despacha as chamadas. */
  criarServidor() {
    const server = new Server(
      { name: 'instamanager-cbf', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );
    server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: FERRAMENTAS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema: inputSchema as { type: 'object' },
      })),
    }));
    server.setRequestHandler(CallToolRequestSchema, (req) =>
      this.chamar(req.params.name, req.params.arguments),
    );
    return server;
  }

  /** Erro de negócio vira resultado da ferramenta (`isError`), não erro de protocolo. Escrita deixa uma McpAcao, ok ou não. */
  async chamar(nome: string, bruta: unknown) {
    const f = FERRAMENTAS.find((x) => x.name === nome);
    if (!f) return resultado(`FERRAMENTA_DESCONHECIDA: ${nome}`, true);
    const args = (
      typeof bruta === 'object' && bruta && !Array.isArray(bruta) ? bruta : {}
    ) as Record<string, unknown>;
    let erro: string | null = null;
    let saida: unknown;
    try {
      const admin = await this.admin();
      if (!admin && f.escrita)
        erro = 'SEM_ADMIN: não há admin para postar como CBF.';
      else
        saida = await f.run(
          args,
          {
            prisma: this.prisma,
            posts: this.posts,
            stories: this.stories,
            votacoes: this.votacoes,
            liga: this.liga,
            copa: this.copa,
            bolao: this.bolao,
          },
          admin!,
        );
    } catch (e) {
      erro = textoDoErro(e);
      if (!erro) {
        this.logger.error(e);
        erro = 'ERRO_INTERNO: algo deu errado do nosso lado.';
      }
    }
    if (f.escrita) {
      try {
        await this.prisma.mcpAcao.create({
          data: {
            ferramenta: nome,
            entrada: (f.registro?.(args) ?? args) as Prisma.InputJsonObject,
            ok: erro === null,
            erro,
          },
        });
      } catch (e) {
        this.logger.error(e); // o log falhar não pode desfazer nem esconder a ação
      }
    }
    return erro
      ? resultado(erro, true)
      : resultado(JSON.stringify(saida ?? null));
  }

  /** Mesmo admin do anúncio de conquistas: o primeiro `isAdmin` por criação. */
  private admin() {
    return this.prisma.user.findFirst({
      where: { isAdmin: true },
      include: { club: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }
}
