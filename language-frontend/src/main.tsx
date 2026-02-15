import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No #root element');

function ErrorFallback({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#b91c1c' }}>Something went wrong</h1>
      <pre style={{ background: '#fef2f2', padding: '1rem', overflow: 'auto', fontSize: '14px' }}>
        {message}
      </pre>
      <p style={{ color: '#666' }}>Open DevTools (F12) → Console for full error.</p>
    </div>
  );
}

const root = createRoot(rootEl);

async function init() {
  try {
    const { default: App } = await import('./App');
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (e) {
    root.render(<ErrorFallback error={e} />);
    console.error(e);
  }
}

init();
