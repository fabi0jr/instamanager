import { useState, type FormEvent } from 'react';
import { api } from '../api/cliente';
import { Link } from '../rotas';
import { Aviso, Botao, Campo, useEnvio, useFocoNoErro } from './ui';

export function NovaSenha() {
  const token = new URLSearchParams(location.search).get('token');
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erros, setErros] = useState<{ senha?: string; repetir?: string }>({});
  const [fim, setFim] = useState<'pronto' | 'invalido' | null>(token ? null : 'invalido');
  const { enviando, aviso, bloqueado, enviar } = useEnvio();
  useFocoNoErro(erros);

  function salvar(e: FormEvent) {
    e.preventDefault();
    const novos = {
      senha: senha.length < 8 ? 'Use pelo menos 8 caracteres.' : undefined,
      repetir: senha !== repetir ? 'As senhas não são iguais.' : undefined,
    };
    setErros(novos);
    if (novos.senha || novos.repetir) return;
    enviar(
      async () => {
        await api('/auth/redefinir', { method: 'POST', body: JSON.stringify({ token, senha }) });
        setFim('pronto');
      },
      (erro) => {
        if (erro.codigo !== 'TOKEN_INVALIDO') return false;
        setFim('invalido');
        return true;
      },
    );
  }

  if (fim === 'invalido')
    return (
      <div className="tela cartao">
        <h1>Esse link não vale mais</h1>
        <p>Ele venceu, já foi usado ou está incorreto. Peça um novo.</p>
        <Link para="/esqueci-senha" className="botao">Pedir novo link</Link>
      </div>
    );
  if (fim === 'pronto')
    return (
      <div className="tela cartao">
        <h1>Senha trocada</h1>
        <p>Você saiu dos outros aparelhos.</p>
        <Link para="/entrar" className="botao">Entrar</Link>
      </div>
    );
  return (
    <div className="tela cartao">
      <h1>Nova senha</h1>
      <form onSubmit={salvar} noValidate>
        <Aviso>{aviso}</Aviso>
        <Campo rotulo="Nova senha" type="password" autoComplete="new-password" ajuda="Pelo menos 8 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} disabled={enviando} erro={erros.senha} />
        <Campo rotulo="Repetir a senha" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} disabled={enviando} erro={erros.repetir} />
        <div className="acao-fixa">
          <Botao type="submit" carregando={enviando ? 'Salvando…' : undefined} disabled={bloqueado}>Salvar senha</Botao>
        </div>
      </form>
    </div>
  );
}
