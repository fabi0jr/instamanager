import { randomUUID } from 'node:crypto';
import { semear } from '../prisma/seed.js';
import { PrismaService } from '../src/prisma.service.js';

describe('banco (migrations + seed)', () => {
  const prisma = new PrismaService();
  const emails: string[] = [];
  const criarUsuario = async () => {
    const email = `teste-${randomUUID()}@exemplo.com`;
    emails.push(email);
    return prisma.user.create({ data: { email, passwordHash: 'x', name: 'Teste' } });
  };

  beforeAll(() => semear(prisma, 'convite-teste'));
  afterAll(async () => {
    const ids = (await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((u) => u.id);
    await prisma.club.updateMany({ where: { coachId: { in: ids } }, data: { coachId: null } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('seed cria os 20 clubes da Série A e a CBF (oficial)', async () => {
    await semear(prisma); // idempotente
    // clubes teste-* são de outros arquivos rodando em paralelo
    expect(await prisma.club.count({ where: { id: { not: { startsWith: 'teste-' } } } })).toBe(21);
    expect(await prisma.club.findUnique({ where: { id: 'cbf' } })).toMatchObject({ oficial: true, coachId: null });
    expect(await prisma.setting.findUnique({ where: { key: 'inviteCode' } })).not.toBeNull();
  });

  it('Club.coachId único impede o mesmo usuário em dois clubes', async () => {
    const u = await criarUsuario();
    await prisma.club.update({ where: { id: 'palmeiras' }, data: { coachId: u.id } });
    await expect(prisma.club.update({ where: { id: 'santos' }, data: { coachId: u.id } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('apagar o post apaga imagens, curtidas e comentários', async () => {
    const u = await criarUsuario();
    const post = await prisma.post.create({
      data: {
        clubId: 'flamengo',
        authorId: u.id,
        caption: 'oi',
        images: { create: { position: 0, fullPath: '/uploads/a.jpg', thumbPath: '/uploads/b.jpg', width: 1, height: 1 } },
        likes: { create: { userId: u.id } },
        comments: { create: { userId: u.id, text: 'x' } },
      },
    });
    await prisma.post.delete({ where: { id: post.id } });
    expect(await prisma.postImage.count({ where: { postId: post.id } })).toBe(0);
    expect(await prisma.like.count({ where: { postId: post.id } })).toBe(0);
    expect(await prisma.comment.count({ where: { postId: post.id } })).toBe(0);
  });
});
