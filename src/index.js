import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';



// Add Tailwind CSS via CDN for the classNames to work
const tailwindScript = document.createElement('script');
tailwindScript.src = 'https://cdn.tailwindcss.com';
document.head.appendChild(tailwindScript);

// <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);