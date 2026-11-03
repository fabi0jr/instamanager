#!/usr/bin/env node
// Quadro de tarefas do InstaManager. Só o P.O escreve aqui; os outros agentes leem com `list`/`show`.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const COLUNAS = ['backlog', 'pronto', 'dev', 'revisao', 'qa', 'correcao', 'concluido'];
export const TIPOS = ['design', 'front', 'back', 'qa', 'infra'];

// Fluxo: backlog → pronto → dev → revisao → qa → concluido; revisao/qa reprovam para correcao, que volta para dev.
const TRANSICOES = {
  backlog: ['pronto'],
  pronto: ['dev', 'backlog'],
  dev: ['revisao', 'pronto'],
  revisao: ['qa', 'correcao'],
  qa: ['concluido', 'correcao'],
  correcao: ['dev'],
  concluido: [],
};

const ARQUIVO = fileURLToPath(new URL('./tasks.json', import.meta.url));
const agora = () => new Date().toISOString();

export function vazio() {
  return { proximoId: 1, tarefas: [] };
}

function achar(quadro, id) {
  const t = quadro.tarefas.find((t) => t.id === id);
  if (!t) throw new Error(`tarefa ${id} não existe`);
  return t;
}

export function adicionar(quadro, { titulo, tipo, prioridade = 'media', criterios = [], depende = [], descricao = '', quem = 'PO' }) {
  if (!titulo) throw new Error('titulo é obrigatório');
  if (!TIPOS.includes(tipo)) throw new Error(`tipo inválido: ${tipo} (use ${TIPOS.join(', ')})`);
  if (!['alta', 'media', 'baixa'].includes(prioridade)) throw new Error(`prioridade inválida: ${prioridade}`);
  if (criterios.length === 0) throw new Error('toda tarefa precisa de pelo menos um critério de pronto');
  depende.forEach((d) => achar(quadro, d));
  const id = `IM-${quadro.proximoId++}`;
  const t = { id, titulo, tipo, prioridade, descricao, criterios, depende, responsavel: null, coluna: 'backlog', historico: [{ quando: agora(), quem, nota: 'criada' }] };
  quadro.tarefas.push(t);
  return t;
}

export function mover(quadro, id, para, { quem = 'PO', nota = '' } = {}) {
  const t = achar(quadro, id);
  if (!COLUNAS.includes(para)) throw new Error(`coluna inválida: ${para}`);
  if (!TRANSICOES[t.coluna].includes(para)) {
    throw new Error(`${id} não pode ir de "${t.coluna}" para "${para}" (permitido: ${TRANSICOES[t.coluna].join(', ') || 'nada'})`);
  }
  if (para === 'correcao' && !nota) throw new Error('reprovar exige nota com o motivo e como reproduzir');
  if (para === 'dev') {
    const pendentes = t.depende.filter((d) => achar(quadro, d).coluna !== 'concluido');
    if (pendentes.length) throw new Error(`${id} depende de tarefas não concluídas: ${pendentes.join(', ')}`);
  }
  t.historico.push({ quando: agora(), quem, de: t.coluna, para, nota });
  t.coluna = para;
  return t;
}

export function atribuir(quadro, id, responsavel, quem = 'PO') {
  const t = achar(quadro, id);
  t.responsavel = responsavel;
  t.historico.push({ quando: agora(), quem, nota: `atribuída a ${responsavel}` });
  return t;
}

export function editar(quadro, id, { titulo, criterios, descricao, prioridade, depende }, quem = 'PO') {
  const t = achar(quadro, id);
  if (depende) {
    if (depende.includes(id)) throw new Error(`${id} não pode depender de si mesma`);
    depende.forEach((d) => achar(quadro, d));
  }
  if (prioridade && !['alta', 'media', 'baixa'].includes(prioridade)) throw new Error(`prioridade inválida: ${prioridade}`);
  if (criterios && criterios.length === 0) throw new Error('toda tarefa precisa de pelo menos um critério de pronto');
  const mudou = Object.entries({ titulo, criterios, descricao, prioridade, depende }).filter(([, v]) => v !== undefined);
  if (mudou.length === 0) throw new Error('nada para editar');
  for (const [k, v] of mudou) t[k] = v;
  t.historico.push({ quando: agora(), quem, nota: `editado: ${mudou.map(([k]) => k).join(', ')}` });
  return t;
}

export function comentar(quadro, id, nota, quem = 'PO') {
  achar(quadro, id).historico.push({ quando: agora(), quem, nota });
}

function carregar() {
  try {
    return JSON.parse(readFileSync(ARQUIVO, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return vazio();
    throw e;
  }
}

function salvar(quadro) {
  // grava num temporário e renomeia, para a página nunca ler um JSON pela metade
  writeFileSync(ARQUIVO + '.tmp', JSON.stringify(quadro, null, 2) + '\n');
  renameSync(ARQUIVO + '.tmp', ARQUIVO);
}

const AJUDA = `uso: node board/board.mjs <comando>
  list [coluna]                              lista tarefas
  show <ID>                                  mostra uma tarefa com histórico
  add --titulo T --tipo ${TIPOS.join('|')} --criterio C [--criterio C2] [--prioridade alta|media|baixa] [--depende IM-1] [--descricao D]
  move <ID> <coluna> [--nota N] [--quem Q]   colunas: ${COLUNAS.join(', ')}
  assign <ID> <responsavel>
  edit <ID> [--titulo T] [--criterio C ...] [--descricao D] [--prioridade P] [--depende IM-N ...]   --criterio/--depende substituem a lista inteira; --depende "" limpa
  comment <ID> <texto> [--quem Q]`;

function main(argv) {
  const { values: o, positionals: [cmd, ...p] } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      titulo: { type: 'string' }, tipo: { type: 'string' }, prioridade: { type: 'string' }, descricao: { type: 'string' },
      criterio: { type: 'string', multiple: true }, depende: { type: 'string', multiple: true },
      nota: { type: 'string' }, quem: { type: 'string' },
    },
  });
  const quadro = carregar();
  const quem = o.quem ?? 'PO';
  switch (cmd) {
    case 'list': {
      const ts = quadro.tarefas.filter((t) => !p[0] || t.coluna === p[0]);
      for (const t of ts) console.log(`${t.id}\t${t.coluna}\t${t.tipo}\t${t.prioridade}\t${t.responsavel ?? '-'}\t${t.titulo}`);
      return;
    }
    case 'show':
      console.log(JSON.stringify(achar(quadro, p[0]), null, 2));
      return;
    case 'add': {
      const t = adicionar(quadro, { titulo: o.titulo, tipo: o.tipo, prioridade: o.prioridade, descricao: o.descricao, criterios: o.criterio ?? [], depende: o.depende ?? [], quem });
      salvar(quadro);
      console.log(`criada ${t.id}`);
      return;
    }
    case 'move':
      mover(quadro, p[0], p[1], { quem, nota: o.nota ?? '' });
      break;
    case 'assign':
      atribuir(quadro, p[0], p[1], quem);
      break;
    case 'edit':
      editar(quadro, p[0], { titulo: o.titulo, criterios: o.criterio, descricao: o.descricao, prioridade: o.prioridade, depende: o.depende?.filter(Boolean) }, quem); // --depende "" limpa a lista
      break;
    case 'comment':
      comentar(quadro, p[0], p.slice(1).join(' '), quem);
      break;
    default:
      console.log(AJUDA);
      return;
  }
  salvar(quadro);
  console.log('ok');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`erro: ${e.message}`);
    process.exit(1);
  }
}
