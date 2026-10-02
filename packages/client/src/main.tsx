import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { Button } from './components/ui/button.tsx';
import './index.css';

// With VITE_SENTRY_DSN unset (e.g. local dev), Sentry.init() no-ops rather
// than throwing, so this is safe to leave configured everywhere.
Sentry.init({
   dsn: import.meta.env.VITE_SENTRY_DSN,
   environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <Sentry.ErrorBoundary
         fallback={() => (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
               <h1 className="text-lg font-semibold">Something went wrong</h1>
               <p className="text-muted-foreground max-w-sm text-sm">
                  The error has been reported. Try reloading the page.
               </p>
               <Button onClick={() => window.location.assign('/')}>
                  Reload
               </Button>
            </div>
         )}
      >
         <QueryClientProvider client={queryClient}>
            <BrowserRouter>
               <App />
            </BrowserRouter>
         </QueryClientProvider>
      </Sentry.ErrorBoundary>
   </StrictMode>
);
