import { useState, type FormEvent } from 'react';
import { api, ErroApi, type Me } from '../api/cliente';
import { Link } from '../rotas';
import { Aviso, Botao, Campo, useEnvio, useFocoNoErro } from './ui';

// /perfil/senha
export function TrocarSenha() {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [erros, setErros] = useState<{ atual?: string; nova?: string }>({});
  const [pronto, setPronto] = useState(false);
  const { enviando, aviso, bloqueado, enviar } = useEnvio();
  useFocoNoErro(erros);

  function salvar(e: FormEvent) {
    e.preventDefault();
    const novos = { atual: atual ? undefined : 'Digite a senha atual.', nova: nova.length < 8 ? 'Use pelo menos 8 caracteres.' : undefined };
    setErros(novos);
    if (novos.atual || novos.nova) return;
    enviar(
      async () => {
        await api<Me>('/me', { method: 'PATCH', body: JSON.stringify({ senhaAtual: atual, senhaNova: nova }) });
        setPronto(true);
      },
      (erro: ErroApi) => {
        if (erro.codigo !== 'SENHA_ATUAL_INVALIDA') return false;
        setErros({ atual: 'Senha atual incorreta.' });
        return true;
      },
    );
  }

  if (pronto)
    return (
      <div className="tela">
        <h1>Senha trocada</h1>
        <p role="status">Você saiu dos outros aparelhos.</p>
        <Link para="/perfil" className="botao">Voltar ao perfil</Link>
      </div>
    );
  return (
    <div className="tela">
      <Link para="/perfil" className="link">‹ Voltar</Link>
      <h1>Trocar senha</h1>
      <p>Ao salvar, você sai dos outros aparelhos.</p>
      <form onSubmit={salvar} noValidate>
        <Aviso>{aviso}</Aviso>
        <Campo rotulo="Senha atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} disabled={enviando} erro={erros.atual} />
        <Campo rotulo="Nova senha" type="password" autoComplete="new-password" ajuda="Pelo menos 8 caracteres." value={nova} onChange={(e) => setNova(e.target.value)} disabled={enviando} erro={erros.nova} />
        <div className="acao-fixa">
          <Botao type="submit" carregando={enviando ? 'Salvando…' : undefined} disabled={bloqueado}>Salvar senha</Botao>
        </div>
      </form>
    </div>
  );
}
