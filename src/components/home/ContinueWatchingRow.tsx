'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { getPosterUrl } from '@/api/tmdb';

interface ContinueItem {
  tmdbId: number;
  type: 'movie' | 'tvshow';
  title: string;
  posterPath: string | null;
  lastSeenAt: string;
  nextSeason?: number;
  nextEpisode?: number;
  lastWatchedLabel?: string;
}

async function fetchContinueWatching(): Promise<ContinueItem[]> {
  const res = await fetch('/api/history/continue-watching');
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

async function dismissItem(args: { tmdbId: number; type: 'movie' | 'tvshow' }) {
  await fetch('/api/history/dismiss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
}

export function ContinueWatchingRow() {
  const { status } = useSession();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['continue-watching'],
    queryFn: fetchContinueWatching,
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });

  const dismiss = useMutation({
    mutationFn: dismissItem,
    onMutate: async ({ tmdbId, type }) => {
      await queryClient.cancelQueries({ queryKey: ['continue-watching'] });
      const previous = queryClient.getQueryData<ContinueItem[]>(['continue-watching']);
      queryClient.setQueryData<ContinueItem[]>(['continue-watching'], (old = []) =>
        old.filter((i) => !(i.tmdbId === tmdbId && i.type === type))
      );
      return { previous };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['continue-watching'], ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
    },
  });

  if (status !== 'authenticated') return null;
  if (isLoading) {
    return (
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Continue Watching</h2>
        <div className="relative -mx-4">
          <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex-none w-[180px] md:w-[200px] aspect-[2/3] rounded-md bg-gray-800 animate-pulse"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (items.length === 0) return null;

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold mb-6">Continue Watching</h2>
      <div className="relative -mx-4">
        <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8 row-container">
          {items.map((item) => {
            const href =
              item.type === 'movie'
                ? `/movie/${item.tmdbId}`
                : `/tv/${item.tmdbId}/season/${item.nextSeason}/episode/${item.nextEpisode}`;
            return (
              <div key={`${item.type}:${item.tmdbId}`} className="flex-none w-[180px] md:w-[200px] group relative">
                <Link href={href} className="block">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-md">
                    <Image
                      src={getPosterUrl(item.posterPath)}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 200px"
                      priority={false}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black via-black/80 to-transparent">
                      <p className="text-white font-medium text-sm line-clamp-1">{item.title}</p>
                      {item.type === 'tvshow' && (
                        <p className="text-xs text-white/70">
                          Next: S{item.nextSeason}:E{item.nextEpisode}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dismiss.mutate({ tmdbId: item.tmdbId, type: item.type });
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Dismiss"
                  title="Remove from Continue Watching"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
