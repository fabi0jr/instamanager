import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp, servirUploadsEmDev } from '../src/http.js';

describe('/uploads em dev (e2e)', () => {
  let dir: string;
  const subir = async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = mod.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    servirUploadsEmDev(app); // como o main.ts: antes do init
    app.setGlobalPrefix('api');
    await app.init();
    return app;
  };

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'im-dev-uploads-'));
    await mkdir(join(dir, 'posts'));
    await writeFile(join(dir, 'posts', 'a.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    await writeFile(join(dir, '.segredo'), 'x');
    vi.stubEnv('UPLOADS_DIR', dir);
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it('em dev serve o arquivo (e só ele): inexistente → 404, arquivo oculto e saída da pasta não passam', async () => {
    const app = await subir();
    try {
      const res = await request(app.getHttpServer()).get('/uploads/posts/a.jpg').expect(200);
      expect(res.headers['content-type']).toMatch(/image\/jpeg/);
      await request(app.getHttpServer()).get('/uploads/posts/nao-existe.jpg').expect(404);
      await request(app.getHttpServer()).get('/uploads/.segredo').expect(404);
      await request(app.getHttpServer()).get('/uploads/..%2f..%2fetc/passwd').expect(404);
    } finally {
      await app.close();
    }
  });

  it('em produção não serve nada (quem serve é o nginx)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const app = await subir();
    try {
      await request(app.getHttpServer()).get('/uploads/posts/a.jpg').expect(404);
    } finally {
      await app.close();
      vi.stubEnv('NODE_ENV', 'test');
    }
  });
});
