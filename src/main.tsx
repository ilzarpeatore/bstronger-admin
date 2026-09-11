import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/css/globals.css';
import App from './App.tsx';
import Spinner from './views/spinner/Spinner.tsx';

import { ThemeProvider } from './context/shadcntheme/ThemeContext.tsx';
import { AuthProvider } from './context/auth-context/AuthContext.tsx';

async function bootstrap() {
  const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
  if (import.meta.env.DEV && useMocks) {
    const { worker } = await import('./api/mocks/browser');
    await worker.start();
  }

  createRoot(document.getElementById('root')!).render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <App />
        </Suspense>
      </AuthProvider>
    </ThemeProvider>,
  );
}

bootstrap();
