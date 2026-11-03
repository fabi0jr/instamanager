import { useCallback, useEffect, useState } from 'react';
import { api, type Me } from '../api/cliente';
import { Link } from '../rotas';
import { Alerta, Aviso, Botao, Campo, errosDosCampos, useEnvio, useFocoNoErro } from './ui';

type ClubeLivre = { id: string; nome: string; escudoUrl: string };
const TORCEDOR = '__torcedor__';

export function Cadastro({ aoEntrar }: { aoEntrar: () => void }) {
  const [passo, setPasso] = useState(1);
  const [d, setD] = useState({ convite: '', nome: '', email: '', senha: '' });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [escolha, setEscolha] = useState('');
  const [clubes, setClubes] = useState<ClubeLivre[] | 'carregando' | 'erro'>('carregando');
  const { enviando, aviso, setAviso, bloqueado, enviar } = useEnvio();
  useFocoNoErro(erros);

  const carregarClubes = useCallback(async () => {
    setClubes('carregando');
    try {
      const livres = await api<ClubeLivre[]>('/clubes?livres=1');
      setClubes(livres);
      if (livres.length === 0) setEscolha(TORCEDOR); // todos ocupados: torcedor já escolhido
    } catch {
      setClubes('erro');
    }
  }, []);
  useEffect(() => {
    if (passo === 3) carregarClubes();
  }, [passo, carregarClubes]);

  const campo = (k: keyof typeof d) => ({
    value: d[k],
    onChange: (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value }),
    disabled: enviando,
    erro: erros[k],
  });

  function continuar1() {
    if (!d.convite.trim()) return setErros({ convite: 'Digite o código de convite.' });
    setErros({});
    setPasso(2);
  }
  function continuar2() {
    const e: Record<string, string> = {};
    if (!d.nome.trim() || d.nome.trim().length > 60) e.nome = 'Digite um nome de até 60 letras.';
    if (!/^\S+@\S+\.\S+$/.test(d.email)) e.email = 'Esse e-mail parece incompleto. Confira o @ e o domínio.';
    if (d.senha.length < 8) e.senha = 'Use pelo menos 8 caracteres.';
    setErros(e);
    if (!Object.keys(e).length) setPasso(3);
  }

  function criar() {
    const nomeDoClube = Array.isArray(clubes) ? clubes.find((c) => c.id === escolha)?.nome : undefined;
    enviar(
      async () => {
        await api<Me>('/auth/cadastro', {
          method: 'POST',
          body: JSON.stringify({ convite: d.convite.trim(), email: d.email, senha: d.senha, nome: d.nome.trim(), clubeId: escolha === TORCEDOR ? null : escolha }),
        });
        aoEntrar();
      },
      (erro) => {
        const campos = errosDosCampos(erro, { email: 'Esse e-mail parece incompleto. Confira o @ e o domínio.', senha: 'Use pelo menos 8 caracteres.' });
        if (campos) {
          setErros(campos);
          setPasso(campos.convite ? 1 : 2);
        } else if (erro.codigo === 'CONVITE_INVALIDO') {
          setErros({ convite: 'Esse código não vale. Confira com quem te convidou.' });
          setPasso(1);
        } else if (erro.codigo === 'EMAIL_EM_USO') {
          setErros({ email: 'Esse e-mail já tem conta. Entre ou recupere a senha.' });
          setPasso(2);
        } else if (erro.codigo === 'CLUBE_OCUPADO') {
          setAviso(`O ${nomeDoClube ?? 'clube'} acabou de ganhar um técnico. Escolha outro clube.`);
          setEscolha('');
          carregarClubes();
        } else return false;
        return true;
      },
    );
  }

  // mesma lista para o map, o tabIndex e as setas; "Sou só torcedor" existe até no estado de erro
  const opcoes = [...(Array.isArray(clubes) ? clubes.map((c) => ({ id: c.id, nome: c.nome, img: c.escudoUrl })) : []), { id: TORCEDOR, nome: 'Sou só torcedor', img: '' }];
  function seta(e: React.KeyboardEvent) {
    const i = opcoes.findIndex((o) => o.id === escolha);
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta || !opcoes.length) return;
    e.preventDefault();
    const novo = (i + delta + opcoes.length) % opcoes.length;
    setEscolha(opcoes[novo].id);
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[novo]?.focus(); // o foco acompanha a escolha
  }

  return (
    <div className="tela cartao largo">
      {passo > 1 && <button type="button" className="link" onClick={() => { setErros({}); setAviso(''); setPasso(passo - 1); }} disabled={enviando}>‹ Voltar</button>}
      <nav aria-label={`Passo ${passo} de 3`}>
        <div className="passos" aria-hidden="true">{[1, 2, 3].map((n) => <span key={n} className={n <= passo ? 'feito' : ''} />)}</div>
        <p>Passo {passo} de 3</p>
      </nav>
      <Aviso>{aviso}</Aviso>

      {passo === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); continuar1(); }} noValidate>
          <h1>Criar conta</h1>
          <Campo rotulo="Código de convite" autoCapitalize="characters" autoComplete="off" {...campo('convite')} />
          <div className="acao-fixa"><Botao type="submit">Continuar</Botao></div>
          <Link para="/entrar" className="link">Já tenho conta. Entrar</Link>
        </form>
      )}

      {passo === 2 && (
        <form onSubmit={(e) => { e.preventDefault(); continuar2(); }} noValidate>
          <h1>Seus dados</h1>
          <Campo rotulo="Nome de exibição" autoComplete="nickname" ajuda="Até 60 letras" {...campo('nome')} />
          <Campo rotulo="E-mail" type="email" autoComplete="email" inputMode="email" {...campo('email')} />
          {erros.email?.includes('já tem conta') && <Link para="/entrar" className="link">Entrar com esse e-mail</Link>}
          <Campo rotulo="Senha" type="password" autoComplete="new-password" ajuda="Pelo menos 8 caracteres" {...campo('senha')} />
          <div className="acao-fixa"><Botao type="submit">Continuar</Botao></div>
        </form>
      )}

      {passo === 3 && (
        <div style={{ display: 'contents' }}>
          <h1>Seu clube</h1>
          <p>Cada clube tem um técnico. Escolha um que esteja livre ou entre só como torcedor.</p>
          {clubes === 'carregando' && <div aria-busy="true">{[0, 1, 2, 3].map((n) => <div key={n} className="esqueleto" style={{ marginBottom: 8 }} />)}</div>}
          {clubes === 'erro' && (
            <div className="caixa-info">
              <Alerta tam={24} />
              <h2>Não deu para carregar os clubes</h2>
              <Botao variante="secundario" onClick={carregarClubes}>Tentar de novo</Botao>
            </div>
          )}
          {Array.isArray(clubes) && clubes.length === 0 && <div className="caixa-info"><h2>Todos os clubes já têm técnico</h2></div>}
          {(Array.isArray(clubes) || clubes === 'erro') && (
            <div role="radiogroup" aria-label="Clube" className="clubes duas" onKeyDown={seta}>
              {opcoes.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={escolha === o.id} tabIndex={escolha === o.id || (!escolha && o.id === opcoes[0].id) ? 0 : -1}
                  className={`opcao ${o.id === TORCEDOR ? 'torcedor' : ''}`} disabled={enviando} onClick={() => setEscolha(o.id)}>
                  {o.img && <img src={o.img} alt="" />}
                  {o.nome}
                  <span className="marcador" aria-hidden="true">{escolha === o.id && '✓'}</span>
                </button>
              ))}
            </div>
          )}
          <div className="acao-fixa">
            <Botao carregando={enviando ? 'Criando conta…' : undefined} disabled={!escolha || bloqueado || clubes === 'carregando'} onClick={criar}>Criar conta</Botao>
          </div>
        </div>
      )}
    </div>
  );
}
