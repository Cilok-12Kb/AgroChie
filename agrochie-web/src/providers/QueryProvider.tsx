'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { setSessionExpiredHandler } from '@/features/console/api'; // [REVISI]

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // 2 menit
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // [REVISI] 401 global: api.ts memanggil ini sebelum redirect ke /masuk.
  useEffect(() => {
    setSessionExpiredHandler(() => client.removeQueries({ queryKey: ['console', 'account'] }));
    return () => setSessionExpiredHandler(null);
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
