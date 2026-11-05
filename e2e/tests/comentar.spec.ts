import { expect, test } from './base';

test('folha de comentários: campo acima da barra inferior e o comentário aparece', async ({ page, request }) => {
  const texto = `Post para comentar ${Date.now()}`;
  const criado = await request.post('/api/posts', { multipart: { texto } });
  expect(criado.ok()).toBeTruthy();

  await page.goto('/');
  await page.locator('article', { hasText: texto }).getByRole('button', { name: 'Comentar' }).first().click(); // sem comentários o link de texto também se chama Comentar
  const campo = page.getByRole('textbox', { name: /Comente como/ });
  await expect(campo).toBeVisible();

  // no iPhone o campo ficava escondido atrás da barra: ele termina acima do topo dela
  const barra = await page.getByRole('navigation', { name: 'Principal' }).boundingBox();
  const caixa = await campo.boundingBox();
  expect(barra && caixa).toBeTruthy();
  expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(barra!.y);

  const comentario = `Comentário Safari ${Date.now()}`;
  await campo.fill(comentario);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText(comentario)).toBeInViewport();

  // responder: a faixa aparece, o campo continua acima da barra e a resposta fica recuada sob o comentário
  await page.getByRole('button', { name: 'Responder a Tecnico E2E' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Respondendo a Tecnico E2E' })).toBeVisible();
  const caixa2 = await campo.boundingBox();
  expect(caixa2!.y + caixa2!.height).toBeLessThanOrEqual(barra!.y);
  const resposta = `Resposta Safari ${Date.now()}`;
  await campo.fill(resposta);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.locator('ul.respostas').getByText(resposta)).toBeInViewport();
});
