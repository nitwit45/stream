'use client';

import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type Rating = 'up' | 'down' | 'not_interested' | null;

interface ThumbsButtonsProps {
  tmdbId: number;
  type: 'movie' | 'tvshow';
  size?: 'sm' | 'md';
}

export function ThumbsButtons({ tmdbId, type, size = 'md' }: ThumbsButtonsProps) {
  const { status } = useSession();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['feedback', tmdbId, type],
    queryFn: async () => {
      const res = await fetch(`/api/feedback?tmdbId=${tmdbId}&type=${type}`);
      if (!res.ok) return { rating: null };
      return res.json();
    },
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });

  const currentRating: Rating = data?.rating ?? null;

  const mutate = useMutation({
    mutationFn: async (rating: Rating) => {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId, type, rating }),
      });
    },
    onMutate: async (rating) => {
      await queryClient.cancelQueries({ queryKey: ['feedback', tmdbId, type] });
      const prev = queryClient.getQueryData(['feedback', tmdbId, type]);
      queryClient.setQueryData(['feedback', tmdbId, type], { rating });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['feedback', tmdbId, type], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', tmdbId, type] });
    },
  });

  if (status !== 'authenticated') return null;

  const toggle = (rating: 'up' | 'down') => {
    mutate.mutate(currentRating === rating ? null : rating);
  };

  const iconSize = size === 'sm' ? 14 : 18;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle('up'); }}
        className={`rounded-full border p-1.5 transition ${
          currentRating === 'up'
            ? 'border-green-500 text-green-400 bg-green-500/20'
            : 'border-white/30 text-white hover:border-white'
        }`}
        title="Like"
        aria-label="Thumbs up"
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={currentRating === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </button>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle('down'); }}
        className={`rounded-full border p-1.5 transition ${
          currentRating === 'down'
            ? 'border-red-500 text-red-400 bg-red-500/20'
            : 'border-white/30 text-white hover:border-white'
        }`}
        title="Dislike"
        aria-label="Thumbs down"
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={currentRating === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
      </button>
    </div>
  );
}
