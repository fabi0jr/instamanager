import { ApiError } from '../http.js';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cursor opaco: `criadoEm|id` em base64url. */
export const codificarCursor = (criadoEm: Date, id: string) => Buffer.from(`${criadoEm.toISOString()}|${id}`).toString('base64url');

export function decodificarCursor(cursor: string | undefined): { criadoEm: Date; id: string } | null {
  if (cursor === undefined || cursor === '') return null;
  const [data, id, ...resto] = Buffer.from(cursor, 'base64url').toString().split('|');
  const criadoEm = new Date(data);
  if (resto.length || !id || !UUID.test(id) || Number.isNaN(criadoEm.getTime()))
    throw new ApiError(400, 'DADOS_INVALIDOS', 'Cursor inválido.', ['antes']);
  return { criadoEm, id };
}
