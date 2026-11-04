import { ultimosNaTela, type Resultado } from './tipos';

// bolinhas V/E/D; o texto vem do aria-label de quem usa (nunca só a cor)
export const Ultimos = ({ valores }: { valores: Resultado[] }) => (
  <span className="ultimos" aria-hidden="true">{ultimosNaTela(valores).map((r, i) => <i key={i} className={`r-${r}`} />)}</span>
);
