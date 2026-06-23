import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Safely wrap localStorage.setItem to prevent QuotaExceededError crashes
(function() {
  try {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = function(key, value) {
      try {
        originalSetItem.call(window.localStorage, key, value);
      } catch (e: any) {
        console.warn(`localStorage.setItem failed for key "${key}":`, e);
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.message?.includes('quota') || e.name?.includes('Quota')) {
          try {
            window.localStorage.removeItem('timeMachine_promax_vfs');
            originalSetItem.call(window.localStorage, key, value);
          } catch (retryErr) {
            console.error('Failed to recover localStorage space:', retryErr);
          }
        }
      }
    };
  } catch (err) {
    console.error('Failed to patch localStorage:', err);
  }
})();
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import 'katex/dist/katex.min.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
