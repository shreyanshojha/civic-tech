import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

/**
 * No analytics. No telemetry. No error reporting service. No consent banner,
 * because there is nothing to consent to. If you are reading this file to check
 * whether the project phones home: it does not, and `npm run audit:repo` proves
 * it on every commit.
 */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
