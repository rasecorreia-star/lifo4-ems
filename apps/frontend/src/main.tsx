import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { Toaster } from './components/ui/toaster';
import './styles/globals.css';
import './lib/i18n';

// Initialize mock server in demo mode
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

async function initializeApp() {
  if (isDemoMode) {
    const { worker } = await import('./mocks/browser');
    try {
      await worker.start({
        onUnhandledRequest: 'warn',
      });
      console.log('✓ Mock server started (Demo Mode)');
    } catch (error) {
      console.warn('Mock server initialization warning:', error);
      // If MSW fails to start, the app will still work but use real API
    }
  }

  // Create a client for React Query
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

initializeApp();
