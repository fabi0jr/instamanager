import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { ErroApi } from '../api/cliente';
import './conta.css';

export const Alerta = ({ tam = 16 }: { tam?: number }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" />
  </svg>
);

type CampoProps = InputHTMLAttributes<HTMLInputElement> & { rotulo: string; erro?: string; ajuda?: string };

export function Campo({ rotulo, erro, ajuda, type, ...props }: CampoProps) {
  const id = useId();
  const [mostrar, setMostrar] = useState(false);
  const desc = erro ? id + 'e' : ajuda ? id + 'a' : undefined;
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="caixa">
        <input {...props} id={id} type={type === 'password' && mostrar ? 'text' : type} aria-invalid={erro ? true : undefined} aria-describedby={desc} />
        {type === 'password' && (
          <button type="button" className="olho" aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setMostrar(!mostrar)}>
            {mostrar ? 'ocultar' : 'mostrar'}
          </button>
        )}
      </div>
      {erro ? (
        <p id={id + 'e'} className="erro"><Alerta />{erro}</p>
      ) : (
        ajuda && <span id={id + 'a'} className="ajuda">{ajuda}</span>
      )}
    </div>
  );
}

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & { carregando?: string; variante?: 'secundario' | 'fantasma' };
// carregando = rótulo no gerúndio; enquanto houver, o botão fica inerte com spinner
export function Botao({ children, carregando, variante, className = '', ...props }: BotaoProps) {
  return (
    <button {...props} type={props.type ?? 'button'} className={`botao ${variante ?? ''} ${className}`} disabled={props.disabled || !!carregando}>
      {carregando ? (<><span className="giro" aria-hidden="true" />{carregando}</>) : children}
    </button>
  );
}

export const Aviso = ({ children }: { children?: ReactNode }) =>
  children ? <div className="aviso" role="alert"><Alerta tam={20} />{children}</div> : null;

// erro de campo → foca o primeiro campo inválido
export function useFocoNoErro(dep: unknown) {
  useEffect(() => {
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [dep]);
}

// 400 DADOS_INVALIDOS traz `campos`: vira mensagem em cada campo (em vez do aviso de conexão)
const POR_CAMPO: Record<string, string> = {
  convite: 'Digite o código de convite.',
  nome: 'Digite um nome de até 60 letras.',
  email: 'Digite seu e-mail.',
  senha: 'Digite sua senha.',
};
export function errosDosCampos(e: ErroApi, texto: Record<string, string> = {}): Record<string, string> | null {
  if (e.codigo !== 'DADOS_INVALIDOS' || !e.campos.length) return null;
  return Object.fromEntries(e.campos.map((c) => [c, texto[c] ?? POR_CAMPO[c] ?? 'Confira este campo.']));
}

const MUITAS = 'Muitas tentativas. Espere alguns minutos e tente de novo.';
const GENERICO = 'Não deu para completar. Confira a conexão e tente de novo.';

// envio com aviso geral: 429 bloqueia o botão por 60 s; `tratar` devolve true se já cuidou do erro
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  async function enviar(fn: () => Promise<void>, tratar?: (e: ErroApi) => boolean) {
    setEnviando(true);
    setAviso('');
    try {
      await fn();
    } catch (e) {
      if (e instanceof ErroApi && tratar?.(e)) return;
      if (e instanceof ErroApi && e.status === 429) {
        setAviso(MUITAS);
        setBloqueado(true);
        setTimeout(() => setBloqueado(false), 60_000);
      } else setAviso(GENERICO);
    } finally {
      setEnviando(false);
    }
  }
  return { enviando, aviso, setAviso, bloqueado, enviar };
}
