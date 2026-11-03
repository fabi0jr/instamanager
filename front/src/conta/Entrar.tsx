import { useState, type FormEvent } from 'react';
import { api, ErroApi, type Me } from '../api/cliente';
import { Link } from '../rotas';
import { Aviso, Botao, Campo, useEnvio } from './ui';

export function Entrar({ aoEntrar }: { aoEntrar: () => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const { enviando, aviso, setAviso, bloqueado, enviar } = useEnvio();
  const [erroCampos, setErroCampos] = useState(false);

  function entrar(e: FormEvent) {
    e.preventDefault();
    setErroCampos(false);
    enviar(
      async () => {
        await api<Me>('/auth/entrar', { method: 'POST', body: JSON.stringify({ email, senha }) });
        aoEntrar();
      },
      (erro: ErroApi) => {
        if (erro.codigo !== 'CREDENCIAIS_INVALIDAS') return false;
        // não diz qual dos dois está errado
        setErroCampos(true);
        setAviso('E-mail ou senha incorretos. Tente de novo.');
        return true;
      },
    );
  }

  return (
    <div className="tela cartao">
      <div className="marca"><img src="/icones/icon-192.png" alt="" />InstaManager</div>
      <h1>Entrar</h1>
      <form onSubmit={entrar} noValidate>
        <Aviso>{aviso}</Aviso>
        <Campo rotulo="E-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={enviando} erro={erroCampos ? ' ' : undefined} />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} disabled={enviando} erro={erroCampos ? ' ' : undefined} />
        <Link para="/esqueci-senha" className="link">Esqueci a senha</Link>
        <div className="acao-fixa">
          <Botao type="submit" carregando={enviando ? 'Entrando…' : undefined} disabled={bloqueado}>Entrar</Botao>
        </div>
      </form>
      <p>Ainda não tem conta?</p>
      <Link para="/cadastro" className="botao fantasma">Criar conta com convite</Link>
    </div>
  );
}
