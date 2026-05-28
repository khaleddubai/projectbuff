'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeys } from '@/lib/api-client';
import { toast } from 'sonner';

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const data = await apiKeys.list();
      return data as Record<string, unknown>[];
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; rateLimit?: number }) => {
      return apiKeys.create(data);
    },
    onSuccess: () => {
      toast.success('API key created');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create API key');
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiKeys.revoke(id);
    },
    onSuccess: () => {
      toast.success('API key revoked');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke API key');
    },
  });
}
