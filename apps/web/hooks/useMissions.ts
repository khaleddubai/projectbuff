'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { missions } from '@/lib/api-client';
import { toast } from 'sonner';

export function useMissions(status?: string) {
  return useQuery({
    queryKey: ['missions', status],
    queryFn: async () => {
      const data = await missions.list(status ? { status: status === 'all' ? undefined : status } : undefined);
      return data as Record<string, unknown>[];
    },
    refetchInterval: 5_000,
    retry: 2,
    staleTime: 3_000,
  });
}

export function useMission(id: string) {
  return useQuery({
    queryKey: ['mission', id],
    queryFn: async () => {
      const data = await missions.get(id);
      return data as Record<string, unknown>;
    },
    refetchInterval: 3_000,
    retry: 3,
  });
}

export function useExecuteMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { idea: string }) => {
      return missions.execute(data);
    },
    onSuccess: () => {
      toast.success('Mission launched successfully');
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to launch mission');
    },
  });
}

export function useCancelMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return missions.cancel(id);
    },
    onSuccess: () => {
      toast.success('Mission cancelled');
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel mission');
    },
  });
}
