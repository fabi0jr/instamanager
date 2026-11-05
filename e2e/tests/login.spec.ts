import { SENHA, TECNICO_EMAIL } from '../global-setup';
import { expect, test } from './base';

test.use({ storageState: { cookies: [], origins: [] } }); // sem sessão

test('entra com e-mail e senha e vê o feed', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail').fill(TECNICO_EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toHaveCount(0);
});
