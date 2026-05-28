'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { search as searchApi } from '@/lib/api-client';

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function useSearch(query: string, agent?: string) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: ['search', debouncedQuery, agent],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const data = await searchApi.query({
        q: debouncedQuery,
        limit: 25,
        ...(agent && { agent }),
      });
      return data as Record<string, unknown>[];
    },
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 30_000,
    retry: 1,
  });
}
