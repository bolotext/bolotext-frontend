import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { ConfirmProvider } from './components/ui/overlay'
import { TooltipProvider } from './components/ui/primitives'
import { ApiError } from './api/client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      // Don't retry logical 4xx errors (FORBIDDEN, NOT_FOUND, …).
      retry: (count, err) => count < 2 && !(err instanceof ApiError && err.code >= 400 && err.code < 500),
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <ConfirmProvider>
              <App />
              <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
            </ConfirmProvider>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
