import { expect, test } from './base';

test('post de texto publicado aparece no feed', async ({ page }) => {
  const texto = `Post de texto no Safari ${Date.now()}`;
  await page.goto('/postar');
  await page.getByRole('radio', { name: 'Texto' }).click();
  await page.getByLabel('Texto do post').fill(texto);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText(texto)).toBeVisible();
});
