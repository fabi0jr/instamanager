import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api/cliente';
import { Aviso, Botao, Campo, useEnvio, useFocoNoErro } from '../conta/ui';
import { Folha } from '../feed/Folha';
import { Topo } from './Admin';

export function Convite() {
  const [codigo, setCodigo] = useState<string | 'carregando' | 'erro'>('carregando');
  const [copiado, setCopiado] = useState(false);
  const [avisoCopia, setAvisoCopia] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState('');
  const { enviando, aviso, enviar } = useEnvio();
  const relogio = useRef<ReturnType<typeof setTimeout>>(undefined);
  useFocoNoErro(erro);

  function carregar() {
    setCodigo('carregando');
    api<{ codigo: string | null }>('/admin/convite').then((c) => setCodigo(c.codigo ?? 'erro'), () => setCodigo('erro'));
  }
  useEffect(carregar, []);
  useEffect(() => () => clearTimeout(relogio.current), []);

  async function copiar() {
    if (codigo === 'carregando' || codigo === 'erro') return;
    setAvisoCopia('');
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      setAvisoCopia('Não deu para copiar. Toque e segure no código para copiar.');
    }
  }

  function trocar(e: FormEvent) {
    e.preventDefault();
    const valor = novo.trim();
    if (valor.length < 4) return setErro('Use pelo menos 4 caracteres.');
    setErro('');
    enviar(async () => {
      const r = await api<{ codigo: string }>('/admin/convite', { method: 'PUT', body: JSON.stringify({ codigo: valor }) });
      setCodigo(r.codigo);
      setCopiado(false);
      setTrocando(false);
      setNovo('');
    });
  }

  return (
    <div className="tela admin">
      <Topo titulo="Código de convite" voltar />
      {codigo === 'carregando' && <div className="esqueleto" style={{ height: 160 }} aria-busy="true" />}
      {codigo === 'erro' && (
        <div className="caixa-info" role="alert">
          <h2>Não deu para carregar o código</h2>
          <Botao variante="secundario" onClick={carregar}>Tentar de novo</Botao>
        </div>
      )}
      {codigo !== 'carregando' && codigo !== 'erro' && (
        <>
          <div className="caixa-info cartao-codigo">
            <p className="codigo" aria-label="Código de convite">{codigo}</p>
            <p className="giz2">Um código só para o grupo. Mande no WhatsApp.</p>
          </div>
          {avisoCopia && <p role="alert" className="erro-txt">{avisoCopia}</p>}
          <Botao onClick={copiar}>{copiado ? <><span className="ok-gramado" aria-hidden="true">✓</span> Código copiado</> : 'Copiar código'}</Botao>
          <Botao variante="secundario" onClick={() => setTrocando(true)}>Trocar código</Botao>
        </>
      )}
      {trocando && (
        <Folha titulo="Trocar código" aoFechar={() => setTrocando(false)}>
          <form onSubmit={trocar} noValidate className="form-folha">
            <Aviso>{aviso}</Aviso>
            <Campo data-foco rotulo="Novo código" value={novo} autoCapitalize="characters" autoComplete="off" ajuda="Pelo menos 4 caracteres." erro={erro} disabled={enviando} onChange={(e) => setNovo(e.target.value.toUpperCase())} />
            <p className="aviso-ambar">O código antigo para de valer na hora. Quem já tem conta continua entrando.</p>
            <Botao type="submit" carregando={enviando ? 'Trocando…' : undefined}>Trocar código</Botao>
          </form>
        </Folha>
      )}
    </div>
  );
}
