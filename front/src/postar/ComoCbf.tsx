import '../clube/clube.css';
import type { Me } from '../api/cliente';

// Só o admin vê. Desligado por padrão, a cada post (o estado mora em quem usa).
export function ComoCbf({ me, ligado, aoMudar, fixo }: { me: Me; ligado: boolean; aoMudar: (v: boolean) => void; fixo?: boolean }) {
  if (!me.isAdmin) return null;
  return (
    <div className={`como-cbf ${ligado ? 'ligado' : ''}`}>
      <img src="/escudos/cbf.svg" alt="" width="30" height="40" />
      <span className="linha-txt">
        <strong>Postar como CBF</strong>
        <span className="giz2 legenda-s">Só o admin. O post sai no perfil oficial.</span>
      </span>
      <button type="button" role="switch" aria-checked={ligado} aria-label="Postar como CBF" disabled={fixo} className={`interruptor ${ligado ? 'ligado' : ''}`} onClick={() => aoMudar(!ligado)}><span /></button>
    </div>
  );
}

export const quemPosta = (me: Me, cbf: boolean) => (cbf ? 'Vai sair como CBF, perfil oficial.' : `Vai sair como ${me.clube?.nome}, por ${me.nome}.`);
export const MSG_SEM_ADMIN = 'Só o admin pode postar como CBF. Seu acesso mudou. Publique pelo seu clube.';
