import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/geist';
import App from './App';
import './index.css';

// Android share target lands on ./?title=..&text=..&url=.. → route it to the Share page.
const search = new URLSearchParams(window.location.search);
if (search.has('url') || search.has('text') || search.has('title')) {
  const clean = window.location.pathname;
  window.history.replaceState(null, '', `${clean}#/share?${search.toString()}`);
}

// Follow the phone's light/dark setting.
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', media.matches);
applyTheme();
media.addEventListener('change', applyTheme);

// Ask the browser not to evict our IndexedDB under storage pressure.
navigator.storage?.persist?.().catch(() => undefined);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
