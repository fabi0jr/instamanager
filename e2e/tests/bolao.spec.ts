import { expect, test } from './base';

// O setup deixa a rodada 1 com Palmeiras × Flamengo sem placar e com prazo de palpite
test('palpite salvo persiste depois de recarregar', async ({ page }) => {
  await page.goto('/liga?aba=bolao');
  await page.getByRole('button', { name: 'Mais um gol para o Palmeiras' }).click(); // 0
  await page.getByRole('button', { name: 'Mais um gol para o Palmeiras' }).click(); // 1
  await page.getByRole('button', { name: 'Mais um gol para o Flamengo' }).click(); // 0
  await page.getByRole('button', { name: 'Salvar palpites' }).click();
  await expect(page.getByText('Palpites salvos.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Gols do Palmeiras, 1' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Gols do Flamengo, 0' })).toBeVisible();
});
