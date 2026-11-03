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
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, largura, altura);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82));
  if (!blob) throw new ErroImagem('Não deu para comprimir essa imagem');
  return { blob, largura, altura };
}
