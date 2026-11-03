import { configure } from '@testing-library/react';

// máquina carregada (vários agentes rodando a suíte): 1 s do padrão estourava em waitFor/findBy
configure({ asyncUtilTimeout: 3000 });
