import { register } from 'node:module';

// O client gerado importa './x.js' mas só existe x.ts; o Node 24 roda TS, mas não faz esse mapeamento.
// shortcut: só para o seed em dev/deploy; se virar mais que isso, compilar com tsc.
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) { if (spec.endsWith('.js')) return next(spec.slice(0, -3) + '.ts', ctx); throw e; }
}`));
