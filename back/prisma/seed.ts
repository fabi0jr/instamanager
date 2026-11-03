import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { clubes } from './clubes.js';

type Db = Pick<PrismaClient, 'club' | 'setting'>;

// Idempotente: roda no deploy sem duplicar nem apagar técnicos.
export async function semear(db: Db, inviteCode = process.env.INVITE_CODE) {
  for (const c of clubes) {
    await db.club.upsert({ where: { id: c.id }, update: { name: c.name, crestPath: c.crestPath }, create: c });
  }
  // o código só nasce aqui; depois quem manda é o admin (PUT /api/admin/convite)
  if (inviteCode) await db.setting.upsert({ where: { key: 'inviteCode' }, update: {}, create: { key: 'inviteCode', value: inviteCode } });
}

if (process.argv[1]?.endsWith('seed.ts')) {
  process.loadEnvFile('../.env');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  await semear(prisma);
  await prisma.$disconnect();
}
