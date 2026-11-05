import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { api, ErroApi, type ChavePush, type Me } from '../api/cliente';
import { data } from '../clube/PerfilClube';
import { Escudo } from '../feed/Escudo';
import { Folha } from '../feed/Folha';
import { IcCamera, IcSeta } from '../feed/icones';
import { sigla } from '../feed/siglas';
import { ehIOS, instalado } from '../instalar/plataforma';
import { ativarPush, cancelarInscricaoAoSair, desativarPush, estadoPush } from '../instalar/push';
import { comprimir, ErroImagem } from '../postar/comprimir';
import { Link, navegar } from '../rotas';
import '../feed/feed.css';
import { Aviso, Botao, Campo, useEnvio, useFocoNoErro } from './ui';

const PREFS: { chave: ChavePush; titulo: string; sub?: string }[] = [
  { chave: 'posts', titulo: 'Posts novos' },
  { chave: 'comentarios', titulo: 'Comentários no meu clube' },
  { chave: 'mencoes', titulo: 'Menções' },
  { chave: 'cbf', titulo: 'CBF' },
  { chave: 'bolao', titulo: 'Bolão', sub: 'Lembrete 2 h antes do prazo e resultado' },
  { chave: 'trocas', titulo: 'Trocas de clube' },
];

type Troca = { id: string; tipo: 'SAIR' | 'ASSUMIR'; status: string; clubeId: string | null; decididoEm?: string | null };

function Linha({ titulo, sub, para, aoClicar, tom, children }: { titulo: string; sub?: string; para?: string; aoClicar?: () => void; tom?: 'aviso' | 'suave'; children?: ReactNode }) {
  const corpo = (
    <>
      <span className="linha-txt">
        <span className={`linha-titulo ${tom === 'suave' ? 'giz2' : ''}`}>{titulo}</span>
        {sub && <span className={`legenda-s ${tom === 'aviso' ? 'amarelo' : 'giz2'}`}>{sub}</span>}
      </span>
      {children ?? (para || aoClicar ? <IcSeta /> : null)}
    </>
  );
  if (para) return <Link para={para} className="linha">{corpo}</Link>;
  if (aoClicar) return <button type="button" className="linha" onClick={aoClicar}>{corpo}</button>;
  return <div className="linha">{corpo}</div>;
}

// Layout de docs/design/perfis.md. A lógica de nome, foto e sair vem da IM-9; a senha mora em /perfil/senha.
export function Perfil({ me, recarregar }: { me: Me; recarregar: () => void }) {
  const [nome, setNome] = useState(me.nome);
  const [nomeAberto, setNomeAberto] = useState(false);
  const [erroNome, setErroNome] = useState('');
  const [ok, setOk] = useState('');
  const [push, setPush] = useState(me.pushEnabled);
  const [mudando, setMudando] = useState<boolean | null>(null); // o que a pessoa acabou de pedir, até a resposta chegar
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [prefs, setPrefs] = useState<Partial<Record<ChavePush, boolean>>>(me.pushPrefs ?? {});
  const nomeEnvio = useEnvio();
  const fotoEnvio = useEnvio();
  useFocoNoErro(erroNome);

  useEffect(() => {
    api<Troca[]>('/trocas/minhas').then(setTrocas, () => {});
  }, []);
  const estado = estadoPush(push, ehIOS(), instalado());
  const ligado = mudando ?? estado === 'ligado';
  const subAvisos = estado === 'negado' ? 'Bloqueado neste aparelho. Toque para ver como liberar.' : estado === 'ios-sem-instalar' ? 'No iPhone, instale o app para receber avisos.' : estado === 'sem-suporte' ? 'Este aparelho não recebe avisos do navegador.' : 'Avisos de post novo e comentário';
  const pendente = trocas.find((t) => t.status === 'PENDENTE');
  const recusada = trocas[0]?.status === 'RECUSADA' ? trocas[0] : null;
  useEffect(() => {
    if (pendente?.clubeId) api<{ id: string; nome: string }[]>('/clubes').then((l) => setNomes(Object.fromEntries(l.map((c) => [c.id, c.nome]))), () => {});
  }, [pendente?.clubeId]);

  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(''), 3000);
    return () => clearTimeout(t);
  }, [ok]);

  function salvarNome(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || nome.trim().length > 60) return setErroNome('Digite um nome de até 60 letras.');
    setErroNome('');
    nomeEnvio.enviar(async () => {
      await api<Me>('/me', { method: 'PATCH', body: JSON.stringify({ nome: nome.trim() }) });
      setNomeAberto(false);
      setOk('Nome salvo.');
      recarregar();
    });
  }

  // salva na hora, otimista; se falhar, o interruptor volta
  async function alternarPref(chave: ChavePush) {
    const novo = !(prefs[chave] ?? true);
    setPrefs((p) => ({ ...p, [chave]: novo }));
    try {
      await api<Me>('/me', { method: 'PATCH', body: JSON.stringify({ pushPrefs: { [chave]: novo } }) });
      setOk('Preferência salva.');
    } catch {
      setPrefs((p) => ({ ...p, [chave]: !novo }));
      setOk('Não deu para salvar. Tente de novo.');
    }
  }

  function trocarFoto(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const arquivo = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    fotoEnvio.enviar(async () => {
      try {
        const { blob } = await comprimir(arquivo, 480);
        const corpo = new FormData();
        corpo.append('foto', blob, 'foto.jpg');
        await api<Me>('/me/foto', { method: 'PUT', body: corpo });
        setOk('Foto salva.');
        recarregar();
      } catch (erro) {
        if (erro instanceof ErroImagem || (erro instanceof ErroApi && erro.codigo === 'IMAGEM_INVALIDA')) fotoEnvio.setAviso('Não deu para ler essa imagem. Escolha outra foto.');
        else throw erro;
      }
    });
  }

  // Interruptor de Notificações: liga/desliga de verdade (permissão, inscrição e pushEnabled; ver instalar/push.ts).
  // Bloqueado, iPhone sem instalar ou sem suporte: o toque leva a /avisos, que explica o motivo e como resolver.
  async function alternarPush() {
    if (estado !== 'ligado' && estado !== 'desligado') return navegar('/avisos');
    const ligar = estado === 'desligado';
    setMudando(ligar);
    try {
      if (ligar) {
        if ((await ativarPush()) !== 'ok') return navegar('/avisos');
      } else {
        await desativarPush();
      }
      setPush(ligar);
      recarregar();
    } catch {
      setOk(ligar ? 'Não deu para ativar. Tente de novo.' : 'Não deu para desligar. Tente de novo.');
    } finally {
      setMudando(null);
    }
  }

  async function sair() {
    await cancelarInscricaoAoSair(); // antes de perder a sessão: a rota de push exige estar logada
    await api('/auth/sair', { method: 'POST' }).catch(() => {});
    recarregar();
    navegar('/entrar');
  }

  return (
    <div className="tela perfil">
      <h1>Perfil</h1>
      <Aviso>{fotoEnvio.aviso}</Aviso>
      <header className="perfil-topo">
        <label className="avatar-botao">
          {me.avatarUrl ? <img className="avatar g" src={me.avatarUrl} alt="" /> : <span className="avatar g" aria-hidden="true">{me.nome[0]?.toUpperCase()}</span>}
          {fotoEnvio.enviando ? <span className="veu-foto"><span className="giro" /></span> : <span className="camera"><IcCamera /></span>}
          <input type="file" accept="image/*" aria-label="Trocar foto" className="sr" onChange={trocarFoto} disabled={fotoEnvio.enviando} />
        </label>
        <div>
          <h2 className="perfil-nome">{me.nome}</h2>
          {me.clube ? (
            <span className="pilula" aria-label={`Clube ${me.clube.nome}`}><Escudo src={me.clube.escudoUrl} tam={16} />{sigla(me.clube.id)}</span>
          ) : (
            <span className="giz2 legenda-s">Torcedor, sem clube</span>
          )}
          <div className="giz2 legenda-s">{me.email}</div>
        </div>
      </header>

      {me.clube && (
        <Link para={`/c/${me.clube.id}`} className="linha cartao-meu-clube">
          <Escudo src={me.clube.escudoUrl} tam={44} />
          <span className="linha-txt"><span className="linha-titulo">{me.clube.nome}</span><span className="giz2 legenda-s">Meu clube</span></span>
          <IcSeta />
        </Link>
      )}
      <Linha titulo="Galeria de prompts" para="/galeria" />
      <Linha titulo="Votações" para="/liga?aba=votacoes" />
      <Linha titulo="Liga" para="/liga" />

      <p className="grupo giz2">Conta</p>
      <Linha titulo="Nome de exibição" sub={me.nome} aoClicar={() => { setNome(me.nome); setErroNome(''); setNomeAberto(true); }} />
      <Linha titulo="Senha" sub="Trocar a senha" para="/perfil/senha" />

      <p className="grupo giz2">Avisos</p>
      <Linha titulo="Notificações" sub={subAvisos} tom={estado === 'ligado' || estado === 'desligado' ? undefined : 'aviso'}>
        <button type="button" role="switch" aria-checked={ligado} aria-label="Notificações" disabled={mudando !== null} className={`interruptor ${ligado ? 'ligado' : ''}`} onClick={alternarPush}><span /></button>
      </Linha>
      {estado === 'desligado' && <p className="giz2 legenda-s dica-avisos">Desligado. Ligue para escolher quais avisos chegam.</p>}
      <div className={`prefs-push ${ligado ? '' : 'inerte'}`} role="group" aria-label="Quais avisos receber" inert={!ligado}>
        {PREFS.map(({ chave, titulo, sub }) => {
          const on = prefs[chave] ?? true;
          return (
            <Linha key={chave} titulo={titulo} sub={sub}>
              <button type="button" role="switch" aria-checked={on} aria-label={titulo} className={`interruptor ${on ? 'ligado' : ''}`} onClick={() => alternarPref(chave)}><span /></button>
            </Linha>
          );
        })}
      </div>

      <p className="grupo giz2">Clube</p>
      {!me.clube && <Linha titulo="Sem clube" sub="Você vê, curte e comenta, mas não posta." />}
      {pendente ? (
        <Linha titulo="Pedido pendente" tom="aviso" sub={`${pendente.tipo === 'SAIR' ? 'Sair do clube' : `Assumir o ${nomes[pendente.clubeId ?? ''] ?? 'clube pedido'}`}. Aguardando o admin.`} />
      ) : (
        <>
          <Linha titulo={me.clube ? 'Trocar de clube' : 'Pedir um clube'} sub={me.clube ? 'Sair ou assumir outro clube' : undefined} para="/trocar" />
          {recusada?.decididoEm && <p className="giz2 legenda-s recusa">Último pedido recusado em {data(recusada.decididoEm).slice(0, 5)}.</p>}
        </>
      )}

      {me.isAdmin && <Linha titulo="Administração" para="/admin" />}
      <button type="button" className="linha sair giz2" onClick={sair}>Sair da conta</button>
      <div role="status" className={ok ? 'toast' : 'sr'}>{ok}</div>

      {nomeAberto && (
        <Folha titulo="Editar nome" aoFechar={() => setNomeAberto(false)}>
          <form onSubmit={salvarNome} noValidate className="folha-form">
            <Aviso>{nomeEnvio.aviso}</Aviso>
            <Campo rotulo="Nome de exibição" data-foco autoComplete="nickname" ajuda="Até 60 letras." value={nome} onChange={(e) => setNome(e.target.value)} disabled={nomeEnvio.enviando} erro={erroNome} />
            <Botao type="submit" carregando={nomeEnvio.enviando ? 'Salvando…' : undefined}>Salvar nome</Botao>
            <Botao variante="fantasma" onClick={() => setNomeAberto(false)}>Cancelar</Botao>
          </form>
        </Folha>
      )}
    </div>
  );
}
