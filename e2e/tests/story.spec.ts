import { expect, test } from './base';

// JPEG 1×1 válido (o app só aceita imagem ou vídeo em story; não existe story de texto)
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

test('story publicado aparece na fileira de stories', async ({ page, request }) => {
  const criado = await request.post('/api/stories', { multipart: { imagem: { name: 'story.jpg', mimeType: 'image/jpeg', buffer: JPEG } } });
  expect(criado.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Stories' }).getByRole('link', { name: /Seu story/ })).toBeVisible();
});
