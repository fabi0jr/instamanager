import type { ReactNode } from 'react';

const base = (d: ReactNode, cheio = false) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={cheio ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const IcCurtir = ({ cheio }: { cheio?: boolean }) => base(<path d="M12 20s-8-4.7-8-10.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5C20 15.3 12 20 12 20z" />, cheio);
export const IcComentar = () => base(<path d="M4 5h16v11H9l-5 4z" />);
export const IcMais = () => base(<><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>);
export const IcFechar = () => base(<path d="M6 6l12 12M18 6L6 18" />);
