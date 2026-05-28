'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            retry: 2,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            color: '#e2e8f0',
            borderRadius: '12px',
            fontSize: '14px',
          },
          duration: 4000,
        }}
        closeButton
        richColors
      />
    </QueryClientProvider>
  );
}
