import type { ReactNode } from 'react';

const base = (d: ReactNode, cheio = false) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={cheio ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const IcCurtir = ({ cheio }: { cheio?: boolean }) => base(<path d="M12 20s-8-4.7-8-10.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5C20 15.3 12 20 12 20z" />, cheio);
export const IcComentar = () => base(<path d="M4 5h16v11H9l-5 4z" />);
export const IcMais = () => base(<><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>);
export const IcFechar = () => base(<path d="M6 6l12 12M18 6L6 18" />);
export const IcSeta = () => base(<path d="M9 6l6 6-6 6" />);
export const IcFiltro = () => base(<path d="M4 6h16M7 12h10M10 18h4" />);
export const IcCopiar = () => base(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></>);
export const IcOk = () => base(<path d="M5 12l5 5 9-10" />);
export const IcGaleria = () => base(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M20 15l-5-5-9 10" /></>);
export const IcCamera = () => base(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>);
