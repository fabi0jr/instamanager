import { test as base, expect } from '@playwright/test';
import { NOVIDADES } from '../../front/src/novidades';

// Aparelho que já passou por /instalar e já viu as novidades: nenhuma tela de boas-vindas na frente do que se testa
export const test = base.extend({
  context: async ({ context }, usar) => {
    await context.addInitScript((id) => {
      localStorage.setItem('im:instalar-visto', '1');
      localStorage.setItem('im:novidades-vistas', id);
    }, NOVIDADES.id);
    await usar(context);
  },
});
export { expect };
