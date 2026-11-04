import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AvisoVersao } from './AvisoVersao';
import { instalarCapturaDeErros } from './erros';
import './tokens.css';

instalarCapturaDeErros();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AvisoVersao />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js');
