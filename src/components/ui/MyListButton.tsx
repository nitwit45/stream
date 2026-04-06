'use client';

import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface MyListButtonProps {
  tmdbId: number;
  type: 'movie' | 'tvshow';
  size?: 'sm' | 'md';
}

export function MyListButton({ tmdbId, type, size = 'md' }: MyListButtonProps) {
  const { status } = useSession();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['mylist-status', tmdbId, type],
    queryFn: async () => {
      const res = await fetch(`/api/mylist?tmdbId=${tmdbId}&type=${type}`);
      if (!res.ok) return { inList: false };
      return res.json();
    },
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });

  const inList = data?.inList ?? false;

  const toggle = useMutation({
    mutationFn: async () => {
      const method = inList ? 'DELETE' : 'POST';
      await fetch('/api/mylist', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId, type }),
      });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['mylist-status', tmdbId, type] });
      const prev = queryClient.getQueryData(['mylist-status', tmdbId, type]);
      queryClient.setQueryData(['mylist-status', tmdbId, type], { inList: !inList });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['mylist-status', tmdbId, type], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['mylist-status', tmdbId, type] });
      queryClient.invalidateQueries({ queryKey: ['mylist'] });
    },
  });

  if (status !== 'authenticated') return null;

  const iconSize = size === 'sm' ? 16 : 20;
  const cls =
    size === 'sm'
      ? 'rounded-full border border-white/30 p-1.5 text-white hover:border-white transition'
      : 'inline-flex items-center justify-center px-6 py-2.5 bg-gray-600/80 text-white font-medium rounded gap-2 hover:bg-gray-600 transition-colors';

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate();
      }}
      className={cls}
      title={inList ? 'Remove from My List' : 'Add to My List'}
      aria-label={inList ? 'Remove from My List' : 'Add to My List'}
    >
      {inList ? (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
      {size === 'md' && (inList ? 'In My List' : 'My List')}
    </button>
  );
}
