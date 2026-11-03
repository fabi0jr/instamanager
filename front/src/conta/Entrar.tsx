import { useState, type FormEvent } from 'react';
import { api, ErroApi, type Me } from '../api/cliente';
import { Link } from '../rotas';
import { Aviso, Botao, Campo, errosDosCampos, useEnvio, useFocoNoErro } from './ui';

export function Entrar({ aoEntrar }: { aoEntrar: () => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const { enviando, aviso, setAviso, bloqueado, enviar } = useEnvio();
  const [erros, setErros] = useState<Record<string, string>>({});
  useFocoNoErro(erros);

  function entrar(e: FormEvent) {
    e.preventDefault();
    setErros({});
    enviar(
      async () => {
        await api<Me>('/auth/entrar', { method: 'POST', body: JSON.stringify({ email, senha }) });
        aoEntrar();
      },
      (erro: ErroApi) => {
        const campos = errosDosCampos(erro);
        if (campos) {
          setErros(campos);
          return true;
        }
        if (erro.codigo !== 'CREDENCIAIS_INVALIDAS') return false;
        // não diz qual dos dois está errado
        setErros({ email: ' ', senha: ' ' });
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
        <Campo rotulo="E-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={enviando} erro={erros.email} />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} disabled={enviando} erro={erros.senha} />
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
