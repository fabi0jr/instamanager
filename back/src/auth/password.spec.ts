import { hashPassword, semaforo, verifyPassword } from './password.js';

describe('password (scrypt)', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const guardado = await hashPassword('senha-boa-123');
    expect(guardado).toMatch(/^scrypt\$131072\$8\$1\$/);
    await expect(verifyPassword('senha-boa-123', guardado)).resolves.toBe(true);
    await expect(verifyPassword('senha-ruim-123', guardado)).resolves.toBe(false);
  });

  it('mesma senha gera hashes diferentes (sal)', async () => {
    expect(await hashPassword('igual-igual')).not.toBe(await hashPassword('igual-igual'));
  });

  it('recusa formato desconhecido', async () => {
    await expect(verifyPassword('x', 'bcrypt$abc')).resolves.toBe(false);
  });
});

describe('semaforo', () => {
  it('nunca passa de 2 ao mesmo tempo e roda todos, mesmo com erro', async () => {
    const comVaga = semaforo(2);
    let ativos = 0;
    let pico = 0;
    const tarefa = (i: number) =>
      comVaga(async () => {
        pico = Math.max(pico, ++ativos);
        await new Promise((r) => setTimeout(r, 5));
        ativos--;
        if (i === 3) throw new Error('falhou');
        return i;
      });
    const resultados = await Promise.allSettled([0, 1, 2, 3, 4, 5].map(tarefa));
    expect(pico).toBe(2);
    expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
  });
});
