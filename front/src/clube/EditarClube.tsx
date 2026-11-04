import { useEffect, useRef, useState } from 'react';
import { api, ErroApi, type Me } from '../api/cliente';
import { guardarAviso } from '../aviso';
import { Aviso, Botao } from '../conta/ui';
import { IcCamera, IcVoltar } from '../feed/icones';
import { comprimirCapa, ErroImagem } from '../postar/comprimir';
import { Contador } from '../postar/LinhasPrompt';
import { navegar } from '../rotas';
import type { Clube } from './PerfilClube';
import '../postar/postar.css';
import './clube.css';

const LIMITE_BIO = 300;

// /c/:id/editar: capa (sobe ao escolher) e bio (salva no botão). Só o técnico atual e o admin; o back confere de novo.
export function EditarClube({ id, me }: { id: string; me: Me }) {
  const [clube, setClube] = useState<Clube | 'carregando' | 'erro'>('carregando');
  const [bio, setBio] = useState('');
  const [capaUrl, setCapaUrl] = useState<string | null>(null);
  const [subindo, setSubindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [semPermissao, setSemPermissao] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Clube>(`/clubes/${id}`).then(
      (c) => {
        setClube(c);
        setBio(c.bio ?? '');
        setCapaUrl(c.capaUrl ?? null);
        if (!me.isAdmin && c.tecnico?.id !== me.id) {
          setSemPermissao(true);
          setAviso('Você não é mais técnico deste clube.');
        }
      },
      () => setClube('erro'),
    );
  }, [id, me.id, me.isAdmin]);

  if (clube === 'carregando') return <div className="esqueleto card-esq" aria-busy="true" />;
  if (clube === 'erro')
    return (
      <div className="caixa-info" role="alert">
        <h2>Não deu para carregar o clube</h2>
        <button type="button" className="botao secundario" onClick={() => navegar(`/c/${id}`)}>Voltar</button>
      </div>
    );

  const bloquear = (e: unknown) => {
    if (e instanceof ErroApi && e.codigo === 'NAO_E_TECNICO') {
      setSemPermissao(true);
      setAviso('Você não é mais técnico deste clube.');
      return true;
    }
    return false;
  };

  async function trocarCapa(f: File | undefined) {
    if (!f) return;
    setAviso('');
    setSubindo(true);
    try {
      const form = new FormData();
      form.append('capa', await comprimirCapa(f), 'capa.jpg');
      const novo = await api<Clube>(`/clubes/${id}/capa`, { method: 'PUT', body: form });
      setCapaUrl(novo.capaUrl ?? null);
    } catch (e) {
      if (!bloquear(e)) setAviso(e instanceof ErroImagem || (e instanceof ErroApi && e.codigo === 'IMAGEM_INVALIDA') ? 'Não deu para ler essa imagem. Escolha outra.' : 'Não deu para enviar a capa. Tente de novo.');
    } finally {
      setSubindo(false);
      if (arquivo.current) arquivo.current.value = '';
    }
  }

  async function salvar() {
    setAviso('');
    setSalvando(true);
    try {
      await api<Clube>(`/clubes/${id}`, { method: 'PATCH', body: JSON.stringify({ bio: bio.trim() }) });
      guardarAviso('Clube atualizado');
      navegar(`/c/${id}`);
    } catch (e) {
      if (!bloquear(e)) setAviso('Não deu para salvar. Confira a conexão e tente de novo. O que você escreveu continua aqui.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="tela postar editar-clube">
      <button type="button" className="link" onClick={() => navegar(`/c/${id}`)}><IcVoltar />Voltar</button>
      <h1>Editar clube</h1>
      <div className="previa-capa" style={capaUrl ? { backgroundImage: `url(${capaUrl})` } : undefined} data-sem-capa={!capaUrl || undefined}>
        {subindo && <span className="giro véu" role="status" aria-label="Enviando capa" />}
        <button type="button" className="botao-capa" disabled={subindo || semPermissao} onClick={() => arquivo.current?.click()}><IcCamera />Trocar capa</button>
        <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr" aria-label="Escolher capa" onChange={(e) => trocarCapa(e.target.files?.[0])} />
      </div>
      <p className="giz2">Imagem larga, 3:1. Ela é reduzida no celular antes de enviar.</p>
      <Aviso>{aviso}</Aviso>
      <fieldset disabled={semPermissao || salvando} className="campos">
        <label htmlFor="bio">Bio do clube</label>
        <textarea id="bio" rows={5} value={bio} aria-invalid={bio.length > LIMITE_BIO || undefined} onChange={(e) => setBio(e.target.value)} />
        <Contador texto={bio} limite={LIMITE_BIO} />
      </fieldset>
      <div className="acao-fixa">
        <Botao carregando={salvando ? 'Salvando…' : undefined} disabled={bio.length > LIMITE_BIO || semPermissao || subindo} onClick={salvar}>Salvar alterações</Botao>
      </div>
    </div>
  );
}
