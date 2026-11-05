import { expect, test } from './base';

test('folha de comentários: campo acima da barra inferior e o comentário aparece', async ({ page, request }) => {
  const texto = `Post para comentar ${Date.now()}`;
  const criado = await request.post('/api/posts', { multipart: { texto } });
  expect(criado.ok()).toBeTruthy();

  await page.goto('/');
  await page.locator('article', { hasText: texto }).getByRole('button', { name: 'Comentar' }).click();
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
  // TODO(IM-64): responder um comentário (botão Responder, faixa "Respondendo a…", parentId) quando a resposta existir
});
