import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { API_CONFIG } from './config/api';

// Import global styles
import './index.css';

const API_ORIGIN = API_CONFIG.BASE_URL.replace(/\/api\/v1$/i, '');

const rewriteApiRequestUrl = (inputUrl: string): string => {
  try {
    const parsed = new URL(inputUrl, window.location.origin);
    const isSameOrigin = parsed.origin === window.location.origin;
    const isApiPath = parsed.pathname.startsWith('/api/');

    if (isSameOrigin && isApiPath) {
      return `${API_ORIGIN}${parsed.pathname}${parsed.search}`;
    }

    return inputUrl;
  } catch {
    return inputUrl;
  }
};

const originalFetch = window.fetch.bind(window);

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string') {
    return originalFetch(rewriteApiRequestUrl(input), init);
  }

  if (input instanceof URL) {
    return originalFetch(rewriteApiRequestUrl(input.toString()), init);
  }

  if (input instanceof Request) {
    const rewrittenUrl = rewriteApiRequestUrl(input.url);
    if (rewrittenUrl !== input.url) {
      return originalFetch(new Request(rewrittenUrl, input), init);
    }
  }

  return originalFetch(input, init);
};

// Get the root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// Create root and render app
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
