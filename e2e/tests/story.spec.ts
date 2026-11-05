import { expect, test } from './base';

// JPEG 1×1 válido
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

// roda antes do de imagem: o story de texto é o primeiro que o visualizador abre
test('story de texto com quebras de linha publica pela tela e cabe no visualizador', async ({ page }) => {
  await page.goto('/stories/novo');
  await page.getByRole('button', { name: /^Texto/ }).click();
  // 8 linhas (o máximo, 135 caracteres): o Enter vira CRLF no envio e o back precisa contar como 1 caractere
  await page.getByRole('textbox', { name: 'Texto do story' }).fill(Array.from({ length: 8 }, (_, i) => `Linha ${i + 1} do story`).join('\n'));
  await page.getByRole('radio', { name: 'Azul' }).click();
  await page.getByRole('button', { name: 'Publicar story' }).click();
  await expect(page.getByRole('list', { name: 'Stories' }).getByRole('link', { name: /Seu story/ })).toBeVisible();
  await page.getByRole('list', { name: 'Stories' }).getByRole('link', { name: /Seu story/ }).click();
  await expect(page.locator('.vis-texto')).toContainText('Linha 8 do story');
  await expect(page.locator('.vis-texto')).toBeInViewport({ ratio: 1 });
});

test('story publicado aparece na fileira de stories', async ({ page, request }) => {
  const criado = await request.post('/api/stories', { multipart: { imagem: { name: 'story.jpg', mimeType: 'image/jpeg', buffer: JPEG } } });
  expect(criado.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Stories' }).getByRole('link', { name: /Seu story/ })).toBeVisible();
});
