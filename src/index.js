import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Add Tailwind CSS via CDN for the classNames to work
const tailwindScript = document.createElement('script');
tailwindScript.src = 'https://cdn.tailwindcss.com';
document.head.appendChild(tailwindScript);

// Service Worker disabled temporarily due to infinite loop
// TODO: Fix and re-enable service worker
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('🎵 UMO Archive SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('❌ SW registration failed:', error);
      });
  });
}
*/

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
