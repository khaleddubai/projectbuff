'use client';

import { useQuery } from '@tanstack/react-query';
import { stats } from '@/lib/api-client';

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const data = await stats.get();
      return data as Record<string, unknown>;
    },
    refetchInterval: 10_000, // Poll every 10s
    retry: 2,
    staleTime: 5_000,
  });
}
