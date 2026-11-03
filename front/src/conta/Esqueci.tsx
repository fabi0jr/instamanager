import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/cliente';
import { Link } from '../rotas';
import { Aviso, Botao, Campo, errosDosCampos, useEnvio, useFocoNoErro } from './ui';

export function Esqueci() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [espera, setEspera] = useState(0);
  const { enviando, aviso, bloqueado, enviar } = useEnvio();
  const [erros, setErros] = useState<Record<string, string>>({});
  useFocoNoErro(erros);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(espera - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  function mandar(e?: FormEvent) {
    e?.preventDefault();
    setErros({});
    enviar(
      async () => {
        await api('/auth/esqueci', { method: 'POST', body: JSON.stringify({ email }) });
        setEnviado(true);
        setEspera(60);
      },
      (erro) => {
        const campos = errosDosCampos(erro);
        if (campos) setErros(campos);
        return !!campos;
      },
    );
  }

  if (enviado)
    return (
      <div className="tela cartao">
        <h1>Confira seu e-mail</h1>
        <p>Se esse e-mail tiver conta, o link já está a caminho. Ele vale 1 hora.</p>
        <Aviso>{aviso}</Aviso>
        <button type="button" className="link" disabled={espera > 0 || enviando} onClick={() => mandar()}>
          {espera > 0 ? `Enviar de novo (${espera} s)` : 'Enviar de novo'}
        </button>
        <Link para="/entrar" className="botao">Voltar para entrar</Link>
      </div>
    );
  return (
    <div className="tela cartao">
      <Link para="/entrar" className="link">‹ Voltar</Link>
      <h1>Esqueci a senha</h1>
      <p>Digite seu e-mail. Se ele existir, enviamos um link para criar uma senha nova. O link vale 1 hora.</p>
      <form onSubmit={mandar} noValidate>
        <Aviso>{aviso}</Aviso>
        <Campo rotulo="E-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={enviando} erro={erros.email} />
        <div className="acao-fixa">
          <Botao type="submit" carregando={enviando ? 'Enviando…' : undefined} disabled={bloqueado}>Enviar link</Botao>
        </div>
      </form>
    </div>
  );
}
