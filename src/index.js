import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// Tailwind CSS is loaded via <script> in public/index.html <head>
// so it's available before React renders (prevents flash of unstyled content)

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Reveal the app once React has rendered
requestAnimationFrame(() => {
  document.getElementById('root')?.classList.add('ready');
});
