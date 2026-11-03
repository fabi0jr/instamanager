import { useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ErroApi, type Me } from '../api/cliente';
import { comprimir, ErroImagem } from '../postar/comprimir';
import { Aviso, Botao, Campo, useEnvio, useFocoNoErro } from './ui';

// Sem handoff de design para o Perfil (grupo 4): usa só os componentes de fundamentos.md.
export function Perfil({ me, recarregar }: { me: Me; recarregar: () => void }) {
  const [nome, setNome] = useState(me.nome);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [erros, setErros] = useState<{ nome?: string; atual?: string; nova?: string }>({});
  const [ok, setOk] = useState('');
  const nomeEnvio = useEnvio();
  const fotoEnvio = useEnvio();
  const senhaEnvio = useEnvio();
  useFocoNoErro(erros);

  function salvarNome(e: FormEvent) {
    e.preventDefault();
    setOk('');
    if (!nome.trim() || nome.trim().length > 60) return setErros({ nome: 'Digite um nome de até 60 letras.' });
    setErros({});
    nomeEnvio.enviar(async () => {
      await api<Me>('/me', { method: 'PATCH', body: JSON.stringify({ nome: nome.trim() }) });
      setOk('Nome salvo.');
      recarregar();
    });
  }

  function trocarFoto(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const arquivo = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    setOk('');
    fotoEnvio.enviar(async () => {
      try {
        const { blob } = await comprimir(arquivo, 480);
        const corpo = new FormData();
        corpo.append('foto', blob, 'foto.jpg');
        await api<Me>('/me/foto', { method: 'PUT', body: corpo });
        setOk('Foto salva.');
        recarregar();
      } catch (erro) {
        if (erro instanceof ErroImagem) fotoEnvio.setAviso('Não deu para ler essa imagem. Escolha outra foto.');
        else if (erro instanceof ErroApi && erro.codigo === 'IMAGEM_INVALIDA') fotoEnvio.setAviso('Essa imagem não serve. Escolha uma foto JPEG ou PNG.');
        else throw erro;
      }
    });
  }

  function salvarSenha(e: FormEvent) {
    e.preventDefault();
    setOk('');
    const novos = { atual: atual ? undefined : 'Digite a senha atual.', nova: nova.length < 8 ? 'Use pelo menos 8 caracteres.' : undefined };
    setErros(novos);
    if (novos.atual || novos.nova) return;
    senhaEnvio.enviar(
      async () => {
        await api<Me>('/me', { method: 'PATCH', body: JSON.stringify({ senhaAtual: atual, senhaNova: nova }) });
        setAtual('');
        setNova('');
        setOk('Senha trocada. Você saiu dos outros aparelhos.');
        recarregar();
      },
      (erro: ErroApi) => {
        if (erro.codigo !== 'SENHA_ATUAL_INVALIDA') return false;
        setErros({ atual: 'Senha atual incorreta.' });
        return true;
      },
    );
  }

  async function sair() {
    await api('/auth/sair', { method: 'POST' }).catch(() => {});
    recarregar();
  }

  return (
    <div className="tela perfil">
      <h1>Perfil</h1>
      <div role="status">{ok}</div>
      {me.avatarUrl ? <img className="avatar" src={me.avatarUrl} alt="" /> : <div className="avatar" aria-hidden="true">{me.nome[0]?.toUpperCase()}</div>}
      <Aviso>{fotoEnvio.aviso}</Aviso>
      <label className="botao secundario">
        {fotoEnvio.enviando ? 'Enviando…' : 'Trocar foto'}
        <input type="file" accept="image/*" aria-label="Trocar foto" className="sr" onChange={trocarFoto} disabled={fotoEnvio.enviando} />
      </label>

      <form onSubmit={salvarNome} noValidate>
        <Aviso>{nomeEnvio.aviso}</Aviso>
        <Campo rotulo="Nome de exibição" autoComplete="nickname" ajuda="Até 60 letras" value={nome} onChange={(e) => setNome(e.target.value)} disabled={nomeEnvio.enviando} erro={erros.nome} />
        <Botao type="submit" carregando={nomeEnvio.enviando ? 'Salvando…' : undefined}>Salvar nome</Botao>
      </form>

      <form onSubmit={salvarSenha} noValidate>
        <Aviso>{senhaEnvio.aviso}</Aviso>
        <Campo rotulo="Senha atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} disabled={senhaEnvio.enviando} erro={erros.atual} />
        <Campo rotulo="Nova senha" type="password" autoComplete="new-password" ajuda="Pelo menos 8 caracteres" value={nova} onChange={(e) => setNova(e.target.value)} disabled={senhaEnvio.enviando} erro={erros.nova} />
        <Botao type="submit" carregando={senhaEnvio.enviando ? 'Salvando…' : undefined} disabled={senhaEnvio.bloqueado}>Salvar senha</Botao>
      </form>

      <Botao variante="fantasma" onClick={sair}>Sair</Botao>
    </div>
  );
}
