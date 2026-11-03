import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { api, type Me } from '../api/cliente';
import { Aviso, Botao, useEnvio } from '../conta/ui';
import { Escudo } from '../feed/Escudo';
import { navegar } from '../rotas';

type Livre = { id: string; nome: string; escudoUrl: string };
type Troca = { id: string; status: 'PENDENTE' | 'APROVADA' | 'RECUSADA' };
type Fase = 'carregando' | 'pendente' | 'form' | 'enviado' | 'erro';

// o foco acompanha a escolha por seta, como num grupo de opção única
function setas(e: KeyboardEvent<HTMLElement>) {
  const sentido = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
  if (!sentido) return;
  e.preventDefault();
  const radios = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)')];
  const i = radios.indexOf(document.activeElement as HTMLElement);
  const novo = radios[(i + sentido + radios.length) % radios.length];
  novo?.focus();
  novo?.click();
}

const Marcador = ({ ligado }: { ligado: boolean }) => <span className="marcador" aria-hidden="true">{ligado && '✓'}</span>;

// Segue docs/design/instalar-troca-admin.md ("Pedir troca de clube"). Um pedido pendente por pessoa; pedir não se desfaz.
export function Trocar({ me }: { me: Me }) {
  const [fase, setFase] = useState<Fase>('carregando');
  const [clubes, setClubes] = useState<Livre[] | 'carregando' | 'erro'>('carregando');
  const [modo, setModo] = useState<'sair' | 'assumir'>('assumir');
  const [escolha, setEscolha] = useState<string | null>(() => new URLSearchParams(location.search).get('clube'));
  const { enviando, aviso, setAviso, bloqueado, enviar } = useEnvio();

  const carregarClubes = useCallback(() => {
    setClubes('carregando');
    api<Livre[]>('/clubes?livres=1').then(
      (l) => {
        setClubes(l);
        setEscolha((e) => (e && l.some((c) => c.id === e) ? e : null)); // clube que não está mais livre sai da escolha
      },
      () => setClubes('erro'),
    );
  }, []);

  useEffect(() => {
    let vivo = true;
    api<Troca[]>('/trocas/minhas').then(
      (lista) => {
        if (!vivo) return;
        if (lista.some((t) => t.status === 'PENDENTE')) return setFase('pendente');
        setFase('form');
        carregarClubes();
      },
      () => vivo && setFase('erro'),
    );
    return () => {
      vivo = false;
    };
  }, [carregarClubes]);

  const voltar = () => navegar('/perfil');

  function pedir() {
    const assumir = modo === 'assumir' || !me.clube;
    const clube = Array.isArray(clubes) ? clubes.find((c) => c.id === escolha) : undefined;
    enviar(
      async () => {
        await api('/trocas', { method: 'POST', body: JSON.stringify(assumir ? { tipo: 'ASSUMIR', clubeId: escolha } : { tipo: 'SAIR' }) });
        setFase('enviado');
      },
      (e) => {
        if (e.codigo === 'CLUBE_OCUPADO') {
          setAviso(`O ${clube?.nome ?? 'clube'} acabou de ganhar um técnico. Escolha outro clube.`);
          setEscolha(null);
          carregarClubes();
          return true;
        }
        if (e.codigo === 'TROCA_PENDENTE') return setFase('pendente'), true;
        if (e.codigo === 'SEM_CLUBE') return setAviso('Você já está sem clube.'), true;
        return false;
      },
    );
  }

  if (fase === 'carregando') return <div className="carregando" role="status" aria-label="Carregando" />;
  if (fase === 'erro')
    return (
      <div className="tela">
        <div className="caixa-info" role="alert">
          <h2>Não deu para carregar os clubes</h2>
          <Botao variante="secundario" onClick={() => location.reload()}>Tentar de novo</Botao>
        </div>
      </div>
    );
  if (fase === 'pendente')
    return (
      <div className="tela">
        <h1>Pedido pendente</h1>
        <p>Você já tem um pedido pendente. Espere a resposta do admin.</p>
        <div className="acao-fixa"><Botao onClick={voltar}>Voltar ao perfil</Botao></div>
      </div>
    );
  if (fase === 'enviado')
    return (
      <div className="tela">
        <h1>Pedido enviado</h1>
        <p>O admin vai avaliar. Você recebe um aviso com a resposta.</p>
        <div className="acao-fixa"><Botao onClick={voltar}>Voltar ao perfil</Botao></div>
      </div>
    );

  const assumindo = modo === 'assumir' || !me.clube;
  const semLivres = Array.isArray(clubes) && clubes.length === 0;
  const podePedir = me.clube || (Array.isArray(clubes) && clubes.length > 0);
  return (
    <div className="tela">
      <h1>{me.clube ? 'Trocar de clube' : 'Pedir um clube'}</h1>
      <p>{me.clube ? `O admin aprova o pedido. Enquanto isso você continua no ${me.clube.nome}.` : 'O admin aprova o pedido e você recebe um aviso com a resposta.'}</p>
      <Aviso>{aviso}</Aviso>

      {me.clube && (
        <div role="radiogroup" aria-label="O que fazer" className="clubes" onKeyDown={setas}>
          {(['sair', 'assumir'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={modo === m} tabIndex={modo === m ? 0 : -1} className="opcao troca-modo" onClick={() => setModo(m)}>
              <span>
                {m === 'sair' ? `Sair do ${me.clube!.nome}` : 'Assumir outro clube'}
                <small className="giz2">{m === 'sair' ? 'Você vira torcedor e o clube fica com vaga aberta.' : 'Escolha um clube que esteja sem técnico.'}</small>
              </span>
              <Marcador ligado={modo === m} />
            </button>
          ))}
        </div>
      )}

      {assumindo && clubes === 'carregando' && <div aria-busy="true">{[0, 1, 2, 3, 4].map((n) => <div key={n} className="esqueleto" style={{ marginBottom: 8 }} />)}</div>}
      {assumindo && clubes === 'erro' && (
        <div className="caixa-info" role="alert">
          <h2>Não deu para carregar os clubes</h2>
          <Botao variante="secundario" onClick={carregarClubes}>Tentar de novo</Botao>
        </div>
      )}
      {assumindo && semLivres && (
        <div className="caixa-info">
          <h2>Nenhum clube livre agora</h2>
          <p>Quando um clube ficar sem técnico, ele aparece aqui.</p>
        </div>
      )}
      {assumindo && Array.isArray(clubes) && clubes.length > 0 && (
        <div role="radiogroup" aria-label="Clube" className="clubes" onKeyDown={setas}>
          {clubes.map((c, i) => (
            <button key={c.id} type="button" role="radio" aria-checked={escolha === c.id} tabIndex={escolha === c.id || (!escolha && i === 0) ? 0 : -1} className="opcao" disabled={enviando} onClick={() => setEscolha(c.id)}>
              <Escudo src={c.escudoUrl} tam={40} />
              {c.nome}
              <Marcador ligado={escolha === c.id} />
            </button>
          ))}
        </div>
      )}

      <div className="acao-fixa">
        {podePedir ? (
          <Botao onClick={pedir} disabled={bloqueado || (assumindo && !escolha)} carregando={enviando ? 'Enviando…' : undefined}>
            {me.clube ? 'Pedir troca' : 'Pedir clube'}
          </Botao>
        ) : (
          <Botao variante="fantasma" onClick={voltar}>Voltar ao perfil</Botao>
        )}
      </div>
    </div>
  );
}
