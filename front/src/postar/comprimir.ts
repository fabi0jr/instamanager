export class ErroImagem extends Error {}

// Reduz para caber em ladoMax (nunca aumenta) e reenvia como JPEG 0,82. EXIF é aplicado ao decodificar.
export async function comprimir(arquivo: File, ladoMax: number) {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    throw new ErroImagem('Não deu para ler essa imagem');
  }
  const escala = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
  const largura = Math.round(bmp.width * escala);
  const altura = Math.round(bmp.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bmp.close?.();
    throw new ErroImagem('Não deu para processar essa imagem');
  }
  ctx.drawImage(bmp, 0, 0, largura, altura);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82));
  if (!blob) throw new ErroImagem('Não deu para comprimir essa imagem');
  return { blob, largura, altura };
}

// Capa do clube: recorta no centro para 3:1 e reduz a 1500×500 (o back valida JPEG ≤ 3 MB)
export async function comprimirCapa(arquivo: File) {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    throw new ErroImagem('Não deu para ler essa imagem');
  }
  const [W, H] = [1500, 500];
  const largaDemais = bmp.width / bmp.height > W / H;
  const sw = largaDemais ? Math.round(bmp.height * (W / H)) : bmp.width;
  const sh = largaDemais ? bmp.height : Math.round(bmp.width / (W / H));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bmp.close?.();
    throw new ErroImagem('Não deu para processar essa imagem');
  }
  ctx.drawImage(bmp, Math.round((bmp.width - sw) / 2), Math.round((bmp.height - sh) / 2), sw, sh, 0, 0, W, H);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82));
  if (!blob) throw new ErroImagem('Não deu para comprimir essa imagem');
  return blob;
}
