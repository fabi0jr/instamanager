import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma.service.js';
import { apagarClubesDeTeste, cadastrarUsuario, criarApp, criarClubesDeTeste } from './helpers.js';

// Clube teste-og-1 é só deste arquivo (os e2e rodam em paralelo no mesmo banco).
describe('GET /api/og/p/:id: prévia do WhatsApp (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<INestApplication['getHttpServer']>;
  let clube: string, autor: string;
  const base = process.env.APP_URL ?? 'http://localhost:5173';
  const og = (id: string) => request(http()).get(`/api/og/p/${id}`); // público: sem cookie nem Origin
  const meta = (html: string, prop: string) => html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`))?.[1];
  const novoPost = async (data: object = {}, imagens = 0) =>
    (await prisma.post.create({
      data: {
        clubId: clube, authorId: autor, caption: 'Legenda', ...data,
        images: { create: Array.from({ length: imagens }, (_, i) => ({ position: i, fullPath: `/uploads/posts/cheia${i}.jpg`, thumbPath: `/uploads/posts/mini${i}.jpg`, width: 800, height: 600 })) },
      },
    })).id;

  beforeAll(async () => {
    const c = await criarApp();
    ({ app, prisma, http } = c);
    [clube] = await criarClubesDeTeste(prisma, 'og', 1);
    autor = (await cadastrarUsuario(c.post, prisma, clube, 'Técnico OG')).id;
  });
  afterEach(() => prisma.post.deleteMany({ where: { clubId: clube } }));
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: autor } });
    await apagarClubesDeTeste(prisma, [clube]);
    await app.close();
  });

  it('post com imagem: og:image absoluta (a mini), título com o clube, legenda cortada em 150, url e refresh', async () => {
    const id = await novoPost({ caption: 'a'.repeat(400) }, 2);
    const res = await og(id).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers.vary).toContain('User-Agent');
    const html = res.text;
    expect(meta(html, 'og:title')).toBe('Teste og 1 no InstaManager');
    expect(meta(html, 'og:image')).toBe(`${base}/uploads/posts/mini0.jpg`);
    expect(meta(html, 'og:url')).toBe(`${base}/p/${id}`);
    expect(meta(html, 'og:description')!.length).toBeLessThanOrEqual(150);
    expect(meta(html, 'og:description')!.startsWith('aaaa')).toBe(true);
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
    expect(html).toContain(`<meta http-equiv="refresh" content="0;url=/p/${id}">`);
  });

  it('legenda curta vai inteira; espaços e quebras de linha viram um espaço só', async () => {
    const id = await novoPost({ caption: 'Golaço\n\n  de   falta' }, 1);
    expect(meta((await og(id).expect(200)).text, 'og:description')).toBe('Golaço de falta');
  });

  it('post de texto: descrição é o texto e a imagem é o ícone 512 (absoluto)', async () => {
    const id = await novoPost({ caption: '', texto: 'Rodada boa!' });
    const html = (await og(id).expect(200)).text;
    expect(meta(html, 'og:description')).toBe('Rodada boa!');
    expect(meta(html, 'og:image')).toBe(`${base}/icones/icon-512.png`);
  });

  it('escapa HTML da legenda: <script> vira texto, aspas não fecham o atributo', async () => {
    const id = await novoPost({ caption: '<script>alert(1)</script> "oi" & \'x\'' }, 1);
    const html = (await og(id).expect(200)).text;
    expect(html).not.toContain('<script>');
    expect(html).not.toMatch(/<script/i);
    expect(meta(html, 'og:description')).toBe('&lt;script&gt;alert(1)&lt;/script&gt; &quot;oi&quot; &amp; &#39;x&#39;');
  });

  it('post oculto, inexistente e id inválido → 200 com a prévia genérica (nunca 404 nem 500, nada do post)', async () => {
    const oculto = await novoPost({ caption: 'Segredo do post oculto', hiddenAt: new Date() }, 1);
    for (const id of [oculto, '00000000-0000-4000-8000-000000000000', 'nao-e-uuid', '%00', 'a'.repeat(500)]) {
      const res = await og(id).expect(200);
      expect(res.text).not.toContain('Segredo');
      expect(meta(res.text, 'og:title')).toBe('InstaManager');
      expect(meta(res.text, 'og:image')).toBe(`${base}/icones/icon-512.png`);
      expect(meta(res.text, 'og:url')).toBe(base);
    }
  });

  it('o título escapa o nome do clube', async () => {
    await prisma.club.update({ where: { id: clube }, data: { name: 'A<b>&"C' } });
    const id = await novoPost({}, 1);
    expect(meta((await og(id).expect(200)).text, 'og:title')).toBe('A&lt;b&gt;&amp;&quot;C no InstaManager');
  });
});
