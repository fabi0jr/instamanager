/** JPEG mínimo (assinatura + SOF0 com largura e altura): o bastante para ehJpeg e dimensoesJpeg. */
export function montarJpeg(largura: number, altura: number, extra = 0): Buffer {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff, 0x01, 0x01, 0x11, 0x00]);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]), sof, Buffer.alloc(extra), Buffer.from([0xff, 0xd9])]);
}
