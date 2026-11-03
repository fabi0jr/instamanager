import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vazio, adicionar, mover, editar } from './board.mjs';

const nova = (q, extra = {}) => adicionar(q, { titulo: 'x', tipo: 'front', criterios: ['ok'], ...extra });

test('fluxo feliz até concluído', () => {
  const q = vazio();
  const t = nova(q);
  for (const c of ['pronto', 'dev', 'revisao', 'qa', 'concluido']) mover(q, t.id, c);
  assert.equal(t.coluna, 'concluido');
  assert.equal(t.historico.length, 6);
});

test('não pula etapas', () => {
  const q = vazio();
  const t = nova(q);
  assert.throws(() => mover(q, t.id, 'concluido'), /não pode ir/);
});

test('reprovar exige nota e volta para dev', () => {
  const q = vazio();
  const t = nova(q);
  for (const c of ['pronto', 'dev', 'revisao', 'qa']) mover(q, t.id, c);
  assert.throws(() => mover(q, t.id, 'correcao'), /exige nota/);
  mover(q, t.id, 'correcao', { nota: 'botão não salva' });
  mover(q, t.id, 'dev');
  assert.equal(t.coluna, 'dev');
});

test('dependência bloqueia início do dev', () => {
  const q = vazio();
  const a = nova(q);
  const b = nova(q, { depende: [a.id] });
  mover(q, b.id, 'pronto');
  assert.throws(() => mover(q, b.id, 'dev'), /depende/);
});

test('valida campos obrigatórios', () => {
  const q = vazio();
  assert.throws(() => adicionar(q, { titulo: 'x', tipo: 'front' }), /critério/);
  assert.throws(() => adicionar(q, { titulo: 'x', tipo: 'nada', criterios: ['a'] }), /tipo/);
  assert.throws(() => nova(q, { depende: ['IM-99'] }), /não existe/);
});

test('edita título e substitui critérios, registrando no histórico', () => {
  const q = vazio();
  const t = nova(q);
  editar(q, t.id, { titulo: 'novo', criterios: ['a', 'b'] });
  assert.equal(t.titulo, 'novo');
  assert.deepEqual(t.criterios, ['a', 'b']);
  assert.match(t.historico.at(-1).nota, /titulo, criterios/);
  assert.throws(() => editar(q, t.id, {}), /nada para editar/);
  assert.throws(() => editar(q, t.id, { criterios: [] }), /critério/);
});

test('edita dependências validando existência e auto-dependência', () => {
  const q = vazio();
  const a = nova(q);
  const b = nova(q);
  editar(q, b.id, { depende: [a.id] });
  assert.deepEqual(b.depende, [a.id]);
  assert.throws(() => editar(q, b.id, { depende: [b.id] }), /si mesma/);
  assert.throws(() => editar(q, b.id, { depende: ['IM-99'] }), /não existe/);
});
